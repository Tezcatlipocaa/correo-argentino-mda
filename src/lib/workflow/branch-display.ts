import { htmlToPlainText } from "@lib/format/html-to-text";
import { parseInitialForm } from "./initial-form";

/**
 * Nombre de la sucursal desde la description del ticket padre (formato
 * producción, 2026-09): "Sucursal: LIBERTAD - SUC GIROS (B0168) ..."
 * → "Libertad" (Title Case vía parseSucursalValue). Los padres de QA traen
 * el nombre en el título, así que esta fuente es el fallback complementario.
 */
export function branchNameFromDescription(
  description: string | undefined | null,
): string | null {
  if (!description) {
    return null;
  }
  const parsed = parseInitialForm(htmlToPlainText(description));
  return parsed?.sucursal?.name ?? null;
}

