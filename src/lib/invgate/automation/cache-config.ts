import { getServerEnv } from "./env";

/**
 * TTLs configurables por env (en minutos) de los caches del módulo de
 * automatizaciones. Defaults pensados para monitoreo: el detalle tolera unos
 * minutos de desfase; tasks/solutions cambian poco; users/sectores casi nunca.
 */
function envMinutes(key: string, defaultValue: number): number {
  const raw = Number.parseInt(getServerEnv(key), 10);
  return Number.isInteger(raw) && raw > 0
    ? raw * 60_000
    : defaultValue * 60_000;
}

/** Snapshot persistido del detalle resuelto (min, default 5). */
export const detailPersistTtlMs = (): number =>
  envMinutes("AUTOMATION_DETAIL_TTL_MIN", 5);

/** Cache del progreso liviano de una card (min, default 2). */
export const progressTtlMs = (): number =>
  envMinutes("AUTOMATION_PROGRESS_TTL_MIN", 2);

/** Cache de tasks/solutions por ticket hijo (min, default 30). */
export const childCacheTtlMs = (): number =>
  envMinutes("AUTOMATION_CHILD_CACHE_TTL_MIN", 30);

/** Cache de nombres de usuarios y mapa de sectores (min, default 1440). */
export const usersCacheTtlMs = (): number =>
  envMinutes("AUTOMATION_USERS_CACHE_TTL_MIN", 1440);
