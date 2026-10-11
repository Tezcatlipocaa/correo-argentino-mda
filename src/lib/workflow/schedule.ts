/**
 * Fecha programada embebida en la descripción de un ticket: "programar
 * instalaciones para el día 6 oct 2026", "Esperando fecha 07 oct. 2026".
 * Se usa para enriquecer el estado de espera de un nodo.
 */
const SCHEDULED_DATE_RE =
  /(?:d[íi]a|fecha)\s*(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ]{3,})\.?\s*(?:de\s+)?(\d{4})/i;

export function parseScheduledDate(
  text: string | null | undefined,
): string | null {
  if (!text) {
    return null;
  }
  const plain = text.replace(/\u00a0/g, " ");
  const match = SCHEDULED_DATE_RE.exec(plain);
  if (!match) {
    return null;
  }
  return `${Number(match[1])} ${match[2].slice(0, 3).toLowerCase()} ${match[3]}`;
}

/** Franja horaria embebida: "Horario: 10 a 17hs". */
const OPENING_HOURS_RE =
  /Horario[:\s]*([0-9]{1,2}(?:[:.][0-9]{2})?\s*(?:a|hs|-)\s*[0-9]{1,2}(?:[:.][0-9]{2})?\s*(?:hs)?)/i;

export function parseOpeningHours(
  text: string | null | undefined,
): string | null {
  if (!text) {
    return null;
  }
  const plain = text.replace(/\u00a0/g, " ").replace(/<[^>]+>/g, " ");
  const match = OPENING_HOURS_RE.exec(plain);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}
