// ============================================================
// TOGGLE: true = QA (crear tickets de prueba en entorno QA)
//         false = PROD (crear tickets reales en entorno productivo)
// ============================================================
export const USE_QA_INVGATE = true;

// --- Helpdesk (mismo ID en QA y producción) ---
/** Helpdesk: Mesa de Ayuda Operación Telegráfica (id fijo ya conocido) */
export const TELEGRAFIA_HELPDESK_ID = 5994;

// --- Categoría ---
/** QA: Portal MDA > General */
const QA_CATEGORY_ID = 68;

/** PROD: STS- Problema con agentes
 *  Ruta: Mesa de Ayuda TI → Accesos y Aplicaciones → Distribución → STS → Fallas → STS- Problema con agentes
 *  PENDIENTE: buscar el ID real en producción con GET /api/v1/categories
 */
const PROD_CATEGORY_ID = 0; // ← REEMPLAZAR con el ID real de producción

export const AGENTS_TICKET_CATEGORY_ID = USE_QA_INVGATE
  ? QA_CATEGORY_ID
  : PROD_CATEGORY_ID;

// --- IDs de usuario de prueba (solo QA) ---
export const QA_CUSTOMER_ID = 6;
export const QA_CREATOR_ID = 6;

// --- Prioridad ---
export const AGENTS_TICKET_PRIORITY_ID = 1; // Low

// --- Título fijo del ticket ---
export const AGENTS_TICKET_TITLE = "STS - Desconexión de agentes";

export function buildTicketDescription(
  officeName: string,
  officeCode: string,
  notes?: string,
): string {
  const noteSection = notes?.trim()
    ? `<tr><td style="padding:6px 12px;font-weight:bold;text-transform:uppercase;background-color:#f1f5f9;border:1px solid #e2e8f0;">Notas</td><td style="padding:6px 12px;background-color:#ffffff;border:1px solid #e2e8f0;">${escapeHtml(notes.trim())}</td></tr>`
    : "";

  return `Se comunican desde OPT y reportan problemas con los agentes.<br><br><table style="width:100%;max-width:600px;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;"><tr><td style="padding:6px 12px;font-weight:bold;text-transform:uppercase;width:180px;background-color:#f1f5f9;border:1px solid #e2e8f0;">OFICINA AFECTADA</td><td style="padding:6px 12px;background-color:#ffffff;border:1px solid #e2e8f0;">${escapeHtml(officeName)}</td></tr><tr><td style="padding:6px 12px;font-weight:bold;text-transform:uppercase;background-color:#f1f5f9;border:1px solid #e2e8f0;">NIS</td><td style="padding:6px 12px;background-color:#ffffff;border:1px solid #e2e8f0;">${escapeHtml(officeCode)}</td></tr>${noteSection}</table>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
