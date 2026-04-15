import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bootstrapDevRunnerWorktreeEnv,
  isLinkedGitWorktreeCheckout,
  resolveWorktreeEnvFilePath,
} from "../dev-runner-worktree.ts";

const tempRoots = new Set<string>();

afterEach(() => {
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.clear();
});

function createTempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.add(root);
  return root;
}

describe("dev-runner worktree env bootstrap", () => {
  it("detects linked git worktrees from .git files", () => {
    const root = createTempRoot("taskcore-dev-runner-worktree-");
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/taskcore/.git/worktrees/feature\n", "utf8");

    expect(isLinkedGitWorktreeCheckout(root)).toBe(true);
  });

  it("loads repo-local Taskcore env for initialized worktrees without overriding explicit env", () => {
    const root = createTempRoot("taskcore-dev-runner-worktree-env-");
    fs.mkdirSync(path.join(root, ".taskcore"), { recursive: true });
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/taskcore/.git/worktrees/feature\n", "utf8");
    fs.writeFileSync(
      resolveWorktreeEnvFilePath(root),
      [
        "TASKCORE_HOME=/tmp/taskcore-worktrees",
        "TASKCORE_INSTANCE_ID=feature-worktree",
        "TASKCORE_IN_WORKTREE=true",
        "TASKCORE_WORKTREE_NAME=feature-worktree",
        "TASKCORE_OPTIONAL= # comment-only value",
        "",
      ].join("\n"),
      "utf8",
    );

    const env: NodeJS.ProcessEnv = {
      TASKCORE_INSTANCE_ID: "already-set",
    };
    const result = bootstrapDevRunnerWorktreeEnv(root, env);

    expect(result).toEqual({
      envPath: resolveWorktreeEnvFilePath(root),
      missingEnv: false,
    });
    expect(env.TASKCORE_HOME).toBe("/tmp/taskcore-worktrees");
    expect(env.TASKCORE_INSTANCE_ID).toBe("already-set");
    expect(env.TASKCORE_IN_WORKTREE).toBe("true");
    expect(env.TASKCORE_OPTIONAL).toBe("");
  });

  it("reports uninitialized linked worktrees so dev runner can fail fast", () => {
    const root = createTempRoot("taskcore-dev-runner-worktree-missing-");
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /tmp/taskcore/.git/worktrees/feature\n", "utf8");

    expect(bootstrapDevRunnerWorktreeEnv(root, {})).toEqual({
      envPath: resolveWorktreeEnvFilePath(root),
      missingEnv: true,
    });
  });
});
