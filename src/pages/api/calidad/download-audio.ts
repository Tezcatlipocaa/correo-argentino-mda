import type { APIRoute } from "astro";
import { requireReadAccess } from "@/lib/rbac-middleware";
import { jsonError } from "@/lib/apiResponse";

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    const perm = await requireReadAccess(locals, "calidad");
    if (perm) return perm;

    const reqUrl = new URL(request.url);
    const audioUrl = reqUrl.searchParams.get("url")?.trim();
    const filename = reqUrl.searchParams.get("filename")?.trim() || "grabacion-llamada.mp3";
    const download = reqUrl.searchParams.get("download") === "1";

    if (!audioUrl || !audioUrl.startsWith("https://")) {
      return jsonError("URL de audio inválida", 400);
    }

    // Seguridad: verificar que apunte a AWS S3 o Wise CX
    const parsedTarget = new URL(audioUrl);
    const isAllowedHost =
      parsedTarget.hostname.endsWith(".amazonaws.com") ||
      parsedTarget.hostname.endsWith(".wisecx.com") ||
      parsedTarget.hostname.includes("s3");

    if (!isAllowedHost) {
      return jsonError("Host de audio no permitido", 403);
    }

    const forwardHeaders: Record<string, string> = {};
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      forwardHeaders["range"] = rangeHeader;
    }

    const response = await fetch(audioUrl, {
      headers: forwardHeaders,
    });

    if (!response.ok && response.status !== 206) {
      return jsonError(`Error al obtener archivo de audio remoto: ${response.statusText}`, response.status);
    }

    const resHeaders = new Headers();
    resHeaders.set("Content-Type", response.headers.get("content-type") || "audio/mpeg");
    if (response.headers.has("content-length")) {
      resHeaders.set("Content-Length", response.headers.get("content-length")!);
    }
    if (response.headers.has("accept-ranges")) {
      resHeaders.set("Accept-Ranges", response.headers.get("accept-ranges")!);
    }
    if (response.headers.has("content-range")) {
      resHeaders.set("Content-Range", response.headers.get("content-range")!);
    }

    if (download) {
      resHeaders.set("Content-Disposition", `attachment; filename="${filename}"`);
    } else {
      resHeaders.set("Content-Disposition", `inline; filename="${filename}"`);
    }

    return new Response(response.body, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error) {
    console.error("[download-audio] Error inesperado:", error);
    return jsonError(
      error instanceof Error ? error.message : "Error interno del servidor",
      500,
    );
  }
};
