import type { CoachingFeedback } from "../ai/types.js";

/**
 * Limpia prefijos redundantes de proveedor como `opencode:opencode/`, `opencode/` o `opencode:`
 * y sufijos como `-free`, `:free` o `(free)` para dejar visible únicamente el nombre del modelo.
 */
export function cleanModelName(modelName?: string): string {
  if (!modelName) return "";
  return modelName
    .replace(/^(?:opencode[:/])+/gi, "")
    .replace(/(?:[-_: ]*\(?free\)?)$/gi, "")
    .trim();
}

/**
 * Formatea el objeto de coaching de la IA en un texto estructurado y legible
 * para ser presentado al supervisor y transmitido como devolución al operador.
 */
export function formatCoachingText(
  coaching?: CoachingFeedback | null,
  modelName?: string,
): string {
  if (!coaching) return "";

  const fortalezas = Array.isArray(coaching.fortalezas)
    ? coaching.fortalezas.filter((f) => typeof f === "string" && f.trim().length > 0)
    : [];
  const oportunidades = Array.isArray(coaching.oportunidades)
    ? coaching.oportunidades.filter((o) => typeof o === "string" && o.trim().length > 0)
    : [];
  const respuestaModelo =
    typeof coaching.respuestaModelo === "string" ? coaching.respuestaModelo.trim() : "";

  if (fortalezas.length === 0 && oportunidades.length === 0 && !respuestaModelo) {
    return "";
  }

  const cleanModel = cleanModelName(modelName);
  const header = cleanModel
    ? `[Asistente IA - ${cleanModel}]:`
    : "[Asistente IA]:";

  const sections: string[] = [header];

  if (fortalezas.length > 0) {
    sections.push("• Fortalezas:\n" + fortalezas.map((f) => `  - ${f}`).join("\n"));
  }

  if (oportunidades.length > 0) {
    sections.push(
      "• Oportunidades de mejora:\n" + oportunidades.map((o) => `  - ${o}`).join("\n"),
    );
  }

  if (respuestaModelo) {
    sections.push(`• Sugerencia modelo de redacción/atención:\n  "${respuestaModelo}"`);
  }

  return sections.join("\n\n");
}
