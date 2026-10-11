/**
 * Lectura de variables de entorno del servidor, runtime-first: `process.env`
 * (cargado por `server.mjs` vía dotenv) gana sobre `import.meta.env` de
 * build-time, que en el bundle SSR solo contiene las claves referenciadas
 * estáticamente (las lecturas dinámicas quedan vacías). Mismo patrón que
 * `SESSION_COOKIE_SECURE` en `@lib/session`.
 */
export function getServerEnv(key: string): string {
  const runtime = process.env[key];
  if (runtime && typeof runtime === "string") return runtime;

  if (typeof import.meta !== "undefined" && import.meta.env) {
    const val = (import.meta.env as Record<string, unknown>)[key];
    if (val && typeof val === "string") return val;
  }
  return "";
}
