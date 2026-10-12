/**
 * Formato de valores de métricas, compartido entre la página
 * (`MetricsContent.astro`) y el export (`metricsExport.ts`) para no divergir.
 */

export function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value} ${value === 1 ? "día" : "días"}`;
}

export function formatPct(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${value}%`;
}
