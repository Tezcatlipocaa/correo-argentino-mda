// scripts/spike-office-incidents.mts
// One-off: lista, por nodo de helpdesk activo (mesas), cuántos tickets abiertos
// trae incidents.by.helpdesk y cuántos tienen location_id (oficina) asignado.
// Uso: npx tsx scripts/spike-office-incidents.mts
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

const report: {
  id: number;
  name: string;
  total: number;
  withLocation: number;
}[] = [];
for (const node of rows) {
  try {
    const res = await invgateGet<InvgateByStatusResponse>(
      `incidents.by.helpdesk?helpdesk_id=${node.id}&limit=500`,
      NODE_TIMEOUT_MS,
    );
    const ids =
      res.ok && Array.isArray(res.data?.requestIds) ? res.data.requestIds : [];
    const withLocation = ids.length > 0 ? await countWithLocation(ids) : 0;
    report.push({ id: node.id, name: node.name, total: ids.length, withLocation });
  } catch (error) {
    report.push({ id: node.id, name: node.name, total: -1, withLocation: -1 });
    console.error(`[spike] nodo ${node.id} (${node.name}) falló:`, error);
  }
}

report.sort((a, b) => b.withLocation - a.withLocation);

console.table(report);
