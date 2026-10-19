import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createProductionDeployDeps, runSafeDeploy } from "../src/lib/deploy/safeDeploy";

const rootDir = resolve(process.cwd());
const logsDir = join(rootDir, "logs");
mkdirSync(logsDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const logFile = join(logsDir, `auto-deploy-${stamp}.log`);

function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    appendFileSync(logFile, `${line}\n`, "utf8");
  } catch {
    // No bloquear ejecución por fallo en el log secundario
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  log(`[MDA Safe-Deploy] Iniciando ejecución (force=${force})...`);

  const deps = createProductionDeployDeps({ rootDir, force, log });
  const result = await runSafeDeploy(deps);

  if (result.status === "noop") {
    log(
      `[MDA Safe-Deploy] Sin cambios nuevos (${result.prevSha?.slice(0, 7)}). PM2 continúa activo.`,
    );
    process.exit(0);
  }

  if (result.status === "deployed") {
    log(
      `[MDA Safe-Deploy] Deploy exitoso: ${result.prevSha?.slice(0, 7)} -> ${result.nextSha?.slice(0, 7)}.`,
    );
    process.exit(0);
  }

  if (result.status === "rolled_back") {
    log(
      `[MDA Safe-Deploy] ERROR en deploy; ROLLBACK AUTOMÁTICO completado a ${result.prevSha?.slice(0, 7)}. Causa: ${result.reason}`,
    );
    process.exit(1);
  }

  log(`[MDA Safe-Deploy] ABORTADO (${result.status}): ${result.reason ?? "sin detalle"}`);
  process.exit(1);
}

void main();
