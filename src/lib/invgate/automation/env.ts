/**
 * Lectura de variables de entorno del servidor con el mismo patrón que
 * `@lib/invgateClient` (import.meta.env primero, process.env como fallback),
 * disponible tanto en dev (Vite) como en el build standalone de Node.
 */
export function getServerEnv(key: string): string {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const val = (import.meta.env as Record<string, unknown>)[key];
    if (val && typeof val === "string") return val;
  }
  return process.env[key] || "";
}
