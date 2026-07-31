# Deploying Taskcore to Vercel

Status: Supported deployment target
Date: 2026-07-31

## 1. Overview

Taskcore can run as a Vercel project with three deployable parts:

| Part | What deploys | Where it comes from |
|---|---|---|
| **API** | A single Node serverless function at `api/index.js` | `server/src/vercel.ts` bundled by `scripts/build-vercel-function.mjs` (esbuild) |
| **UI** | Static SPA build in `ui/dist` | `pnpm --filter @taskcore/ui build` |
| **Database** | External PostgreSQL | Vercel Postgres, Neon, Supabase, or any reachable Postgres via `DATABASE_URL` |

`vercel.json` wires the three together:

- `buildCommand`: `pnpm vercel:build` — builds workspace packages, the UI, then the serverless bundle
- `outputDirectory`: `ui/dist` — static UI served from the build output
- `rewrites`: `/api/*` goes to the function; everything else falls back to `index.html` (SPA routing)
- `functions.api/index.js.maxDuration`: 60s so a cold boot (Express + better-auth + DB pool) completes before the first response

The Express app serves the API only on Vercel (`SERVE_UI=false`, `uiMode: "none"`). All UI paths are served statically by the platform.

## 2. What Works / What Does Not

Works on Vercel:

- Full `/api/*` surface (board routes, agent routes, better-auth `/api/auth/*`)
- Static board UI at the deployment root
- External PostgreSQL (`DATABASE_URL`, `POSTGRES_URL`/`POSTGRES_URL_NON_POOLING`, or `PGHOST`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`)
- S3 storage via `TASKCORE_STORAGE_PROVIDER=s3` (see `doc/DATABASE.md`-adjacent storage docs)

Not available in the serverless runtime (the Vercel handler disables these):

- Embedded PostgreSQL / PGlite — `DATABASE_URL` is **required** (`server/src/vercel.ts` fails boot without it)
- Long-lived background work: heartbeat scheduler, routine scheduler, database backups, plugin workers
- Live events WebSocket channel (polling endpoints still work)
- Local-disk storage (`/tmp` is ephemeral — uploads/assets are lost between cold starts)
- Local/embedded agent adapters (Claude, Codex, etc. run as processes — they cannot run in a serverless function)

## 3. Prerequisites

- Repo pushed to GitHub, imported into a Vercel project
- An external PostgreSQL database (Vercel Postgres storage is the simplest path — it sets `POSTGRES_URL` automatically)
- Node.js 20+ and pnpm 9+ for local builds

## 4. Required Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` (or `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` / `PGHOST`+`PGDATABASE`+`PGUSER`+`PGPASSWORD`) | Yes | External Postgres connection |
| `BETTER_AUTH_SECRET` (or `TASKCORE_AGENT_JWT_SECRET`) | Yes | Auth cookie/JWT signing secret |
| `TASKCORE_AUTH_PUBLIC_BASE_URL` (or `BETTER_AUTH_URL`) | Yes | Public deployment URL, e.g. `https://taskcore-<project>.vercel.app` |

Defaults applied automatically when `VERCEL=1` (see `applyVercelDefaults` in `server/src/vercel.ts`):

| Variable | Default | Notes |
|---|---|---|
| `TASKCORE_DEPLOYMENT_MODE` | `authenticated` | Public unauthenticated boards are rejected |
| `TASKCORE_DEPLOYMENT_EXPOSURE` | `public` | |
| `SERVE_UI` | `false` | UI is served statically by Vercel |
| `TASKCORE_PLUGINS_ENABLED` | `false` | Plugin workers cannot run serverless |
| `TASKCORE_DB_BACKUP_ENABLED` | `false` | |
| `HEARTBEAT_SCHEDULER_ENABLED` | `false` | |
| `TASKCORE_STORAGE_LOCAL_DIR` | `/tmp/taskcore-storage` | Ephemeral — set S3 storage for durable uploads |
| `TASKCORE_PG_MAX_CONNECTIONS` | `5` | Keep bounded for serverless concurrency |

Recommended: `TASKCORE_STORAGE_PROVIDER=s3` with `TASKCORE_STORAGE_S3_BUCKET`, `TASKCORE_STORAGE_S3_REGION`, and `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` so attachments and assets survive cold starts.

## 5. Deploy Steps

1. Import the repo into Vercel (framework preset: **Other**; the repo's `vercel.json` overrides settings).
2. Create an external Postgres (or attach Vercel Postgres) and set the env vars above, including the deployment URL in `TASKCORE_AUTH_PUBLIC_BASE_URL`.
3. Deploy. `pnpm vercel:build` runs on Vercel: workspace packages → UI (`ui/dist`) → serverless bundle (`api/index.js`).
4. Migrations are **not** applied by the serverless runtime. Before first use, apply the schema once:
   ```sh
   DATABASE_URL=... pnpm db:migrate
   ```
5. Sign in with a real user at `https://<deployment>/api/auth/sign-in/email` (via the UI login page) — the first admin becomes the instance admin (board claim flow in `authenticated` mode).

## 6. Local Verification

```sh
pnpm vercel:build        # full production build (workspace + UI + function bundle)
vercel dev               # run the deployed layout locally (API function + static UI)
```

`vercel build` locally validates the exact layout (`ui/dist` static output + `api/index.js` function) that the platform will serve.

## 7. Repository Files

- `vercel.json` — platform config (build, routes, function limits)
- `server/src/vercel.ts` — serverless Express handler with Vercel runtime defaults and config guards
- `scripts/build-vercel-function.mjs` — esbuild bundler for `api/index.js`
- `packages/shared/src/vercel-postgres.ts` — `DATABASE_URL`/`POSTGRES_URL`/`PGHOST` connection resolution
- `api/index.js` — generated bundle (gitignored; built during `vercel:build`)
