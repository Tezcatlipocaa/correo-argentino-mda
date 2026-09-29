import { runAutoAssignCycle } from "../src/lib/autogestion/autoAssignRunner";

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutos exactos
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

async function main() {
  console.log("==========================================================");
  console.log("[Worker Auto-Assign] Proceso de Asignación Automática Iniciado");
  console.log(`[Worker Auto-Assign] Frecuencia de Sondeo: Cada 10 minutos (${INTERVAL_MS / 1000}s)`);
  console.log("==========================================================");

  while (running) {
    const timestamp = new Date().toLocaleTimeString("es-AR", { hour12: false });
    console.log(`\n[Worker Auto-Assign] [${timestamp}] Iniciando evaluación de reglas para autogestiones...`);

    try {
      const res = await runAutoAssignCycle("Worker PM2 (10m)");
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
    } catch (err: any) {
      console.error(`[Worker Auto-Assign] Error en ciclo:`, err?.message || err);
    }

    console.log(`[Worker Auto-Assign] Próxima evaluación en 10 minutos...`);
    await sleep(INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error("[Worker Auto-Assign] Error fatal:", err);
  process.exit(1);
});
