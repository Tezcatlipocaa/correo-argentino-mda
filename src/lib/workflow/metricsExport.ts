import type { AutomationMetrics, GroupStat } from "./metrics";
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

export function windowLabel(days: number | null): string {
  if (days === null) return WINDOW_LABELS.all;
  return WINDOW_LABELS[String(days)] ?? `Últimos ${days} días`;
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
    ["Resumen", "Finalizadas por portal", String(metrics.totals.finalizedByPortal)],
    ["Resumen", "Finalizadas en InvGate", String(metrics.totals.finalizedInInvGate)],
    ["Tiempo de ciclo", "Muestra", String(metrics.leadTime.sample)],
    ["Tiempo de ciclo", "Mediana (días)", days(metrics.leadTime.medianDays)],
    ["Tiempo de ciclo", "Promedio (días)", days(metrics.leadTime.averageDays)],
    ["Tiempo de ciclo", "P90 (días)", days(metrics.leadTime.p90Days)],
    ["SLA", "Muestra", String(metrics.sla.sample)],
    ["SLA", "On-time", String(metrics.sla.onTime)],
    ["SLA", "Cumplimiento", pct(metrics.sla.onTimeRate)],
    ["SLA", "Desvío promedio (días)", days(metrics.sla.avgDeviationDays)],
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
  rows.push(...(groupRows("Mesa", metrics.byMesa) as [string, string, string][]));
  for (const month of metrics.throughput) {
    rows.push([
      "Casos por mes",
      `${month.month} · creados`,
      String(month.created),
    ]);
    rows.push([
      "Casos por mes",
      `${month.month} · finalizados`,
      String(month.finalized),
    ]);
  }

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [
    ["Sección", "Indicador", "Valor"],
    ...rows,
  ]
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

  // Colores de la paleta institucional (tema claro) para el reporte.
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
    error: "#b3474d",
  } as const;

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
      sub: `${metrics.totals.finalizedByPortal} portal · ${metrics.totals.finalizedInInvGate} InvGate`,
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
      label: "Cierre por el portal",
      value: pct(metrics.portalShare),
      sub: "del total finalizado",
      color: C.secondary,
    },
    {
      label: "Activo más antiguo",
      value: days(metrics.oldestActive?.days ?? null),
      sub: metrics.oldestActive?.displayName ?? "sin casos en curso",
      color: C.error,
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

  // Barras de casos por mes
  const maxThroughput = Math.max(
    1,
    ...metrics.throughput.flatMap((m) => [m.created, m.finalized]),
  );
  addText(pad, y, "Casos por mes", 16, C.ink, 700);
  y += 20;
  const chartH = 120;
  const barGap = (inner - 12 * 2) / 12;
  const barW = Math.min(28, barGap * 0.32);
  const baseY = y + chartH;
  metrics.throughput.forEach((month, index) => {
    const cx = pad + index * barGap + barGap / 2;
    const createdH = (month.created / maxThroughput) * (chartH - 24);
    const finalizedH = (month.finalized / maxThroughput) * (chartH - 24);
    parts.push(
      `<rect x="${cx - barW - 1}" y="${baseY - createdH}" width="${barW}" height="${createdH}" rx="2" fill="${C.secondary}" />`,
    );
    parts.push(
      `<rect x="${cx + 1}" y="${baseY - finalizedH}" width="${barW}" height="${finalizedH}" rx="2" fill="${C.success}" />`,
    );
    addText(
      cx,
      baseY + 14,
      month.month.slice(5),
      10,
      C.muted,
      400,
      "middle",
    );
  });
  parts.push(
    `<line x1="${pad}" y1="${baseY}" x2="${pad + inner}" y2="${baseY}" stroke="${C.line}" />`,
  );
  y = baseY + 34;
  addText(pad, y, "■ Creadas", 11, C.secondary);
  addText(pad + 70, y, "■ Finalizadas", 11, C.success);
  y += 34;

  // Region / Mesa summary
  const addGroupList = (
    title: string,
    groups: readonly GroupStat[],
    x: number,
  ) => {
    addText(x, y, title, 14, C.ink, 700);
    let ty = y + 22;
    if (groups.length === 0) {
      addText(x, ty, "Sin datos.", 12, C.faint);
      return;
    }
    for (const group of groups.slice(0, 6)) {
      addText(
        x,
        ty,
        `${group.label}`,
        12,
        C.body,
        600,
      );
      addText(
        x + 240,
        ty,
        `total ${group.total} · activos ${group.active} · mediana ${days(group.medianLeadDays)}`,
        11,
        C.muted,
      );
      ty += 18;
    }
  };
  addGroupList("Por región", metrics.byRegion, pad);
  addGroupList("Por mesa", metrics.byMesa, pad + inner / 2);
  y += 18 * 6 + 40;

  // Footer
  parts.push(
    `<line x1="${pad}" y1="${y}" x2="${pad + inner}" y2="${y}" stroke="${C.line}" />`,
  );
  y += 20;
  addText(
    pad,
    y,
    "Datos calculados sobre el historial local del portal (automation_parents). El estado puede tener minutos de desfase respecto de InvGate.",
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
