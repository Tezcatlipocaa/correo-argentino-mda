import type { APIRoute } from "astro";
import { jsonResponse, jsonError, sanitizeError } from "@/lib/apiResponse";
import { requireWriteAccess } from "@/lib/rbac-middleware";
import { fetchInvgateTicketMetadata, fetchQualityCaseMetadata } from "@/lib/qualityMetadataFetcher";
import { AiBusyError, evaluateWithAi } from "@/lib/qualityAiEvaluator";
import { evaluateWithCouncil } from "@/lib/ai/councilEvaluator";
import { fetchAudioBuffer, transcribeAudioWithGroq, getGroqApiKey } from "@/lib/ai/groqWhisper";
import { extractTicketReferences, type DetectedTicketReference } from "@/lib/ai/ticketExtractor";
import type { ReclamoNovedadSignal, CoachingFeedback } from "@/lib/ai/types";
import { CHANNEL_TYPES, type ChannelType } from "@/types/quality";

/**
 * Modelos OpenCode permitidos en producción / pruebas.
 * Evita inyección de comandos o argumentos arbitrarios al CLI.
 */
export const ALLOWED_MODELS = new Set([
  "council",
  "opencode/nemotron-3.5-lightning-free",
  "opencode/deepseek-v4.1-flash-free",
  "opencode/mimo-v2.6-flash-free",
  "opencode/glm-5.3-flash-free",
]);

export interface BuildAiPayloadParams {
  model: string;
  isCouncil?: boolean;
  hasAudioTranscript?: boolean;
  hasEmailThread?: boolean;
  resumen: string;
  verdicts: any[];
  debate?: Record<string, any>;
  reclamoSignal?: ReclamoNovedadSignal;
  detectedTickets?: DetectedTicketReference[];
  coaching?: CoachingFeedback | null;
}

export function buildAiEvaluationPayload(params: BuildAiPayloadParams) {
  return {
    ok: true,
    model: params.model,
    ...(params.isCouncil ? { isCouncil: true } : {}),
    hasAudioTranscript: Boolean(params.hasAudioTranscript),
    hasEmailThread: Boolean(params.hasEmailThread),
    resumen: params.resumen,
    verdicts: params.verdicts,
    ...(params.debate ? { debate: params.debate } : {}),
    ...(params.reclamoSignal ? { reclamoSignal: params.reclamoSignal } : {}),
    ...(params.detectedTickets && params.detectedTickets.length > 0 ? { detectedTickets: params.detectedTickets } : {}),
    ...(params.coaching ? { coaching: params.coaching } : {}),
  };
}

/**
 * Evalúa con IA (OpenCode + modelo free o Council multi-agente) los criterios de calidad que salen del
 * ticket InvGate y de la llamada telefónica (transcripción Groq Whisper si recordingUrl está presente)
 * o del hilo de correo electrónico de Wise CX.
 * Solo sugiere: el supervisor decide.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const perm = await requireWriteAccess(locals, "calidad");
    if (perm) return perm;

    const body = await request.json().catch(() => null);
    const channel = body?.channel as ChannelType;
    const ticketId = String(body?.ticketId ?? "").replace("#", "").trim();
    const rawModel = typeof body?.model === "string" ? body.model.trim() : undefined;
    const recordingUrl = typeof body?.recordingUrl === "string" ? body.recordingUrl.trim() : undefined;
    const wiseCaseId = typeof body?.wiseCaseId === "string" ? body.wiseCaseId.trim() : undefined;

    if (!channel || !CHANNEL_TYPES.includes(channel)) return jsonError("Canal inválido o no especificado", 400);
    if (!/^\d+$/.test(ticketId)) return jsonError("Ingresá un número de ticket InvGate válido.", 400);
    if (wiseCaseId && !/^[A-Za-z0-9_-]+$/.test(wiseCaseId)) return jsonError("Identificador Wise inválido", 400);

    const model = rawModel && ALLOWED_MODELS.has(rawModel) ? rawModel : undefined;

    // Solo 1 consulta a InvGate: fetchInvgateTicketMetadata ya trae incident en meta.data.raw
    const meta = await fetchInvgateTicketMetadata(ticketId);
    if (!meta.ok || !meta.data) return jsonError(meta.error || "No se pudo obtener el ticket", meta.status || 404);

    if (channel === "wise_email" && wiseCaseId) {
      try {
        const wiseRes = await fetchQualityCaseMetadata("wise_email", wiseCaseId);
        if (wiseRes.ok && wiseRes.data?.emailThread) {
          meta.data.emailThread = wiseRes.data.emailThread;
        } else {
          console.warn("[ai-evaluate] Sin hilo de correo Wise para caso:", wiseCaseId);
        }
      } catch (err) {
        console.warn("[ai-evaluate] Error al consultar caso Wise:", wiseCaseId, err);
      }
    }

    let audioTranscript: string | undefined;
    const groqKey = getGroqApiKey();
    if (channel === "wise_call" && recordingUrl && groqKey) {
      try {
        const audioBuffer = await fetchAudioBuffer(recordingUrl);
        const stt = await transcribeAudioWithGroq(audioBuffer);
        if (stt.text) {
          audioTranscript = stt.text;
        }
      } catch (err: any) {
        console.warn("[ai-evaluate] Fallback a solo texto (error transcripción audio Groq):", err?.message);
      }
    }

    // Extracción determinista de tickets mencionados en audio o hilo de correo
    const textSources: string[] = [];
    if (audioTranscript) textSources.push(audioTranscript);
    if (meta.data.emailThread?.messages) {
      for (const m of meta.data.emailThread.messages) {
        if (m.content) textSources.push(m.content);
      }
    }
    const combinedInteractionText = textSources.join("\n\n");
    const detectedTickets = extractTicketReferences(combinedInteractionText);

    if (model === "council") {
      const councilResult = await evaluateWithCouncil(
        channel,
        meta.data,
        meta.data.raw,
        undefined,
        audioTranscript,
      );
      return jsonResponse(
        buildAiEvaluationPayload({
          model: "council",
          isCouncil: true,
          hasAudioTranscript: Boolean(audioTranscript),
          hasEmailThread: Boolean(meta.data.emailThread?.hasOperatorReply),
          resumen: councilResult.resumen,
          verdicts: councilResult.verdicts,
          debate: councilResult.debate,
          reclamoSignal: councilResult.reclamoSignal,
          detectedTickets,
          coaching: councilResult.coaching,
        }),
      );
    }

    const { model: usedModel, resumen, verdicts, reclamoSignal, coaching } = await evaluateWithAi(
      channel,
      meta.data,
      meta.data.raw,
      { model, provider: "opencode", audioTranscript },
    );
    return jsonResponse(
      buildAiEvaluationPayload({
        model: usedModel,
        hasAudioTranscript: Boolean(audioTranscript),
        hasEmailThread: Boolean(meta.data.emailThread?.hasOperatorReply),
        resumen,
        verdicts,
        reclamoSignal,
        detectedTickets,
        coaching,
      }),
    );
  } catch (error) {
    if (error instanceof AiBusyError) return jsonError(error.message, 429);
    console.error("[ai-evaluate] Error:", error);
    return jsonError(sanitizeError(error, "No se pudo evaluar con IA."), 502);
  }
};
