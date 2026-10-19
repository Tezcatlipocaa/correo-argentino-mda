export interface DetectedTicketReference {
  ticketId: string;
  context: string;
  type: "nuevo" | "previo" | "ambiguo";
  confidence: number;
}

const PREVIO_KEYWORDS = /(?:anterior|previo|viejo|pasad[oa]|hace\s+d[ií]as|ya\s+llam[eé]|reiter|otra\s+vez|sigue\s+abierto|no\s+tuvo\s+soluci[oó]n)/i;
const NUEVO_KEYWORDS = /(?:gener|cre[oó]|abro|abr[ií]|registr|tome\s+nota|le\s+paso|su\s+n[uú]mero|qued[oó]\s+registrado|nuevo)/i;

/**
 * Extrae referencias a tickets InvGate de 5 a 7 dígitos a partir de texto libre
 * (transcripciones telefónicas de Whisper o cuerpos de hilos de correo).
 * Aplica precedencia estricta para descartar IPs, fechas, años, teléfonos y documentos.
 */
export function extractTicketReferences(text: string): DetectedTicketReference[] {
  if (!text || typeof text !== "string") return [];

  // 1. Enmascarar entidades que contengan secuencias numéricas a ignorar
  let sanitized = text
    // IPs (ej: 10.200.34.120)
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, " [IP_MASK] ")
    // Fechas (ej: 17/10/2026, 17-10-2026)
    .replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, " [DATE_MASK] ")
    // Años modernos (ej: 2020 a 2029)
    .replace(/\b202\d\b/g, " [YEAR_MASK] ")
    // Teléfonos 0800 / 0810 / 11 / prefijos comunes de 8 a 11 dígitos
    .replace(/\b0?[89]00\s*\d{3,4}\s*\d{3,4}\b/gi, " [PHONE_MASK] ")
    .replace(/\b(?:011|15|11)\s*\d{4,8}\b/gi, " [PHONE_MASK] ")
    .replace(/\b\d{10,11}\b/g, " [PHONE_MASK] ")
    // CUIL (ej: 20-38123456-2)
    .replace(/\b\d{2}[\-]\d{7,8}[\-]\d\b/g, " [CUIL_MASK] ")
    // DNI / CUIL / Legajo con prefijo contextual
    .replace(/(?:dni|documento|cuil|cuit|legajo)\s*[:#º°]?\s*\b\d{6,8}\b/gi, " [DOC_MASK] ");

  // 2. Búsqueda contextual de tickets (5 a 7 dígitos)
  // Anclaje a palabras clave comunes en MDA
  const ticketRegex = /(?:(?<prefix>ticket|incidente|caso|gesti[oó]n|novedad|reclamo|n[uú]m(?:ero)?\.?)\s*(?:n[uú]m(?:ero)?\.?)?\s*[:#º°]?|#)\s*(?<id>\b\d{5,7}\b)/gi;

  const results: DetectedTicketReference[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = ticketRegex.exec(sanitized)) !== null) {
    const ticketId = match.groups?.id;
    if (!ticketId || seen.has(ticketId)) continue;
    seen.add(ticketId);

    // Ventana contextual de 80 caracteres alrededor del match
    const startIdx = Math.max(0, match.index - 40);
    const endIdx = Math.min(sanitized.length, match.index + match[0].length + 40);
    const contextSnippet = text.slice(startIdx, endIdx).replace(/\s+/g, " ").trim();

    // Inferencia de tipo ("previo" vs "nuevo" vs "ambiguo")
    let type: "nuevo" | "previo" | "ambiguo" = "ambiguo";
    if (PREVIO_KEYWORDS.test(contextSnippet)) {
      type = "previo";
    } else if (NUEVO_KEYWORDS.test(contextSnippet)) {
      type = "nuevo";
    }

    results.push({
      ticketId,
      context: contextSnippet,
      type,
      confidence: 0.9,
    });
  }

  return results;
}
