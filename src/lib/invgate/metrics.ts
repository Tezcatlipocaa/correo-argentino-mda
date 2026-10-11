/**
 * Contador in-process de llamadas a la API de InvGate, para medir el consumo
 * y el impacto de los caches. Los contadores siempre se actualizan (baratos);
 * el logging se activa con `INVGATE_METRICS=1`.
 */
const counters = new Map<string, number>();
let total = 0;

/** Lee la env runtime-first (dotenv en el server) y fallback a import.meta en dev. */
function readEnv(key: string): string {
  const runtime = process.env[key];
  if (typeof runtime === "string" && runtime.length > 0) return runtime;

  if (typeof import.meta !== "undefined" && import.meta.env) {
    const val = (import.meta.env as Record<string, unknown>)[key];
    if (typeof val === "string") return val;
  }
  return "";
}

export function isInvGateMetricsEnabled(): boolean {
  const raw = readEnv("INVGATE_METRICS");
  return raw === "1" || raw.toLowerCase() === "true";
}

/** Registra una llamada; agrupa por endpoint sin query string. */
export function recordInvGateCall(endpoint: string): void {
  const key = endpoint.split("?")[0];
  counters.set(key, (counters.get(key) ?? 0) + 1);
  total += 1;
}

export function getInvGateMetrics(): {
  total: number;
  byEndpoint: Record<string, number>;
} {
  return { total, byEndpoint: Object.fromEntries(counters) };
}

export function resetInvGateMetrics(): void {
  counters.clear();
  total = 0;
}
