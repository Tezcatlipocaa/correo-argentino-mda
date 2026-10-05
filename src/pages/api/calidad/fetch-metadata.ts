import type { APIRoute } from "astro";
import { jsonResponse, jsonError } from "@/lib/apiResponse";
import { requireWriteAccess } from "@/lib/rbac-middleware";
import { fetchQualityCaseMetadata } from "@/lib/qualityMetadataFetcher";
import { CHANNEL_TYPES, type ChannelType } from "@/types/quality";

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    const perm = await requireWriteAccess(locals, "calidad");
    if (perm) return perm;

    const url = new URL(request.url);
    const channel = url.searchParams.get("channel") as ChannelType;
    const id = url.searchParams.get("id")?.trim() || "";
    const sourceParam = url.searchParams.get("source")?.trim();
    const source = sourceParam === "wise" || sourceParam === "invgate" ? sourceParam : undefined;

    if (!channel || !CHANNEL_TYPES.includes(channel)) {
      return jsonError("Canal inválido o no especificado", 400);
    }

    if (!id) {
      return jsonError("El identificador del caso es requerido", 400);
    }

    const result = await fetchQualityCaseMetadata(channel, id, source);

    if (!result.ok) {
      return jsonError(result.error || "No se pudieron obtener los metadatos", result.status || 404);
    }

    return jsonResponse({
      ok: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[fetch-metadata] Error inesperado:", error);
    return jsonError(
      error instanceof Error ? error.message : "Error interno del servidor",
      500,
    );
  }
};
