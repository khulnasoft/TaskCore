/// <reference path="./types/express.d.ts" />
import type { Request as ExpressRequest, RequestHandler, Response as ExpressResponse } from "express";
import { createDb, type Db } from "@taskcore/db";
import { createApp } from "./app.js";
import { loadConfig, type Config } from "./config.js";
import { logger } from "./middleware/logger.js";
import { initializeBoardClaimChallenge } from "./board-claim.js";
import { feedbackService } from "./services/index.js";
import { createFeedbackTraceShareClientFromConfig } from "./services/feedback-share-client.js";
import { createStorageServiceFromConfig } from "./storage/index.js";
import type { BetterAuthSessionResult } from "./auth/better-auth.js";

type ExpressApp = Awaited<ReturnType<typeof createApp>>;
type ExpressRequestHandler = (req: ExpressRequest, res: ExpressResponse) => void;

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.NOW === "1";
}

function applyVercelDefaults(): void {
  if (!isVercelRuntime()) return;
  const defaults: Record<string, string> = {
    TASKCORE_DEPLOYMENT_MODE: "authenticated",
    TASKCORE_DEPLOYMENT_EXPOSURE: "public",
    SERVE_UI: "false",
    TASKCORE_PLUGINS_ENABLED: "false",
    TASKCORE_DB_BACKUP_ENABLED: "false",
    HEARTBEAT_SCHEDULER_ENABLED: "false",
    TASKCORE_STORAGE_LOCAL_DIR: "/tmp/taskcore-storage",
    TASKCORE_LOG_DIR: "/tmp/taskcore-logs",
    TASKCORE_PG_MAX_CONNECTIONS: "5",
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function assertVercelConfig(config: Config): void {
  if (isVercelRuntime() && config.deploymentMode !== "authenticated") {
    throw new Error(
      "Taskcore on Vercel requires TASKCORE_DEPLOYMENT_MODE=authenticated " +
      "(a public, unauthenticated board is not allowed).",
    );
  }
  if (isVercelRuntime() && config.deploymentExposure !== "public") {
    throw new Error(
      "Taskcore on Vercel requires TASKCORE_DEPLOYMENT_EXPOSURE=public.",
    );
  }
  if (config.deploymentMode === "authenticated" && config.deploymentExposure === "public") {
    if (config.authBaseUrlMode !== "explicit" || !config.authPublicBaseUrl) {
      throw new Error(
        "Authenticated public exposure requires auth.baseUrlMode=explicit and a public URL. " +
        "Set TASKCORE_AUTH_PUBLIC_BASE_URL (or BETTER_AUTH_URL) to the deployment URL " +
        "(e.g. https://taskcore-<project>.vercel.app).",
      );
    }
  }
}

async function createAppForServerless(config: Config, db: Db): Promise<ExpressApp> {
  let authReady = config.deploymentMode === "local_trusted";
  let betterAuthHandler: RequestHandler | undefined;
  let resolveSession:
    | ((req: ExpressRequest) => Promise<BetterAuthSessionResult | null>)
    | undefined;

  if (config.deploymentMode === "authenticated") {
    const {
      createBetterAuthHandler,
      createBetterAuthInstance,
      deriveAuthTrustedOrigins,
      resolveBetterAuthSession,
    } = await import("./auth/better-auth.js");
    const derivedTrustedOrigins = deriveAuthTrustedOrigins(config);
    const envTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const effectiveTrustedOrigins = Array.from(new Set([...derivedTrustedOrigins, ...envTrustedOrigins]));
    logger.info(
      {
        authBaseUrlMode: config.authBaseUrlMode,
        authPublicBaseUrl: config.authPublicBaseUrl ?? null,
        trustedOrigins: effectiveTrustedOrigins,
      },
      "Authenticated mode auth origin configuration (serverless)",
    );
    const auth = createBetterAuthInstance(db, config, effectiveTrustedOrigins);
    betterAuthHandler = createBetterAuthHandler(auth);
    resolveSession = (req) => resolveBetterAuthSession(auth, req);
    await initializeBoardClaimChallenge(db, { deploymentMode: config.deploymentMode });
    authReady = true;
  }

  const storageService = createStorageServiceFromConfig(config);
  const feedback = feedbackService(db, {
    shareClient: createFeedbackTraceShareClientFromConfig(config),
  });

  return createApp(db, {
    uiMode: "none",
    serverPort: 3000,
    storageService,
    feedbackExportService: feedback,
    deploymentMode: config.deploymentMode,
    deploymentExposure: config.deploymentExposure,
    allowedHostnames: config.allowedHostnames,
    bindHost: config.host,
    authReady,
    companyDeletionEnabled: config.companyDeletionEnabled,
    betterAuthHandler,
    resolveSession,
  });
}

async function boot(): Promise<ExpressApp> {
  applyVercelDefaults();

  const config = loadConfig();
  if (!config.databaseUrl) {
    throw new Error(
      "Taskcore on Vercel requires an external PostgreSQL connection. " +
      "Set DATABASE_URL (or the Vercel Postgres / RDS environment: POSTGRES_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD).",
    );
  }
  assertVercelConfig(config);

  const maxConnections = Math.max(1, Number(process.env.TASKCORE_PG_MAX_CONNECTIONS) || 10);
  const prepareDisabled = process.env.TASKCORE_PG_PREPARE !== undefined
    ? process.env.TASKCORE_PG_PREPARE === "true"
    : isVercelRuntime();
  const db = createDb(config.databaseUrl, {
    max: maxConnections,
    ...(prepareDisabled ? { prepare: false } : {}),
  });

  logger.info(
    {
      deploymentMode: config.deploymentMode,
      deploymentExposure: config.deploymentExposure,
      storageProvider: config.storageProvider,
      databaseConfigured: true,
    },
    "Booting Taskcore serverless app",
  );

  return createAppForServerless(config, db);
}

let appPromise: Promise<ExpressApp> | null = null;

export default async function taskcoreVercelHandler(
  req: ExpressRequest,
  res: ExpressResponse,
): Promise<void> {
  const app = await (appPromise ??= boot().catch((err) => {
    appPromise = null;
    throw err;
  }));
  (app as unknown as ExpressRequestHandler)(req, res);
}
