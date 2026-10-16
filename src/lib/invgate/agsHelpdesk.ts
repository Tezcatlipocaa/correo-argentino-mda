/**
 * Mesa de InvGate donde vive la cola de autogestiones.
 *
 * Fuente única de verdad: antes el ID 3950 (QA) estaba hardcodeado en ~28
 * sitios, incluidos el ciclo automático y el filtro de operadores elegibles de
 * `getDisponibilidadHoy()`. Con las automatizaciones apagadas eso era inofensivo;
 * al encenderlas en producción hacía que el ciclo leyera la mesa de QA y
 * asignara operadores reales.
 *
 * Se resuelve por entorno (`INVGATE_AGENTS_HELPDESK_ID`). Default 3950 para no
 * romper el comportamiento previo en QA; producción define 2510 en el `.env`.
 */
function readHelpdeskIdFromEnv(): number {
  // Runtime-first (PM2/server.mjs con dotenv) y, si no existe, import.meta.env:
  // `astro dev` NO puebla process.env desde .env, solo import.meta.env.
  const raw =
    process.env.INVGATE_AGENTS_HELPDESK_ID ||
    (typeof import.meta !== "undefined" ? (import.meta.env as any)?.INVGATE_AGENTS_HELPDESK_ID : "");
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    console.warn(
      `[agsHelpdesk] INVGATE_AGENTS_HELPDESK_ID inválido ('${raw}'); se usa 3950.`
    );
  }
  return 3950;
}

export const AGS_HELPDESK_ID: number = readHelpdeskIdFromEnv();