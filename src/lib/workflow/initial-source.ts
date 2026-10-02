import type { ParsedInitialForm } from "./initial-form";

/**
 * Elección de la fuente del formulario inicial del detalle.
 *
 * Hoy conviven tres orígenes:
 * 1. Description del padre (formato histórico).
 * 2. Primer comentario del padre (formato QA / formularios por comentario).
 * 3. Description del hijo "Instalaciones para AUTSUC" (workflow AUTSUC nuevo).
 *
 * El problema real (B0177, 2026-10): el primer comentario es un aviso de otro
 * tema ("Se vincula tarea ... : #85967") que `parseInitialForm` interpreta como
 * un formulario "débil" (solo `otherFields`, sin sucursal). Ese resultado
 * bloqueaba el fallback al hijo Instalaciones, que es donde vive la sucursal.
 * La sucursal se toma como la señal autoritativa: si ninguna fuente previa la
 * trae y el hijo sí, gana el hijo.
 */

export interface InitialFormCandidate<T> {
  parsed: ParsedInitialForm | null;
  source: T;
}

export interface InitialFormCandidates<T> {
  description: InitialFormCandidate<T> | null;
  comment: InitialFormCandidate<T> | null;
  instalaciones: InitialFormCandidate<T> | null;
}

/**
 * Un formulario es "sustantivo" cuando trae alguno de los campos propios de la
 * plantilla (sucursal / jefe / rango IP / fecha estimada / jefe zonal). Un
 * parseo con solo `otherFields` (un comentario cualquiera con "label: valor")
 * no cuenta.
 */
export function hasSubstantiveForm(
  parsed: ParsedInitialForm | null,
): boolean {
  return (
    parsed !== null &&
    (parsed.sucursal !== null ||
      parsed.jefe !== null ||
      parsed.ipRange !== null ||
      parsed.estimatedEnd !== null ||
      parsed.jefeZonal !== null)
  );
}

/**
 * Devuelve la fuente ganadora (o `null` si no hay ninguna). Reglas:
 * - La description gana si es sustantiva.
 * - Si no, el primer comentario gana cuando aporta un form sustantivo, o
 *   cuando no había description (preserva el fallback de texto crudo).
 * - Si todavía no hay sucursal, el hijo Instalaciones gana (workflow AUTSUC).
 */
export function chooseInitialForm<T>(
  candidates: InitialFormCandidates<T>,
): InitialFormCandidate<T> | null {
  const { description, comment, instalaciones } = candidates;

  let chosen: InitialFormCandidate<T> | null = description;

  if ((chosen === null || !hasSubstantiveForm(chosen.parsed)) && comment) {
    if (chosen === null || hasSubstantiveForm(comment.parsed)) {
      chosen = comment;
    }
  }

  if ((chosen === null || chosen.parsed?.sucursal == null) && instalaciones?.parsed) {
    chosen = instalaciones;
  }

  return chosen;
}
