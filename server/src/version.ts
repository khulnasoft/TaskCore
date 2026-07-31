import { createRequire } from "node:module";

type PackageJson = {
  version?: string;
};

function loadServerVersion(): string {
  const fromEnv = process.env.TASKCORE_SERVER_VERSION;
  if (fromEnv) return fromEnv;
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as PackageJson;
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const serverVersion = loadServerVersion();
