import type { InvgateIncident } from "@/types/invgate";

export interface Serie {
  label: string;
  data: number[];
}

export interface ChartData {
  labels: string[];
  series: Serie[];
}

export interface MassEvent {
  categoriaId: number | null;
  titulo: string;
  oficinas: number;
  tickets: number;
  desde: number; // epoch ms del ticket más viejo del grupo
  officeCodes: string[]; // NIS de las oficinas afectadas
}

/** Mínimo de oficinas distintas para declarar un evento masivo. */
export const MASS_EVENT_MIN_OFFICES = 5;

const AR_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isSameDayAr(ms: number, nowMs: number): boolean {
  return AR_DATE_FMT.format(new Date(ms)) === AR_DATE_FMT.format(new Date(nowMs));
}

/**
 * InvGate entrega epoch en segundos; las tablas locales guardan milisegundos
 * (y `automation_parents` no tiene unidad documentada): normalizar acá en vez
 * de asumir. Valores < 1e12 son segundos.
 */
export function toEpochMs(value: number | null | undefined): number | null {
  if (value == null) return null;
  return value < 1e12 ? value * 1000 : value;
}

function arDateKey(ms: number): string {
  return AR_DATE_FMT.format(new Date(ms));
}

/**
 * Agrupa incidentes abiertos por categoría dentro de la ventana (default: hoy
 * AR). Un grupo es "evento masivo" si toca >= minOffices oficinas distintas.
 * Sólo cuentan incidentes con location mapeada a una oficina.
 */
export function clusterMassEvents(
  incidents: InvgateIncident[],
  locationToCode: Map<number, string>,
  nowMs: number,
  minOffices: number = MASS_EVENT_MIN_OFFICES,
): MassEvent[] {
  const groups = new Map<number, { incidents: InvgateIncident[]; codes: Set<string> }>();
  for (const incident of incidents) {
    if (incident.location_id == null) continue;
    const code = locationToCode.get(incident.location_id);
    if (!code) continue;
    const createdMs = toEpochMs(incident.created_at);
    if (createdMs == null || !isSameDayAr(createdMs, nowMs)) continue;
    const key = incident.category_id ?? -1;
    const group = groups.get(key) ?? { incidents: [], codes: new Set<string>() };
    group.incidents.push(incident);
    group.codes.add(code);
    groups.set(key, group);
  }

  const events: MassEvent[] = [];
  for (const [key, group] of groups) {
    if (group.codes.size < minOffices) continue;
    const oldest = group.incidents.reduce((a, b) => (b.created_at < a.created_at ? b : a));
    events.push({
      categoriaId: key === -1 ? null : key,
      titulo: oldest.title,
      oficinas: group.codes.size,
      tickets: group.incidents.length,
      desde: toEpochMs(oldest.created_at) ?? 0,
      officeCodes: [...group.codes].sort(),
    });
  }
  return events.sort((a, b) => b.oficinas - a.oficinas || b.tickets - a.tickets);
}

export function countOpenIncidentsByCode(
  incidents: InvgateIncident[],
  locationToCode: Map<number, string>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const incident of incidents) {
    if (incident.location_id == null) continue;
    const code = locationToCode.get(incident.location_id);
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
}

export function countMassEventsByCode(events: MassEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    for (const code of event.officeCodes) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return counts;
}

export function buildCountChart(
  keys: (string | null | undefined)[],
  seriesLabel: string,
): ChartData {
  const counts = new Map<string, number>();
  for (const key of keys) {
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const labels = [...counts.keys()];
  return {
    labels,
    series: [{ label: seriesLabel, data: labels.map((l) => counts.get(l) ?? 0) }],
  };
}

export interface ParentRow {
  provinceName: string;
  createdAt: number; // epoch ms
  closedAt: number | null; // epoch ms
}

/**
 * Modernización por provincia: "Cerrados" = closedAt dentro de la ventana;
 * "En curso" = sin closedAt y ya creado (createdAt <= now).
 */
export function buildModernizacionPorProvincia(
  rows: ParentRow[],
  windowStartMs: number,
  nowMs: number,
): ChartData {
  const totals = new Map<string, { cerrados: number; enCurso: number }>();
  for (const row of rows) {
    const bucket = totals.get(row.provinceName) ?? { cerrados: 0, enCurso: 0 };
    if (row.closedAt != null && row.closedAt >= windowStartMs && row.closedAt <= nowMs) {
      bucket.cerrados++;
    } else if (row.closedAt == null && row.createdAt <= nowMs) {
      bucket.enCurso++;
    } else {
      continue;
    }
    totals.set(row.provinceName, bucket);
  }
  const labels = [...totals.entries()]
    .filter(([, b]) => b.cerrados + b.enCurso > 0)
    .sort((a, b) => b[1].cerrados + b[1].enCurso - (a[1].cerrados + a[1].enCurso))
    .map(([name]) => name);
  return {
    labels,
    series: [
      { label: "Cerrados", data: labels.map((l) => totals.get(l)?.cerrados ?? 0) },
      { label: "En curso", data: labels.map((l) => totals.get(l)?.enCurso ?? 0) },
    ],
  };
}

/** Serie diaria (la ventana completa) para la página de detalle. */
export function buildModernizacionTimeline(
  rows: ParentRow[],
  windowStartMs: number,
  nowMs: number,
): ChartData {
  const spanDays = Math.max(
    0,
    Math.round((nowMs - windowStartMs) / (24 * 3600 * 1000)),
  );
  const labels: string[] = [];
  for (let offset = spanDays; offset >= 0; offset--) {
    const key = arDateKey(nowMs - offset * 24 * 3600 * 1000);
    labels.push(`${key.slice(8, 10)}/${key.slice(5, 7)}`);
  }
  const cerrados = new Array<number>(labels.length).fill(0);
  const enCurso = new Array<number>(labels.length).fill(0);
  // Bucket por día con clamp (no según match exacto de clave): un cierre en el
  // futuro o un alta anterior a la ventana cae en el borde, nunca se descarta.
  // ponytail: el arrastre pre-ventana se acumula en el día 0 a propósito.
  const dayIndexOf = (ms: number) => {
    const diff = Math.round((nowMs - ms) / (24 * 3600 * 1000));
    return Math.min(spanDays, Math.max(0, spanDays - diff));
  };
  for (const row of rows) {
    if (row.closedAt != null) {
      cerrados[dayIndexOf(row.closedAt)]++;
    } else {
      enCurso[dayIndexOf(row.createdAt)]++;
    }
  }
  return {
    labels,
    series: [
      { label: "Cerrados", data: cerrados },
      { label: "En curso", data: enCurso },
    ],
  };
}
