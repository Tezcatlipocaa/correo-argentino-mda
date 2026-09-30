import "dotenv/config";
import { runAutoAssignCycle, type AutoAssignCycleResult } from "../src/lib/autogestion/autoAssignRunner";

export const INTERVAL_MS = 10 * 60 * 1000; // 10 minutos exactos
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let running = true;

process.on("SIGINT", () => {
  console.log("\n[Worker Auto-Assign] Señal SIGINT recibida. Apagando worker limpiamente...");
  running = false;
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[Worker Auto-Assign] Señal SIGTERM recibida. Apagando worker limpiamente...");
  running = false;
  process.exit(0);
});

export async function runSingleIteration(authorLabel: string = "Manual CLI (--once)"): Promise<AutoAssignCycleResult> {
  const timestamp = new Date().toLocaleTimeString("es-AR", { hour12: false });
  console.log(`\n[Worker Auto-Assign] [${timestamp}] Iniciando evaluación de reglas para autogestiones...`);

  const res = await runAutoAssignCycle(authorLabel);
  console.log(
    `[Worker Auto-Assign] [${timestamp}] Ciclo finalizado. Evaluados: ${res.evaluatedCount}, Asignados: ${res.assignedCount}, Errores: ${res.errors.length}`
  );

  if (res.assignedCount > 0) {
    for (const t of res.assignedTickets) {
      console.log(
        `   -> Ticket ${t.ticketNumber} reasignado automáticamente a ${t.assignedTo} [Regla: ${t.ruleId}]`
      );
    }
  }

  if (res.errors.length > 0) {
    for (const err of res.errors) {
      console.error(`   [Error] ${err}`);
    }
  }

  return res;
}

export async function main(argv: string[] = process.argv): Promise<AutoAssignCycleResult | void> {
  const isOnce = argv.includes("--once");

  if (isOnce) {
    console.log("==========================================================");
    console.log("[Worker Auto-Assign] Ejecución Manual Iniciada (--once)");
    console.log("==========================================================");
    return await runSingleIteration("Manual CLI (--once)");
  }

  console.log("==========================================================");
  console.log("[Worker Auto-Assign] Proceso de Asignación Automática Iniciado");
  console.log(`[Worker Auto-Assign] Frecuencia de Sondeo: Cada 10 minutos (${INTERVAL_MS / 1000}s)`);
  console.log("==========================================================");

  while (running) {
    try {
      await runSingleIteration("Worker PM2 (10m)");
    } catch (err: any) {
      console.error(`[Worker Auto-Assign] Error en ciclo:`, err?.message || err);
    }

    console.log(`[Worker Auto-Assign] Próxima evaluación en 10 minutos...`);
    await sleep(INTERVAL_MS);
  }
}

// Auto-ejecución directa solo fuera de entorno de pruebas
const isDirectRun =
  process.env.VITEST !== "true" &&
  process.env.NODE_ENV !== "test" &&
  Boolean(process.argv[1]?.replace(/\\/g, "/").includes("scripts/auto-assign-worker"));

if (isDirectRun) {
  main().catch((err) => {
    console.error("[Worker Auto-Assign] Error fatal:", err);
    process.exit(1);
  });
}
