/**
 * Normalización de etiquetas de workflow compartida entre matcher de etapas
 * y scripts de mantenimiento.
 */

/** Marcadores ordinales iniciales que InvGate agrega a réplicas ("1° ", "2do ", "1°er "). */
export const LEADING_ORDINAL_RE =
  /^\s*\d+\s*[°º]?\s*(?:er|ro|do|to|vo)?\b\.?\s*|^\s*\d+\s*[°º]\s*/i;

/**
 * Prefijos numéricos de jerarquía del workflow AUTSUC: "1-Equipamiento",
 * "1.1-Equipamiento - Server". Sin separador " - ", matchean plantillas por
 * el tramo restante.
 */
export const LEADING_HIERARCHY_NUMBER_RE = /^\s*\d+(?:\.\d+)*[-\s]+\s*/;

export function normalizeLabel(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .replace(/º/g, "°")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normaliza texto para comparación: sin acentos, minúsculas y espacios colapsados. */
export function normalizeForCompare(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-AR");
}

export function stripLeadingOrdinals(normalized: string): string {
  let stripped = normalized;
  // Puede haber marcadores compuestos: "1° 2do" no ocurre en la práctica;
  // un solo paso de strip es suficiente.
  stripped = stripped.replace(LEADING_ORDINAL_RE, "");
  // El prefijo jerárquico "1-Equipamiento"/"1.1-Equipamiento" del workflow
  // AUTSUC encadena la numeración de etapa, no forma parte de la etiqueta.
  stripped = stripped.replace(LEADING_HIERARCHY_NUMBER_RE, "");
  return stripped.trim();
}
