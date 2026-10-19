import Database from "better-sqlite3";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface PrePushRef {
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
}

export interface CmdResult {
  status: number;
  stdout: string;
  stderr: string;
}

const ZERO_SHA = "0000000000000000000000000000000000000000";

export function parsePrePushStdin(stdin: string): PrePushRef[] {
  return stdin
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteSha };
    })
    .filter((r) => Boolean(r.localRef && r.localSha && r.remoteRef && r.remoteSha));
}

export async function runPrePushGate(deps: {
  stdin: string;
  dbExists: boolean;
  skipFlag?: boolean;
  runCmd: (cmd: string) => CmdResult;
  simulateSchemaAlign: () => Promise<{ ok: boolean; error?: string }>;
}): Promise<{ ok: boolean; reason?: string; bypassed?: boolean }> {
  if (deps.skipFlag) {
    return { ok: true, bypassed: true };
  }

  const refs = parsePrePushStdin(deps.stdin);
  const masterPushes = refs.filter(
    (r) => r.remoteRef === "refs/heads/master" && r.localSha !== ZERO_SHA,
  );

  if (masterPushes.length === 0) {
    return { ok: true };
  }

  const domainRes = deps.runCmd("npm run test:domain");
  if (domainRes.status !== 0) {
    return {
      ok: false,
      reason: `[pre-push] Falló 'npm run test:domain'. Corregí los tests antes de pushear a master.\n${domainRes.stderr || domainRes.stdout}`,
    };
  }

  let touchesSchema = false;
  for (const push of masterPushes) {
    if (push.remoteSha === ZERO_SHA) {
      touchesSchema = true;
      break;
    }
    const diffRes = deps.runCmd(`git diff --name-only ${push.remoteSha} ${push.localSha}`);
    const changed = diffRes.stdout.split(/\r?\n/).map((s) => s.trim());
    if (changed.includes("src/db/schema.ts")) {
      touchesSchema = true;
      break;
    }
  }

  if (touchesSchema && deps.dbExists) {
    const sim = await deps.simulateSchemaAlign();
    if (!sim.ok) {
      return {
        ok: false,
        reason: `[pre-push] Cambio destructivo o inválido en src/db/schema.ts detectado sobre copia de DB:\n${sim.error ?? "Error en align-db-to-schema --strict"}`,
      };
    }
  }

  return { ok: true };
}

function defaultRunCmd(cmd: string): CmdResult {
  const res = spawnSync(cmd, {
    shell: true,
    encoding: "utf8",
    stdio: "pipe",
  });
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

async function defaultSimulateSchemaAlign(dbPath: string): Promise<{ ok: boolean; error?: string }> {
  const tempDir = resolve(".deploy-rollback");
  mkdirSync(tempDir, { recursive: true });
  const tempDb = join(tempDir, "prepush-check.db");
  rmSync(tempDb, { force: true });

  const source = new Database(dbPath, { readonly: true });
  try {
    await source.backup(tempDb);
  } finally {
    source.close();
  }

  try {
    const res = defaultRunCmd(`npx tsx scripts/align-db-to-schema.mts --db "${tempDb}" --strict`);
    if (res.status !== 0) {
      return { ok: false, error: (res.stderr || res.stdout).trim() };
    }
    return { ok: true };
  } finally {
    rmSync(tempDb, { force: true });
    rmSync(`${tempDb}-wal`, { force: true });
    rmSync(`${tempDb}-shm`, { force: true });
  }
}

async function main(): Promise<void> {
  const skipFlag =
    process.env.MDA_SKIP_PRE_PUSH === "1" ||
    process.argv.includes("--bypass-pre-push") ||
    process.argv.includes("--skip-pre-push");

  if (skipFlag) {
    console.warn("[pre-push] ADVERTENCIA: Verificaciones omitidas por MDA_SKIP_PRE_PUSH.");
    process.exit(0);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  const stdin = Buffer.concat(chunks).toString("utf8");
  const dbPath = resolve("./database/mda.db");

  const result = await runPrePushGate({
    stdin,
    dbExists: existsSync(dbPath),
    skipFlag,
    runCmd: defaultRunCmd,
    simulateSchemaAlign: () => defaultSimulateSchemaAlign(dbPath),
  });

  if (!result.ok) {
    console.error(result.reason);
    process.exit(1);
  }
  console.log("[pre-push] Verificaciones de dominio y schema OK.");
}

const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) void main();
