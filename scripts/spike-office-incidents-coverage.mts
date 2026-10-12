// scripts/spike-office-incidents-coverage.mts
// One-off: mide costo (latencia) y cobertura (mesas con tickets abiertos, cuántos
// con location_id) de un barrido secuencial sobre TODOS los nodos activos.
// Uso: npx tsx scripts/spike-office-incidents-coverage.mts
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { mesas } from "../src/db/schema";
import { invgateGet } from "../src/lib/invgateClient";
import type {
  InvgateByStatusResponse,
  InvgateIncident,
} from "../src/types/invgate";

const NODE_TIMEOUT_MS = 10000;
const DETAIL_TIMEOUT_MS = 20000;
const DETAIL_CHUNK = 200;
const MAX_DETAIL_NODES = 15;

// Los 9 nodos medidos en el spike previo (point-in-time).
const MEASURED_IDS = [2562, 2507, 6409, 6023, 2558, 5982, 2552, 2498, 5973];

function chunkBy<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function countWithLocation(ids: number[]): Promise<number> {
  let withLocation = 0;
  for (const chunk of chunkBy(ids, DETAIL_CHUNK)) {
    const query = chunk.map((id) => `ids[]=${id}`).join("&");
    const res = await invgateGet<Record<string, InvgateIncident>>(
      `incidents?${query}`,
      DETAIL_TIMEOUT_MS,
    );
    if (!res.ok || !res.data) throw new Error(res.message ?? "detalle falló");
    for (const inc of Object.values(res.data)) {
      if (inc.location_id != null) withLocation++;
    }
  }
  return withLocation;
}

const rows = await db
  .select({ id: mesas.invgateId, name: mesas.name })
  .from(mesas)
  .where(eq(mesas.active, true))
  .orderBy(mesas.name);

console.log(`[coverage] nodos activos: ${rows.length}`);
console.table(rows.map((r) => ({ id: r.id, name: r.name })));

interface NodeStat {
  id: number;
  name: string;
  total: number;
  latencyMs: number;
}

// ticketId -> nodo donde se vio primero (para atribuir el dedup).
const ticketOwner = new Map<number, number>();
const stats: NodeStat[] = [];
const latencies: number[] = [];

const passStart = Date.now();
for (const node of rows) {
  const t0 = Date.now();
  try {
    const res = await invgateGet<InvgateByStatusResponse>(
      `incidents.by.helpdesk?helpdesk_id=${node.id}&limit=500`,
      NODE_TIMEOUT_MS,
    );
    const ids =
      res.ok && Array.isArray(res.data?.requestIds) ? res.data.requestIds : [];
    const latencyMs = Date.now() - t0;
    latencies.push(latencyMs);
    for (const id of ids) {
      if (!ticketOwner.has(id)) ticketOwner.set(id, node.id);
    }
    stats.push({ id: node.id, name: node.name, total: ids.length, latencyMs });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    latencies.push(latencyMs);
    stats.push({ id: node.id, name: node.name, total: -1, latencyMs });
    console.error(`[coverage] nodo ${node.id} (${node.name}) falló:`, error);
  }
}
const passMs = Date.now() - passStart;

const withTickets = stats.filter((s) => s.total > 0);
const totalTickets = ticketOwner.size;

const measuredSet = new Set(MEASURED_IDS);
let fromMeasured = 0;
for (const owner of ticketOwner.values()) {
  if (measuredSet.has(owner)) fromMeasured++;
}
const fromRest = totalTickets - fromMeasured;

const sortedLat = [...latencies].sort((a, b) => a - b);
const minLat = sortedLat[0] ?? 0;
const maxLat = sortedLat[sortedLat.length - 1] ?? 0;
const avgLat = latencies.length
  ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
  : 0;

console.log("\n=== BARRIDO COMPLETO ===");
console.log(`nodos con >0 tickets: ${withTickets.length} de ${rows.length}`);
console.log(`total abiertos (dedup por id): ${totalTickets}`);
console.log(`desde los 9 nodos medidos: ${fromMeasured}`);
console.log(`desde el resto: ${fromRest}`);
console.log(
  `latencia por nodo: min ${minLat}ms / avg ${avgLat}ms / max ${maxLat}ms`,
);
console.log(`wall time barrido completo: ${(passMs / 1000).toFixed(1)}s`);

// Top nodos NO medidos por cantidad de tickets.
const topUnmeasured = withTickets
  .filter((s) => !measuredSet.has(s.id))
  .sort((a, b) => b.total - a.total)
  .slice(0, MAX_DETAIL_NODES);

console.log("\n=== DETALLE (location_id) TOP NODOS NO MEDIDOS ===");
const detailById = new Map<number, number>();
for (const node of topUnmeasured) {
  const t0 = Date.now();
  try {
    const res = await invgateGet<InvgateByStatusResponse>(
      `incidents.by.helpdesk?helpdesk_id=${node.id}&limit=500`,
      NODE_TIMEOUT_MS,
    );
    const ids =
      res.ok && Array.isArray(res.data?.requestIds) ? res.data.requestIds : [];
    const withLocation = ids.length > 0 ? await countWithLocation(ids) : 0;
    detailById.set(node.id, withLocation);
    console.log(
      `  ${node.id} ${node.name}: ${ids.length} abiertos, ${withLocation} con location (${Date.now() - t0}ms)`,
    );
  } catch (error) {
    detailById.set(node.id, -1);
    console.error(`[coverage] detalle nodo ${node.id} falló:`, error);
  }
}

// Tabla resumen: solo nodos con tickets o detallados.
const summaryRows = stats
  .filter((s) => s.total > 0)
  .sort((a, b) => b.total - a.total)
  .map((s) => ({
    id: s.id,
    name: s.name,
    openTickets: s.total,
    withLocationTickets: detailById.has(s.id)
      ? detailById.get(s.id)
      : measuredSet.has(s.id)
        ? "seed"
        : "-",
    latencyMs: s.latencyMs,
  }));

console.log("\n=== RESUMEN ===");
console.table(summaryRows);
