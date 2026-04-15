import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listGeminiSkills,
  syncGeminiSkills,
} from "@taskcore/adapter-gemini-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("gemini local skill sync", () => {
  const taskcoreKey = "taskcore/taskcore/taskcore";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports configured Taskcore skills and installs them into the Gemini skills home", async () => {
    const home = await makeTempDir("taskcore-gemini-skill-sync-");
    cleanupDirs.add(home);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "gemini_local",
      config: {
        env: {
          HOME: home,
        },
        taskcoreSkillSync: {
          desiredSkills: [taskcoreKey],
        },
      },
    } as const;

    const before = await listGeminiSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(taskcoreKey);
    expect(before.entries.find((entry) => entry.key === taskcoreKey)?.required).toBe(true);
    expect(before.entries.find((entry) => entry.key === taskcoreKey)?.state).toBe("missing");

    const after = await syncGeminiSkills(ctx, [taskcoreKey]);
    expect(after.entries.find((entry) => entry.key === taskcoreKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".gemini", "skills", "taskcore"))).isSymbolicLink()).toBe(true);
  });

  it("keeps required bundled Taskcore skills installed even when the desired set is emptied", async () => {
    const home = await makeTempDir("taskcore-gemini-skill-prune-");
    cleanupDirs.add(home);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "gemini_local",
      config: {
        env: {
          HOME: home,
        },
        taskcoreSkillSync: {
          desiredSkills: [taskcoreKey],
        },
      },
    } as const;

    await syncGeminiSkills(configuredCtx, [taskcoreKey]);

    const clearedCtx = {
      ...configuredCtx,
      config: {
        env: {
          HOME: home,
        },
        taskcoreSkillSync: {
          desiredSkills: [],
        },
      },
    } as const;

    const after = await syncGeminiSkills(clearedCtx, []);
    expect(after.desiredSkills).toContain(taskcoreKey);
    expect(after.entries.find((entry) => entry.key === taskcoreKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".gemini", "skills", "taskcore"))).isSymbolicLink()).toBe(true);
  });
});
