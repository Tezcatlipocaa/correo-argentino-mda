import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runSafeDeploy, type SafeDeployDeps } from "./safeDeploy";

function createFakeDeps(overrides: Partial<SafeDeployDeps> = {}): {
  deps: SafeDeployDeps;
  log: string[];
} {
  const log: string[] = [];
  const base: SafeDeployDeps = {
    force: false,
    acquireLock: () => ({ acquired: true, release: () => log.push("release-lock") }),
    isWorktreeClean: () => true,
    fetchOriginMaster: () => log.push("git-fetch"),
    getHeadSha: () => "sha-old",
    getRemoteSha: () => "sha-new",
    isAncestor: () => true,
    getChangedFiles: () => ["src/pages/index.astro"],
    createRollbackSnapshot: async () => log.push("snapshot"),
    fastForwardToRemote: () => log.push("git-ff"),
    runPreflightChecks: async () => {
      log.push("preflight");
      return { ok: true };
    },
    stopPm2: () => log.push("pm2-kill"),
    installDeps: () => log.push("npm-install"),
    applyRealDbMigrations: () => log.push("db-migrate-real"),
    buildProject: () => log.push("npm-build"),
    startPm2: () => log.push("pm2-start"),
    runHttpSmokeTest: async () => {
      log.push("http-smoke");
      return { ok: true };
    },
    warmAutomations: () => log.push("warm-automations"),
    resetGitToSha: (sha) => log.push(`git-reset:${sha}`),
    restoreDbSnapshot: () => log.push("restore-db"),
    restoreDistSnapshot: () => log.push("restore-dist"),
    cleanupSnapshot: () => log.push("cleanup-snapshot"),
    ...overrides,
  };
  return { deps: base, log };
}

describe("runSafeDeploy", () => {
  it("aborta con 'locked' si otro proceso de deploy esta corriendo", async () => {
    const { deps, log } = createFakeDeps({
      acquireLock: () => ({ acquired: false, holderPid: 4444 }),
    });

    const res = await runSafeDeploy(deps);
    assert.equal(res.status, "locked");
    assert.deepEqual(log, []);
  });

  it("aborta con 'dirty_worktree' si hay cambios locales sin commitear", async () => {
    const { deps, log } = createFakeDeps({
      isWorktreeClean: () => false,
    });

    const res = await runSafeDeploy(deps);
    assert.equal(res.status, "dirty_worktree");
    assert.deepEqual(log, ["release-lock"]);
  });

  it("sale con 'noop' sin detener PM2 cuando HEAD ya coincide con origin/master", async () => {
    const { deps, log } = createFakeDeps({
      getHeadSha: () => "sha-same",
      getRemoteSha: () => "sha-same",
    });

    const res = await runSafeDeploy(deps);
    assert.equal(res.status, "noop");
    assert.deepEqual(log, ["git-fetch", "release-lock"]);
  });

  it("aborta con 'non_fast_forward' si origin/master reescribio historia", async () => {
    const { deps, log } = createFakeDeps({
      isAncestor: () => false,
    });

    const res = await runSafeDeploy(deps);
    assert.equal(res.status, "non_fast_forward");
    assert.deepEqual(log, ["git-fetch", "release-lock"]);
  });

  it("revierte HEAD sin detener PM2 ni tocar la DB real si falla el pre-flight cuando no cambiaron dependencias", async () => {
    const { deps, log } = createFakeDeps({
      runPreflightChecks: async () => {
        log.push("preflight-fail");
        return { ok: false, reason: "dropped_column en schedules" };
      },
    });

    const res = await runSafeDeploy(deps);
    assert.equal(res.status, "preflight_failed");
    assert.equal(log.includes("pm2-kill"), false);
    assert.equal(log.includes("db-migrate-real"), false);
    assert.deepEqual(log, [
      "git-fetch",
      "snapshot",
      "git-ff",
      "preflight-fail",
      "git-reset:sha-old",
      "cleanup-snapshot",
      "release-lock",
    ]);
  });

  it("ejecuta rollback completo (git + DB + dist + PM2 + smoke) si falla el build o el smoke test post-corte", async () => {
    let smokeAttempt = 0;
    const { deps, log } = createFakeDeps({
      getChangedFiles: () => ["package.json", "package-lock.json", "src/db/schema.ts"],
      runHttpSmokeTest: async () => {
        smokeAttempt++;
        log.push(`http-smoke-${smokeAttempt}`);
        if (smokeAttempt === 1) {
          return { ok: false, reason: "Asset /_astro/main.css devolvio text/html" };
        }
        return { ok: true };
      },
    });

    const res = await runSafeDeploy(deps);
    assert.equal(res.status, "rolled_back");
    assert.deepEqual(log, [
      "git-fetch",
      "snapshot",
      "git-ff",
      "pm2-kill",
      "npm-install",
      "preflight",
      "db-migrate-real",
      "npm-build",
      "pm2-start",
      "http-smoke-1",
      "pm2-kill",
      "git-reset:sha-old",
      "npm-install",
      "restore-db",
      "restore-dist",
      "pm2-start",
      "http-smoke-2",
      "cleanup-snapshot",
      "release-lock",
    ]);
  });

  it("completa el deploy exitosamente y limpia el snapshot cuando todas las fases pasan", async () => {
    const { deps, log } = createFakeDeps();

    const res = await runSafeDeploy(deps);
    assert.equal(res.status, "deployed");
    assert.deepEqual(log, [
      "git-fetch",
      "snapshot",
      "git-ff",
      "preflight",
      "pm2-kill",
      "db-migrate-real",
      "npm-build",
      "pm2-start",
      "http-smoke",
      "warm-automations",
      "cleanup-snapshot",
      "release-lock",
    ]);
  });
});
