import { getChannelParameters } from "@/config/qualityParams";
import { cleanHtmlText } from "@/lib/titleNormalizer";
import type { ChannelType } from "@/types/quality";
import type { ExtractedQualityMetadata } from "@/lib/qualityMetadataFetcher";
import { AiResponseSchema, type AiEvaluationOptions, type AiVerdict, type AiResponse } from "@/lib/ai/types";
import { getAiProvider } from "@/lib/ai/providerFactory";

export { AiVerdict };

/**
 * Criterios que YA resuelve una regla determinista en NewAuditForm
 * (título, origen, ortografía, SLAs). La IA no los toca.
 */
const RULE_BASED_SUFFIXES = ["titulo", "origen", "ortografia", "sla_90min", "sla_resolucion", "sla_primera_respuesta"];
const NEVER_EVALUATE = new Set(["call_ticket_reclamo_novedad", "email_mda_reclamo_novedad", "email_solicitud"]);

/** Fase 1 (solo texto): se evalúa lo que sale del ticket InvGate, no de la llamada ni del cuerpo del mail. */
function isTextEvaluable(channel: ChannelType, section: string, code: string): boolean {
  if (NEVER_EVALUATE.has(code)) return false;
  if (RULE_BASED_SUFFIXES.some((s) => code.endsWith(`_${s}`))) return false;
  if (channel === "wise_call") return section === "ticket";
  if (channel === "wise_email") return section === "mda";
  return true; // invgate_ticket: items y mda salen del ticket
}

export interface AiCriterion {
  code: string;
  name: string;
  weight: number | null;
  hint: string;
}

const HINTS: Array<[RegExp, string]> = [
  [/categorizacion_final$/, "La categoría final del ticket corresponde a la solución efectivamente aplicada, y es específica."],
  [/categorizacion$/, "La categoría es específica (no genérica ni 'Sin categoría') y coherente con el problema descrito."],
  [/correccion_tipo$|_tipo$/, "El tipo de solicitud (incidente vs solicitud) es coherente con lo descrito. Si no hay dato de tipo, cumple=null."],
  [/correccion_prioridad$|_prioridad$/, "La prioridad es coherente con el impacto/urgencia descritos (no todo es Media por defecto)."],
  [/descripcion$/, "La descripción es clara y trae evidencia suficiente: qué pasa, dónde, a quién, mensajes de error o pasos."],
  [/exactitud_datos$/, "Los datos del caso (solicitante, ubicación, contacto, equipo) están completos y son consistentes entre campos."],
  [/seguimiento$/, "El operador informó al usuario, hizo seguimiento y documentó la resolución en los comentarios."],
  [/analisis$/, "El operador interpretó correctamente la solicitud según lo que se ve en los comentarios."],
  [/sondeo$/, "El operador hizo preguntas o pruebas para diagnosticar antes de resolver o derivar."],
  [/procedimiento$/, "La gestión sigue el procedimiento esperado (derivación correcta, pasos documentados)."],
  [/documentacion$/, "La gestión está documentada con claridad en los comentarios del ticket."],
  [/info_complementaria$/, "El ticket incluye información complementaria útil (adjuntos, datos de contacto, referencias)."],
];

export function getAiCriteria(channel: ChannelType): AiCriterion[] {
  return getChannelParameters(channel)
    .filter((p) => isTextEvaluable(channel, p.section, p.code))
    .map((p) => ({
      code: p.code,
      name: p.name,
      weight: p.weight ?? null,
      hint: HINTS.find(([re]) => re.test(p.code))?.[1] ?? "Evalúa según el nombre del criterio.",
    }));
}

// --- Contexto del ticket -----------------------------------------------------

const MAX_CONTEXT_CHARS = 20000;

function pickCommentText(c: any): string {
  return cleanHtmlText(String(c?.message ?? c?.comment ?? c?.content ?? c?.text ?? c?.body ?? "")).trim();
}

export function buildTicketContext(meta: ExtractedQualityMetadata, rawIncident?: any): string {
  const lines: string[] = [
    `Ticket #${meta.caseNumber}`,
    `Título: ${meta.title || "-"}`,
    `Descripción: ${meta.description || "-"}`,
    `Categoría: ${meta.category || "-"}`,
    `Prioridad: ${meta.priority || "-"}`,
    `Tipo (type_id): ${rawIncident?.type_id ?? "sin dato"}`,
    `Estado: ${meta.status || "-"}`,
    `Origen: ${meta.source || "-"}`,
    `Mesa: ${meta.helpdesk || "-"}`,
    `Solicitante: ${meta.customer || "-"}`,
    `Creado por: ${meta.createdBy || "-"}`,
    `Operador: ${meta.operator || "-"}`,
    `Creado: ${meta.creationTime || "-"}`,
    `Tiempo hasta primera toma: ${meta.takeTime || "-"}`,
    `SLA primera respuesta: ${meta.rawDetails?.slaIncidentFirstReply ?? "-"}`,
    `SLA resolución: ${meta.rawDetails?.slaIncidentResolution ?? "-"}`,
  ];

  const rawComments = Array.isArray(rawIncident?.comments)
    ? rawIncident.comments
    : rawIncident?.comments && typeof rawIncident.comments === "object"
      ? Object.values(rawIncident.comments)
      : [];
  const comments = rawComments
    .map((c: any) => ({
      autor: c?.author?.name ?? c?.user?.name ?? (c?.user_id ? `usuario ${c.user_id}` : "?"),
      fecha: c?.created_at ?? c?.date ?? "",
      texto: pickCommentText(c),
    }))
    .filter((c: { texto: string }) => c.texto)
    .slice(-40);

  lines.push("", `Comentarios (${comments.length}):`);
  for (const c of comments) lines.push(`- [${c.fecha}] ${c.autor}: ${c.texto}`);
  if (comments.length === 0) lines.push("(sin comentarios)");

  return lines.join("\n").slice(0, MAX_CONTEXT_CHARS);
}

export function buildPrompt(criteria: AiCriterion[], ticketContext: string): string {
  const list = criteria.map((c) => `- ${c.code} | ${c.name} | ${c.hint}`).join("\n");
  return [
    "Sos auditor de calidad de la Mesa de Ayuda TI de Correo Argentino.",
    "Tu tarea es:",
    "1. Escribir un resumen ejecutivo (máx 2-3 oraciones) de la atención brindada en el campo 'resumen'.",
    "2. Evaluar SOLO los criterios listados, basándote EXCLUSIVAMENTE en los datos del ticket. No inventes hechos.",
    'Para cada criterio devolvé "cumple": true, false, o null si NO hay evidencia suficiente (null no penaliza).',
    '"confianza" es un número entre 0 y 1.',
    '"evidencia" es una cita textual concreta del ticket o comentario (máx 160 caracteres).',
    '"razonamiento" explica brevemente por qué cumple o no cumple con el estándar esperado (máx 180 caracteres).',
    "No uses herramientas ni leas otros archivos. Respondé ÚNICAMENTE con JSON válido, sin bloques markdown ni texto extra, con esta forma exacta:",
    '{"resumen":"El operador atendió la solicitud...","resultados":[{"codigo":"<code>","cumple":true,"confianza":0.85,"evidencia":"...","razonamiento":"..."}]}',
    "",
    "CRITERIOS (codigo | nombre | qué se evalúa):",
    list,
    "",
    "DATOS DEL TICKET:",
    ticketContext,
  ].join("\n");
}

let inFlight = 0;
const MAX_IN_FLIGHT = 2;

export function parseVerdicts(modelText: string, allowedCodes: Set<string>): { resumen: string; verdicts: AiVerdict[] } {
  const cleaned = modelText.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("El modelo no devolvió JSON.");
  
  const parsed = AiResponseSchema.parse(JSON.parse(cleaned.slice(start, end + 1)));
  const seen = new Set<string>();
  const filteredVerdicts = parsed.resultados.filter((r) => {
    if (!allowedCodes.has(r.codigo) || seen.has(r.codigo)) return false;
    seen.add(r.codigo);
    return true;
  });

  return {
    resumen: parsed.resumen || "",
    verdicts: filteredVerdicts,
  };
}

export class AiBusyError extends Error {}

export async function evaluateWithAi(
  channel: ChannelType,
  meta: ExtractedQualityMetadata,
  rawIncident?: any,
  options?: AiEvaluationOptions,
): Promise<{ model: string; resumen: string; verdicts: AiVerdict[] }> {
  const criteria = getAiCriteria(channel);
  if (criteria.length === 0) return { model: "", resumen: "", verdicts: [] };
  if (inFlight >= MAX_IN_FLIGHT) throw new AiBusyError("Hay evaluaciones IA en curso. Reintentá en unos segundos.");

  inFlight++;
  try {
    const provider = getAiProvider(options);
    const prompt = buildPrompt(criteria, buildTicketContext(meta, rawIncident));
    const rawOutput = await provider.evaluate(prompt);
    const { resumen, verdicts } = parseVerdicts(rawOutput, new Set(criteria.map((c) => c.code)));

    return {
      model: provider.name,
      resumen,
      verdicts,
    };
  } finally {
    inFlight--;
  }
}
