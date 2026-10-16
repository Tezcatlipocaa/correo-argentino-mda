import type { APIRoute } from "astro";
import { jsonResponse, jsonError, sanitizeError } from "@/lib/apiResponse";
import { requireWriteAccess } from "@/lib/rbac-middleware";
import { fetchInvgateTicketMetadata } from "@/lib/qualityMetadataFetcher";
import { AiBusyError, evaluateWithAi } from "@/lib/qualityAiEvaluator";
import { evaluateWithCouncil } from "@/lib/ai/councilEvaluator";
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

/**
 * Evalúa con IA (OpenCode + modelo free o Council multi-agente) los criterios de calidad que salen del
 * ticket InvGate y que no tienen regla determinista. Solo sugiere: el supervisor decide.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const perm = await requireWriteAccess(locals, "calidad");
    if (perm) return perm;

    const body = await request.json().catch(() => null);
    const channel = body?.channel as ChannelType;
    const ticketId = String(body?.ticketId ?? "").replace("#", "").trim();
    const rawModel = typeof body?.model === "string" ? body.model.trim() : undefined;

    if (!channel || !CHANNEL_TYPES.includes(channel)) return jsonError("Canal inválido o no especificado", 400);
    if (!/^\d+$/.test(ticketId)) return jsonError("Ingresá un número de ticket InvGate válido.", 400);

    const model = rawModel && ALLOWED_MODELS.has(rawModel) ? rawModel : undefined;

    // Solo 1 consulta a InvGate: fetchInvgateTicketMetadata ya trae incident en meta.data.raw
    const meta = await fetchInvgateTicketMetadata(ticketId);
    if (!meta.ok || !meta.data) return jsonError(meta.error || "No se pudo obtener el ticket", meta.status || 404);

    if (model === "council") {
      const councilResult = await evaluateWithCouncil(
        channel,
        meta.data,
        meta.data.raw,
      );
      return jsonResponse({
        ok: true,
        model: "council",
        isCouncil: true,
        resumen: councilResult.resumen,
        verdicts: councilResult.verdicts,
        debate: councilResult.debate,
      });
    }

    const { model: usedModel, resumen, verdicts } = await evaluateWithAi(
      channel,
      meta.data,
      meta.data.raw,
      { model, provider: "opencode" },
    );
    return jsonResponse({ ok: true, model: usedModel, resumen, verdicts });
  } catch (error) {
    if (error instanceof AiBusyError) return jsonError(error.message, 429);
    console.error("[ai-evaluate] Error:", error);
    return jsonError(sanitizeError(error, "No se pudo evaluar con IA."), 502);
  }
};

