import { normalizeForCompare } from "@lib/workflow/labels";

/**
 * Partes de un nombre de título del portal: "<servicio/CI> - <detalle>".
 * El pre-guión es el servicio/CI; el post-guión, el detalle de la gestión.
 */

/** Pre-guiones que no son un servicio/CI (acción genérica): se omiten del chip. */
const NON_SERVICE_PREFIXES = new Set(["cierre", "relevamiento"]);

export function splitTitleName(name: string): {
  service: string | null;
  detail: string;
} {
  const index = name.indexOf(" - ");
  if (index < 0) {
    return { service: null, detail: name.trim() };
  }
  const service = name.slice(0, index).trim();
  const detail = name.slice(index + 3).trim();
  return { service: service.length > 0 ? service : null, detail };
}

/** Servicio/CI para el chip: null si es un pre-guión genérico (Cierre, …). */
export function serviceChipLabel(name: string): string | null {
  const { service } = splitTitleName(name);
  if (!service) return null;
  if (NON_SERVICE_PREFIXES.has(normalizeForCompare(service))) return null;
  return service;
}
