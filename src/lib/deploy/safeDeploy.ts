import Database from "better-sqlite3";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

export type SafeDeployStatus =
  | "deployed"
  | "noop"
  | "locked"
  | "dirty_worktree"
  | "non_fast_forward"
  | "preflight_failed"
  | "rolled_back"
  | "rollback_failed";

export interface SafeDeployResult {
  status: SafeDeployStatus;
  prevSha?: string;
  nextSha?: string;
  reason?: string;
}

export interface SafeDeployDeps {
  force: boolean;
  acquireLock: () =>
    | { acquired: true; release: () => void }
    | { acquired: false; holderPid: number };
  isWorktreeClean: () => boolean;
  fetchOriginMaster: () => void;
  getHeadSha: () => string;
  getRemoteSha: () => string;
  isAncestor: (ancestorSha: string, descendantSha: string) => boolean;
  getChangedFiles: (fromSha: string, toSha: string) => string[];
  createRollbackSnapshot: (meta: {
    prevSha: string;
    nextSha: string;
    depsChanged: boolean;
  }) => Promise<void>;
  fastForwardToRemote: () => void;
  runPreflightChecks: () => Promise<{ ok: boolean; reason?: string }>;
  stopPm2: () => void;
  installDeps: () => void;
  applyRealDbMigrations: () => void;
  buildProject: () => void;
  startPm2: () => void;
  runHttpSmokeTest: () => Promise<{ ok: boolean; reason?: string }>;
  warmAutomations: () => void;
  resetGitToSha: (sha: string) => void;
  restoreDbSnapshot: () => void;
  restoreDistSnapshot: () => void;
  cleanupSnapshot: () => void;
}

export async function runSafeDeploy(deps: SafeDeployDeps): Promise<SafeDeployResult> {
  const lock = deps.acquireLock();
  if (!lock.acquired) {
    return {
      status: "locked",
      reason: `Deploy en curso por PID ${lock.holderPid}.`,
    };
  }

  try {
    if (!deps.isWorktreeClean()) {
      return {
        status: "dirty_worktree",
        reason: "El repositorio tiene cambios locales sin commitear. Abortando antes de tocar PM2.",
      };
    }

    deps.fetchOriginMaster();
    const prevSha = deps.getHeadSha();
    const nextSha = deps.getRemoteSha();

    if (prevSha === nextSha && !deps.force) {
      return { status: "noop", prevSha, nextSha };
    }

    if (!deps.isAncestor(prevSha, nextSha)) {
      return {
        status: "non_fast_forward",
        prevSha,
        nextSha,
        reason: `origin/master (${nextSha}) no es descendiente fast-forward de HEAD (${prevSha}).`,
      };
    }

    const changedFiles = deps.getChangedFiles(prevSha, nextSha);
    const depsChanged =
      changedFiles.includes("package.json") || changedFiles.includes("package-lock.json");

    await deps.createRollbackSnapshot({ prevSha, nextSha, depsChanged });
    deps.fastForwardToRemote();

    if (!depsChanged) {
      const preflight = await deps.runPreflightChecks();
      if (!preflight.ok) {
        deps.resetGitToSha(prevSha);
        deps.cleanupSnapshot();
        return {
          status: "preflight_failed",
          prevSha,
          nextSha,
          reason: preflight.reason,
        };
      }
    }

    let dbTouched = false;
    try {
      deps.stopPm2();
      if (depsChanged) {
        deps.installDeps();
        const preflight = await deps.runPreflightChecks();
        if (!preflight.ok) {
          throw new Error(`Pre-flight falló tras npm install: ${preflight.reason ?? "error"}`);
        }
      }

      dbTouched = true;
      deps.applyRealDbMigrations();
      deps.buildProject();
      deps.startPm2();

      const smoke = await deps.runHttpSmokeTest();
      if (!smoke.ok) {
        throw new Error(`Smoke test HTTP falló: ${smoke.reason ?? "sin respuesta"}`);
      }
    } catch (cutoverErr) {
      const failureReason = (cutoverErr as Error).message;
      try {
        try {
          deps.stopPm2();
        } catch {
          // PM2 puede estar ya detenido
        }
        deps.resetGitToSha(prevSha);
        if (depsChanged) {
          deps.installDeps();
        }
        if (dbTouched) {
          deps.restoreDbSnapshot();
        }
        deps.restoreDistSnapshot();
        deps.startPm2();
        const rollbackSmoke = await deps.runHttpSmokeTest();
        if (!rollbackSmoke.ok) {
          return {
            status: "rollback_failed",
            prevSha,
            nextSha,
            reason: `${failureReason} | Además el smoke test post-rollback falló: ${rollbackSmoke.reason}`,
          };
        }
        deps.cleanupSnapshot();
        return {
          status: "rolled_back",
          prevSha,
          nextSha,
          reason: failureReason,
        };
      } catch (rbErr) {
        return {
          status: "rollback_failed",
          prevSha,
          nextSha,
          reason: `${failureReason} | Excepción durante rollback: ${(rbErr as Error).message}`,
        };
      }
    }

    deps.warmAutomations();
    deps.cleanupSnapshot();
    return { status: "deployed", prevSha, nextSha };
  } finally {
    lock.release();
  }
}

function execOrThrow(cmd: string, label: string): string {
  const res = spawnSync(cmd, {
    shell: true,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (res.status !== 0) {
    const out = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`[${label}] Comando falló (${cmd}):\n${out}`);
  }
  return (res.stdout ?? "").trim();
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function createProductionDeployDeps(opts: {
  rootDir?: string;
  force?: boolean;
  port?: number;
  log?: (msg: string) => void;
}): SafeDeployDeps {
  const rootDir = resolve(opts.rootDir ?? process.cwd());
  const lockPath = join(rootDir, ".deploy.lock");
  const rollbackDir = join(rootDir, ".deploy-rollback");
  const dbPath = join(rootDir, "database", "mda.db");
  const backupDbPath = join(rollbackDir, "mda.backup.db");
  const preflightDbPath = join(rollbackDir, "mda.preflight.db");
  const distPath = join(rootDir, "dist");
  const backupDistPath = join(rollbackDir, "dist");
  const port = opts.port ?? (Number(process.env.PORT) || 4321);
  const log = opts.log ?? ((msg: string) => console.log(msg));

  return {
    force: Boolean(opts.force),
    acquireLock: () => {
      if (existsSync(lockPath)) {
        try {
          const data = JSON.parse(readFileSync(lockPath, "utf8")) as { pid: number };
          if (data.pid && isPidAlive(data.pid)) {
            return { acquired: false, holderPid: data.pid };
          }
        } catch {
          // Lock corrupto
        }
      }
      writeFileSync(
        lockPath,
        JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
        "utf8",
      );
      return {
        acquired: true,
        release: () => rmSync(lockPath, { force: true }),
      };
    },
    isWorktreeClean: () => {
      const status = execOrThrow("git status --porcelain --untracked-files=no", "git-status");
      return status.length === 0;
    },
    fetchOriginMaster: () => {
      log("[Fase 1] Descargando referencias de origin/master...");
      execOrThrow("git fetch origin master", "git-fetch");
    },
    getHeadSha: () => execOrThrow("git rev-parse HEAD", "git-head"),
    getRemoteSha: () => execOrThrow("git rev-parse origin/master", "git-remote"),
    isAncestor: (ancestor, descendant) => {
      const res = spawnSync(`git merge-base --is-ancestor ${ancestor} ${descendant}`, {
        shell: true,
      });
      return res.status === 0;
    },
    getChangedFiles: (fromSha, toSha) => {
      if (fromSha === toSha) return [];
      const out = execOrThrow(`git diff --name-only ${fromSha} ${toSha}`, "git-diff");
      return out ? out.split(/\r?\n/).map((s) => s.trim()) : [];
    },
    createRollbackSnapshot: async (meta) => {
      log(
        `[Fase 2] Creando snapshot de rollback (${meta.prevSha.slice(0, 7)} -> ${meta.nextSha.slice(0, 7)})...`,
      );
      rmSync(rollbackDir, { recursive: true, force: true });
      mkdirSync(rollbackDir, { recursive: true });
      writeFileSync(
        join(rollbackDir, "manifest.json"),
        JSON.stringify({ ...meta, timestamp: new Date().toISOString() }, null, 2),
        "utf8",
      );

      if (existsSync(dbPath)) {
        const db = new Database(dbPath, { readonly: true });
        try {
          await db.backup(backupDbPath);
        } finally {
          db.close();
        }
      }

      if (existsSync(distPath)) {
        cpSync(distPath, backupDistPath, { recursive: true });
      }
    },
    fastForwardToRemote: () => {
      log("[Fase 3] Avanzando árbol de trabajo (git merge --ff-only origin/master)...");
      execOrThrow("git merge --ff-only origin/master", "git-merge-ff");
    },
    runPreflightChecks: async () => {
      try {
        log("[Pre-Flight] 1/3 Validando variables de entorno (verify-env)...");
        execOrThrow("npx tsx scripts/verify-env.mts", "verify-env");

        log("[Pre-Flight] 2/3 Ejecutando tests de dominio (npm run test:domain)...");
        execOrThrow("npm run test:domain", "test-domain");

        if (existsSync(backupDbPath)) {
          log("[Pre-Flight] 3/3 Simulando migraciones en copia de DB (mda.preflight.db)...");
          rmSync(preflightDbPath, { force: true });
          copyFileSync(backupDbPath, preflightDbPath);
          execOrThrow(
            `npx tsx scripts/align-db-to-schema.mts --db "${preflightDbPath}" --strict`,
            "preflight-align",
          );
          execOrThrow(
            `npx tsx scripts/backfill-asistencia.mts --db "${preflightDbPath}" --apply`,
            "preflight-backfill",
          );
          const enrichRes = spawnSync(
            `npx tsx scripts/apply-titles-enrichment.mts --db "${preflightDbPath}"`,
            { shell: true, encoding: "utf8" },
          );
          if (enrichRes.status !== 0) {
            log("[Pre-Flight] Advertencia en apply-titles-enrichment sobre copia; continuando.");
          }
          rmSync(preflightDbPath, { force: true });
          rmSync(`${preflightDbPath}-wal`, { force: true });
          rmSync(`${preflightDbPath}-shm`, { force: true });
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: (e as Error).message };
      }
    },
    stopPm2: () => {
      log("[Fase 4] Deteniendo PM2...");
      execOrThrow("pm2 kill", "pm2-kill");
    },
    installDeps: () => {
      log("[Fase 4] Instalando dependencias (npm install)...");
      execOrThrow("npm install", "npm-install");
    },
    applyRealDbMigrations: () => {
      if (!existsSync(dbPath)) return;
      log("[Fase 4] Alineando DB real en modo estricto...");
      execOrThrow(`npx tsx scripts/align-db-to-schema.mts --db "${dbPath}" --strict`, "db-align");
      execOrThrow(`npx tsx scripts/backfill-asistencia.mts --db "${dbPath}" --apply`, "db-backfill");
      const enrich = spawnSync(`npx tsx scripts/apply-titles-enrichment.mts --db "${dbPath}"`, {
        shell: true,
        encoding: "utf8",
      });
      if (enrich.status !== 0) {
        log("[Fase 4] Advertencia: apply-titles-enrichment falló; se continúa.");
      }
    },
    buildProject: () => {
      log("[Fase 4] Limpiando dist/ y compilando Astro (npm run build)...");
      rmSync(distPath, { recursive: true, force: true });
      execOrThrow("npm run build", "npm-build");
    },
    startPm2: () => {
      log("[Fase 5] Iniciando PM2 (ecosystem.config.cjs)...");
      execOrThrow("pm2 start ecosystem.config.cjs", "pm2-start");
      spawnSync("pm2 save", { shell: true, stdio: "ignore" });
    },
    runHttpSmokeTest: async () => {
      const baseUrl = `http://127.0.0.1:${port}`;
      const deadline = Date.now() + 20_000;
      let lastError = "Timeout esperando /login";

      while (Date.now() < deadline) {
        try {
          const res = await fetch(`${baseUrl}/login`, { redirect: "manual" });
          if (res.status === 200) {
            const html = await res.text();
            const cssMatch = html.match(/href="(\/_astro\/[^"]+\.css)"/);
            if (cssMatch) {
              const assetRes = await fetch(`${baseUrl}${cssMatch[1]}`);
              const ct = assetRes.headers.get("content-type") ?? "";
              if (assetRes.status !== 200 || !ct.includes("text/css")) {
                return {
                  ok: false,
                  reason: `Asset ${cssMatch[1]} devolvió status=${assetRes.status} content-type=${ct}`,
                };
              }
            }
            return { ok: true };
          }
          lastError = `/login respondió HTTP ${res.status}`;
        } catch (e) {
          lastError = (e as Error).message;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      return { ok: false, reason: lastError };
    },
    warmAutomations: () => {
      log("[Fase 5] Precalentando cache de automatizaciones (InvGate)...");
      const res = spawnSync("node --import tsx scripts/warm-automations.ts", {
        shell: true,
        encoding: "utf8",
      });
      if (res.status !== 0) {
        log("[Fase 5] Advertencia: warm-automations falló (no bloqueante).");
      }
    },
    resetGitToSha: (sha) => {
      log(`[Rollback] Restaurando código a ${sha}...`);
      execOrThrow(`git reset --hard ${sha}`, "git-reset");
    },
    restoreDbSnapshot: () => {
      if (!existsSync(backupDbPath)) return;
      log("[Rollback] Restaurando database/mda.db desde snapshot WAL-safe...");
      rmSync(`${dbPath}-wal`, { force: true });
      rmSync(`${dbPath}-shm`, { force: true });
      copyFileSync(backupDbPath, dbPath);
    },
    restoreDistSnapshot: () => {
      if (!existsSync(backupDistPath)) return;
      log("[Rollback] Restaurando carpeta dist/ previa...");
      rmSync(distPath, { recursive: true, force: true });
      cpSync(backupDistPath, distPath, { recursive: true });
    },
    cleanupSnapshot: () => {
      rmSync(rollbackDir, { recursive: true, force: true });
    },
  };
}
