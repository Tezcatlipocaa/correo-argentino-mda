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

export interface ValidateAiEvaluateRequestParams {
  channel?: string | null;
  ticketId?: string | null;
  wiseCaseId?: string | null;
  recordingUrl?: string | null;
}

export function validateAiEvaluateParams(params: ValidateAiEvaluateRequestParams): {
  valid: boolean;
  error?: string;
  status?: number;
  cleanTicketId?: string;
  cleanWiseCaseId?: string;
  cleanRecordingUrl?: string;
} {
  const channel = params.channel as ChannelType;
  const ticketId = String(params.ticketId ?? "").replace("#", "").trim();
  const recordingUrl = typeof params.recordingUrl === "string" ? params.recordingUrl.trim() : undefined;
  const wiseCaseId = typeof params.wiseCaseId === "string" ? params.wiseCaseId.trim() : undefined;

  if (!channel || !CHANNEL_TYPES.includes(channel)) {
    return { valid: false, error: "Canal inválido o no especificado", status: 400 };
  }

  if (wiseCaseId && !/^[A-Za-z0-9_-]+$/.test(wiseCaseId)) {
    return { valid: false, error: "Identificador Wise inválido", status: 400 };
  }

  if (ticketId && !/^\d+$/.test(ticketId)) {
    return { valid: false, error: "Ingresá un número de ticket InvGate válido.", status: 400 };
  }

  if (!ticketId) {
    if (channel !== "wise_call") {
      return { valid: false, error: "Ingresá un número de ticket InvGate válido.", status: 400 };
    }
    if (!recordingUrl && !wiseCaseId) {
      return {
        valid: false,
        error: "Para evaluar una llamada sin ticket, ingresá el identificador de caso Wise o la URL de grabación.",
        status: 400,
      };
    }
  }

  return {
    valid: true,
    cleanTicketId: ticketId || undefined,
    cleanWiseCaseId: wiseCaseId || undefined,
    cleanRecordingUrl: recordingUrl || undefined,
  };
}

/**
 * Evalúa con IA (OpenCode + modelo free o Council multi-agente) los criterios de calidad que salen del
 * ticket InvGate y de la llamada telefónica (transcripción Groq Whisper si recordingUrl está presente)
 * o del hilo de correo electrónico de Wise CX.
 * Admite también la evaluación individual de llamadas telefónicas (wise_call) sin ticket InvGate asociado.
 * Solo sugiere: el supervisor decide.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const perm = await requireWriteAccess(locals, "calidad");
    if (perm) return perm;

    const body = await request.json().catch(() => null);

    const validation = validateAiEvaluateParams({
      channel: body?.channel,
      ticketId: body?.ticketId,
      wiseCaseId: body?.wiseCaseId,
      recordingUrl: body?.recordingUrl,
    });
    if (!validation.valid) {
      return jsonError(validation.error || "Petición inválida", validation.status || 400);
    }

    const channel = body?.channel as ChannelType;
    const ticketId = validation.cleanTicketId;
    const wiseCaseId = validation.cleanWiseCaseId;
    let recordingUrl = validation.cleanRecordingUrl;
    const rawModel = typeof body?.model === "string" ? body.model.trim() : undefined;
    const model = rawModel && ALLOWED_MODELS.has(rawModel) ? rawModel : undefined;
    const hasTicket = Boolean(ticketId);

    let meta: { ok: boolean; data?: any; error?: string; status?: number };

    if (ticketId) {
      // Solo 1 consulta a InvGate: fetchInvgateTicketMetadata ya trae incident en meta.data.raw
      meta = await fetchInvgateTicketMetadata(ticketId);
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
    } else {
      // Llamada sin ticket InvGate: se obtiene de Wise CX o se sintetizan metadatos básicos
      if (wiseCaseId) {
        const wiseRes = await fetchQualityCaseMetadata("wise_call", wiseCaseId);
        if (wiseRes.ok && wiseRes.data) {
          meta = wiseRes;
          if (!recordingUrl && wiseRes.data.recordingUrl) {
            recordingUrl = wiseRes.data.recordingUrl;
          }
        } else if (recordingUrl) {
          meta = {
            ok: true,
            data: {
              caseNumber: wiseCaseId,
              operator: "",
              date: new Date().toISOString().split("T")[0],
              recordingUrl,
              detectedChannel: "wise_call",
            },
          };
        } else {
          return jsonError(wiseRes.error || "No se pudo obtener el caso de Wise CX", wiseRes.status || 404);
        }
      } else if (recordingUrl) {
        meta = {
          ok: true,
          data: {
            caseNumber: "Llamada",
            operator: "",
            date: new Date().toISOString().split("T")[0],
            recordingUrl,
            detectedChannel: "wise_call",
          },
        };
      } else {
        return jsonError(
          "Para evaluar una llamada sin ticket, ingresá el identificador de caso Wise o la URL de grabación.",
          400,
        );
      }
    }

    if (!meta.ok || !meta.data) {
      return jsonError(meta.error || "No se pudieron obtener los datos para evaluar", meta.status || 404);
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

    // Si es una llamada sin ticket y no se obtuvo transcripción de audio, no hay evidencia que evaluar
    if (!ticketId && !audioTranscript) {
      if (!recordingUrl) {
        return jsonError("No se encontró la URL de grabación para la llamada.", 400);
      }
      if (!groqKey) {
        return jsonError("No se configuró la clave de Groq para transcribir el audio de la llamada.", 500);
      }
      return jsonError("No se pudo transcribir el audio de la llamada para realizar la evaluación.", 502);
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
        hasTicket ? undefined : [],
        audioTranscript,
        { hasTicket },
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
      { model, provider: "opencode", audioTranscript, hasTicket },
      hasTicket ? undefined : [],
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
