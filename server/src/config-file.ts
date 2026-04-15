import fs from "node:fs";
import { taskcoreConfigSchema, type TaskcoreConfig } from "@taskcore/shared";
import { resolveTaskcoreConfigPath } from "./paths.js";

export function readConfigFile(): TaskcoreConfig | null {
  const configPath = resolveTaskcoreConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return taskcoreConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
