import type {
  AutomationMetrics,
  GroupStat,
  MonthlyLeadTime,
  MonthlyThroughput,
} from "./metrics";
import { formatDays as days, formatPct as pct } from "./metricsFormat";

/**
 * Export del reporte de métricas de /automatizaciones en CSV y SVG (para PNG
 * vía resvg). Funciones puras: no tocan DB ni red.
 */

const WINDOW_LABELS: Readonly<Record<string, string>> = {
  "30": "Últimos 30 días",
  "90": "Últimos 90 días",
  "365": "Último año",
  all: "Histórico completo",
};

/** Ventanas válidas soportadas por la UI (en días). */
const METRICS_WINDOWS = [30, 90, 365] as const;

/** Convierte el query param `window` a días (null = histórico completo). */
export function parseWindowParam(raw: string | null): number | null {
  if (!raw || raw === "all") return null;
  const parsed = Number.parseInt(raw, 10);
  return (METRICS_WINDOWS as readonly number[]).includes(parsed)
    ? parsed
    : null;
}

export function windowLabel(daysValue: number | null): string {
  if (daysValue === null) return WINDOW_LABELS.all;
  return WINDOW_LABELS[String(daysValue)] ?? `Últimos ${daysValue} días`;
}

function groupRows(label: string, groups: readonly GroupStat[]): string[][] {
  return groups.map((group) => [
    label,
    group.label,
    `total ${group.total} · activos ${group.active} · finalizados ${group.finalized} · mediana ${days(group.medianLeadDays)}`,
  ]);
}

/** Arma el CSV del reporte (con BOM UTF-8 al escribir). */
export function buildMetricsCsv(metrics: AutomationMetrics): string {
  const rows: [string, string, string][] = [
    ["Resumen", "Ventana", windowLabel(metrics.window.days)],
    ["Resumen", "Total histórico", String(metrics.totals.total)],
    ["Resumen", "En curso (WIP)", String(metrics.totals.active)],
    ["Resumen", "Finalizadas", String(metrics.totals.finalized)],
    ["Tiempo de ciclo", "Muestra", String(metrics.leadTime.sample)],
    ["Tiempo de ciclo", "Mediana (días)", days(metrics.leadTime.medianDays)],
    ["Tiempo de ciclo", "Promedio (días)", days(metrics.leadTime.averageDays)],
    ["Tiempo de ciclo", "P90 (días)", days(metrics.leadTime.p90Days)],
    ["SLA", "Muestra", String(metrics.sla.sample)],
    ["SLA", "On-time", String(metrics.sla.onTime)],
    ["SLA", "Cumplimiento", pct(metrics.sla.onTimeRate)],
    ["SLA", "Desvío promedio (días)", days(metrics.sla.avgDeviationDays)],
    ["Tiempo trabajado", "Casos con días activos", String(metrics.time.sampleActive)],
    ["Tiempo trabajado", "Mediana días activos", days(metrics.time.medianActiveDays)],
    ["Tiempo trabajado", "Mediana días sin actividad", days(metrics.time.medianIdleDays)],
    ["Ritmo", "Finalizadas por semana", String(metrics.pace.finalizedPerWeek ?? "—")],
    ["Ritmo", "Semanas para vaciar el WIP", String(metrics.pace.etaWeeks ?? "—")],
    ["Progreso", "Casos con progreso", String(metrics.progress.withData)],
    ["Progreso", "Avance promedio", pct(metrics.progress.average)],
    ["Progreso", "Estancados", String(metrics.progress.stalled)],
    ["Progreso", "Críticos", String(metrics.progress.critical)],
    ["Calidad", "Casos analizados", String(metrics.dataQuality.total)],
    ["Calidad", "Sin código de sucursal", String(metrics.dataQuality.missingBranchCode)],
    ["Calidad", "Sin fecha estimada", String(metrics.dataQuality.missingEstimatedEnd)],
    ["Calidad", "Sin región", String(metrics.dataQuality.missingRegion)],
  ];

  rows.push(...(groupRows("Región", metrics.byRegion) as [string, string, string][]));
  for (const month of metrics.throughput) {
    rows.push(["Casos por mes", `${month.month} · creados`, String(month.created)]);
    rows.push([
      "Casos por mes",
      `${month.month} · finalizados`,
      String(month.finalized),
    ]);
  }
  for (const month of metrics.leadTimeByMonth) {
    rows.push([
      "Tiempo de ciclo por mes",
      `${month.month} · mediana`,
      days(month.medianDays),
    ]);
    rows.push([
      "Tiempo de ciclo por mes",
      `${month.month} · p90`,
      days(month.p90Days),
    ]);
  }
  for (const bucket of metrics.time.idleBuckets) {
    rows.push(["Sin actividad", bucket.label, String(bucket.count)]);
  }

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [["Sección", "Indicador", "Valor"], ...rows]
    .map((row) => row.map((cell) => escape(String(cell))).join(","))
    .join("\n");
}

const SVG_NS = "http://www.w3.org/2000/svg";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface MetricsSvg {
  svg: string;
  width: number;
  height: number;
}

interface SvgOptions {
  generatedAt: Date;
}

interface KpiBox {
  label: string;
  value: string;
  sub: string;
  color: string;
}

/** Paleta institucional (tema claro) para el reporte. */
const C = {
  ink: "#0c0c0c",
  body: "#4a4d4f",
  muted: "#7c8183",
  faint: "#969a9c",
  line: "#cacdce",
  box: "#f2f2f3",
  secondary: "#254888",
  info: "#2879a8",
  success: "#068444",
  accent: "#3a6ea5",
  warning: "#b5851f",
  error: "#b3474d",
} as const;

const DONUT_COLORS = [
  C.secondary,
  C.info,
  C.success,
  C.accent,
  C.warning,
  C.error,
  C.body,
  C.muted,
];

interface LineSeries {
  name: string;
  color: string;
  values: number[];
}

/** Gráfico de líneas SVG (viewBox local). */
function svgLineChart(
  x: number,
  y: number,
  width: number,
  height: number,
  labels: string[],
  series: LineSeries[],
): string {
  const parts: string[] = [];
  const padLeft = 30;
  const padBottom = 18;
  const plotW = width - padLeft;
  const plotH = height - padBottom;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const n = labels.length;

  // Ejes
  parts.push(
    `<line x1="${x + padLeft}" y1="${y + plotH}" x2="${x + padLeft + plotW}" y2="${y + plotH}" stroke="${C.line}" />`,
  );
  parts.push(
    `<line x1="${x + padLeft}" y1="${y}" x2="${x + padLeft}" y2="${y + plotH}" stroke="${C.line}" />`,
  );
  parts.push(
    `<text x="${x + padLeft - 6}" y="${y + 4}" font-family="Arial, sans-serif" font-size="9" fill="${C.faint}" text-anchor="end">${max}</text>`,
  );
  parts.push(
    `<text x="${x + padLeft - 6}" y="${y + plotH}" font-family="Arial, sans-serif" font-size="9" fill="${C.faint}" text-anchor="end">0</text>`,
  );

  const stepX = n > 1 ? plotW / (n - 1) : 0;
  const px = (i: number) => x + padLeft + (n > 1 ? i * stepX : plotW / 2);
  const py = (v: number) => y + plotH - (v / max) * plotH;

  for (const s of series) {
    const points = s.values
      .map((v, i) => `${px(i)},${py(v)}`)
      .join(" ");
    parts.push(
      `<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="2" />`,
    );
    s.values.forEach((v, i) => {
      parts.push(`<circle cx="${px(i)}" cy="${py(v)}" r="2.4" fill="${s.color}" />`);
    });
  }

  // Etiquetas X (máximo ~12)
  labels.forEach((label, i) => {
    parts.push(
      `<text x="${px(i)}" y="${y + plotH + 13}" font-family="Arial, sans-serif" font-size="9" fill="${C.muted}" text-anchor="middle">${esc(label)}</text>`,
    );
  });

  return parts.join("\n");
}

/** Donut SVG con leyenda a la derecha. */
function svgDonut(
  x: number,
  y: number,
  radius: number,
  slices: { label: string; value: number }[],
): string {
  const parts: string[] = [];
  const cx = x + radius;
  const cy = y + radius;
  const thickness = Math.max(12, radius * 0.34);
  const r = radius - thickness / 2;
  const circumference = 2 * Math.PI * r;
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (total <= 0) {
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.box}" stroke-width="${thickness}" />`,
    );
    parts.push(
      `<text x="${cx}" y="${cy + 4}" font-family="Arial, sans-serif" font-size="11" fill="${C.faint}" text-anchor="middle">Sin datos</text>`,
    );
    return parts.join("\n");
  }

  let offset = 0;
  slices.forEach((slice, index) => {
    if (slice.value <= 0) return;
    const fraction = slice.value / total;
    const dash = fraction * circumference;
    const color = DONUT_COLORS[index % DONUT_COLORS.length];
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${thickness}" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`,
    );
    offset += dash;
  });

  parts.push(
    `<text x="${cx}" y="${cy - 2}" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="${C.ink}" text-anchor="middle">${total}</text>`,
  );
  parts.push(
    `<text x="${cx}" y="${cy + 14}" font-family="Arial, sans-serif" font-size="10" fill="${C.muted}" text-anchor="middle">total</text>`,
  );

  // Leyenda
  let ly = y + 6;
  const lx = cx + radius + 16;
  slices.forEach((slice, index) => {
    const color = DONUT_COLORS[index % DONUT_COLORS.length];
    const pctValue = Math.round((slice.value / total) * 100);
    parts.push(
      `<rect x="${lx}" y="${ly - 8}" width="9" height="9" rx="2" fill="${color}" />`,
    );
    parts.push(
      `<text x="${lx + 14}" y="${ly}" font-family="Arial, sans-serif" font-size="11" fill="${C.body}">${esc(slice.label)} — ${slice.value} (${pctValue}%)</text>`,
    );
    ly += 16;
  });

  return parts.join("\n");
}

function monthShort(key: string): string {
  return key.slice(5);
}

/** Genera un reporte SVG (apto para @resvg/resvg-js). */
export function buildMetricsSvg(
  metrics: AutomationMetrics,
  opts: SvgOptions,
): MetricsSvg {
  const width = 1040;
  const pad = 40;
  const inner = width - pad * 2;
  let y = 0;
  const parts: string[] = [];

  const addText = (
    x: number,
    ty: number,
    text: string,
    size: number,
    color: string,
    weight = 400,
    anchor: "start" | "middle" | "end" = "start",
  ) => {
    parts.push(
      `<text x="${x}" y="${ty}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(text)}</text>`,
    );
  };

  // Header
  y += 56;
  addText(pad, y, "Métricas de automatizaciones", 26, C.ink, 700);
  y += 24;
  addText(
    pad,
    y,
    `${windowLabel(metrics.window.days)} · datos al ${opts.generatedAt.toLocaleString("es-AR")}`,
    14,
    C.muted,
  );

  // KPI grid (2 filas x 4)
  y += 28;
  const kpis: KpiBox[] = [
    {
      label: "Total histórico",
      value: String(metrics.totals.total),
      sub: "casos registrados",
      color: C.secondary,
    },
    {
      label: "En curso (WIP)",
      value: String(metrics.totals.active),
      sub: "activos sin cierre local",
      color: C.info,
    },
    {
      label: "Finalizadas",
      value: String(metrics.totals.finalized),
      sub: "casos resueltos",
      color: C.success,
    },
    {
      label: "Tiempo de ciclo (mediana)",
      value: days(metrics.leadTime.medianDays),
      sub: `${metrics.leadTime.sample} finalizadas`,
      color: C.accent,
    },
    {
      label: "Tiempo de ciclo (p90)",
      value: days(metrics.leadTime.p90Days),
      sub: `promedio ${days(metrics.leadTime.averageDays)}`,
      color: C.body,
    },
    {
      label: "Cumplimiento fecha estimada",
      value: pct(metrics.sla.onTimeRate),
      sub: `${metrics.sla.sample} con fecha`,
      color: C.info,
    },
    {
      label: "Ritmo de cierre",
      value:
        metrics.pace.finalizedPerWeek === null
          ? "—"
          : `${metrics.pace.finalizedPerWeek}/sem`,
      sub:
        metrics.pace.etaWeeks === null
          ? "sin proyección"
          : `WIP se vacía en ${metrics.pace.etaWeeks} sem`,
      color: C.secondary,
    },
    {
      label: "Tiempo trabajado (mediana)",
      value: days(metrics.time.medianActiveDays),
      sub: `${metrics.time.sampleActive} con días activos`,
      color: C.warning,
    },
  ];

  const boxGap = 16;
  const boxW = (inner - boxGap * 3) / 4;
  const boxH = 92;
  kpis.forEach((kpi, index) => {
    const col = index % 4;
    const rowIndex = Math.floor(index / 4);
    const bx = pad + col * (boxW + boxGap);
    const by = y + rowIndex * (boxH + boxGap);
    parts.push(
      `<rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" rx="10" fill="${C.box}" stroke="${C.line}" />`,
    );
    addText(bx + 16, by + 26, kpi.label, 12, C.muted, 600);
    addText(bx + 16, by + 54, kpi.value, 22, kpi.color, 700);
    addText(bx + 16, by + 76, kpi.sub, 11, C.faint);
  });
  y += boxH * 2 + boxGap + 36;

  // Casos por mes (línea)
  const throughput: MonthlyThroughput[] = metrics.throughput;
  addText(pad, y, "Casos por mes", 16, C.ink, 700);
  y += 8;
  const lineH = 150;
  if (throughput.length > 0) {
    parts.push(
      svgLineChart(
        pad,
        y,
        inner,
        lineH,
        throughput.map((m) => monthShort(m.month)),
        [
          {
            name: "Creadas",
            color: C.secondary,
            values: throughput.map((m) => m.created),
          },
          {
            name: "Finalizadas",
            color: C.success,
            values: throughput.map((m) => m.finalized),
          },
        ],
      ),
    );
  }
  y += lineH + 8;
  addText(pad, y, "■ Creadas", 11, C.secondary);
  addText(pad + 70, y, "■ Finalizadas", 11, C.success);
  y += 34;

  // Tiempo de ciclo por mes (línea)
  const lead: MonthlyLeadTime[] = metrics.leadTimeByMonth;
  addText(pad, y, "Tiempo de ciclo por mes (mediana)", 16, C.ink, 700);
  y += 8;
  if (lead.length > 0) {
    parts.push(
      svgLineChart(
        pad,
        y,
        inner,
        lineH,
        lead.map((m) => monthShort(m.month)),
        [
          {
            name: "Mediana",
            color: C.accent,
            values: lead.map((m) => m.medianDays ?? 0),
          },
        ],
      ),
    );
  }
  y += lineH + 34;

  // Donuts: región + SLA
  const halfW = inner / 2 - 20;
  const donutRadius = 66;
  addText(pad, y, "Por región", 14, C.ink, 700);
  addText(pad + halfW + 40, y, "Cumplimiento de fecha estimada", 14, C.ink, 700);
  y += 12;
  const regionSlices = metrics.byRegion
    .slice(0, 6)
    .map((group) => ({ label: group.label, value: group.total }));
  parts.push(svgDonut(pad, y, donutRadius, regionSlices));

  const onTime = metrics.sla.onTime;
  const late = Math.max(0, metrics.sla.sample - onTime);
  parts.push(
    svgDonut(pad + halfW + 40, y, donutRadius, [
      { label: "En fecha", value: onTime },
      { label: "Fuera de fecha", value: late },
    ]),
  );
  y += donutRadius * 2 + 40;

  // Footer
  parts.push(
    `<line x1="${pad}" y1="${y}" x2="${pad + inner}" y2="${y}" stroke="${C.line}" />`,
  );
  y += 20;
  addText(
    pad,
    y,
    "Datos calculados sobre el historial local del portal (automation_parents + activity_days). El estado puede tener minutos de desfase respecto de InvGate.",
    10,
    C.faint,
  );
  y += 30;

  const height = y;
  const svg = `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${parts.join("\n")}
</svg>`;

  return { svg, width, height };
}
