import type { APIRoute } from "astro";
import fs from "node:fs";
import { Readable } from "node:stream";
import { requireSession } from "@lib/rbac-middleware";
import { ensurePackBaseZip, PACK_BASE_ZIP_FILENAME } from "@lib/packBaseService";

export const GET: APIRoute = async ({ locals }) => {
  const denied = await requireSession(locals);
  if (denied) return denied;

  try {
    const result = await ensurePackBaseZip();

    if (!result.available || !result.zipPath || !fs.existsSync(result.zipPath)) {
      return new Response("El Pack base de operatoria no está disponible.", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const stat = fs.statSync(result.zipPath);
    const nodeStream = fs.createReadStream(result.zipPath);
    const webStream = Readable.toWeb(nodeStream);

    return new Response(webStream as any, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${PACK_BASE_ZIP_FILENAME}"`,
        "Content-Length": stat.size.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[pack-base] Error al generar o servir el pack base:", error);
    return new Response("Error interno al procesar el pack base.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
};
