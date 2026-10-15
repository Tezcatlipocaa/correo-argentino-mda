import type { APIRoute } from "astro";
import { jsonResponse, jsonError, sanitizeError } from "@/lib/apiResponse";
import { requireWriteAccess } from "@/lib/rbac-middleware";
import { fetchInvgateTicketMetadata } from "@/lib/qualityMetadataFetcher";
import { AiBusyError, evaluateWithAi } from "@/lib/qualityAiEvaluator";
import { CHANNEL_TYPES, type ChannelType } from "@/types/quality";

/**
 * Evalúa con IA (opencode + modelo free) los criterios de calidad que salen del
 * ticket InvGate y que no tienen regla determinista. Solo sugiere: el supervisor decide.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  try {
    const perm = await requireWriteAccess(locals, "calidad");
    if (perm) return perm;

    const body = await request.json().catch(() => null);
    const channel = body?.channel as ChannelType;
    const ticketId = String(body?.ticketId ?? "").replace("#", "").trim();
    const model = typeof body?.model === "string" && body.model.trim() ? body.model.trim() : undefined;
    const provider = body?.provider === "gemini" || body?.provider === "opencode" ? body.provider : undefined;

    if (!channel || !CHANNEL_TYPES.includes(channel)) return jsonError("Canal inválido o no especificado", 400);
    if (!/^\d+$/.test(ticketId)) return jsonError("Ingresá un número de ticket InvGate válido.", 400);

    const [meta, raw] = await Promise.all([
      fetchInvgateTicketMetadata(ticketId),
      fetchInvgateTicketMetadata(ticketId, { includeRaw: true }),
    ]);
    if (!meta.ok || !meta.data) return jsonError(meta.error || "No se pudo obtener el ticket", meta.status || 404);

    const { model: usedModel, resumen, verdicts } = await evaluateWithAi(
      channel,
      meta.data,
      raw.ok ? raw.data?.raw : undefined,
      { model, provider },
    );
    return jsonResponse({ ok: true, model: usedModel, resumen, verdicts });
  } catch (error) {
    if (error instanceof AiBusyError) return jsonError(error.message, 429);
    console.error("[ai-evaluate] Error:", error);
    return jsonError(sanitizeError(error, "No se pudo evaluar con IA."), 502);
  }
};
