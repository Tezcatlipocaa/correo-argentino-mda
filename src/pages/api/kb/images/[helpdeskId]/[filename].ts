import type { APIRoute } from "astro";
import fs from "node:fs";
import { extname, join, resolve } from "node:path";
import { jsonError, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { resolveSessionMesa } from "@lib/helpdeskAccess";
import { can } from "@lib/roleConfig";
import { getStorageRoot } from "@lib/storage";

const KB_IMAGE_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp)$/i;

export const GET: APIRoute = async ({ params, locals }) => {
  const denied = await requireReadAccess(locals, "base-conocimiento");
  if (denied) return denied;

  const helpdeskId = Number(params.helpdeskId);
  if (!Number.isInteger(helpdeskId) || helpdeskId <= 0) {
    return jsonError("No encontrado.", 404);
  }

  const filename = params.filename;
  if (!filename || !KB_IMAGE_FILENAME_PATTERN.test(filename)) {
    return jsonError("No encontrado.", 404);
  }

  const session = resolveSessionMesa({
    helpdeskId: locals.user.helpdeskId,
    helpdeskName: locals.user.helpdeskName,
    mesaActive:
      locals.user.helpdeskId !== null &&
      Boolean(locals.user.helpdeskName?.trim()),
  });
  if (!can(locals.user.role, "admin") && session.helpdeskId !== helpdeskId) {
    return jsonError("No encontrado.", 404);
  }

  try {
    const imagesRoot = resolve(join(getStorageRoot(), "kb-images"));
    const filePath = resolve(join(imagesRoot, String(helpdeskId), filename));
    if (!filePath.startsWith(imagesRoot)) {
      return jsonError("No encontrado.", 404);
    }
    if (!fs.existsSync(filePath)) {
      return jsonError("No encontrado.", 404);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const extension = extname(filename).toLowerCase();
    const contentType =
      extension === ".png"
        ? "image/png"
        : extension === ".webp"
          ? "image/webp"
          : "image/jpeg";

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.byteLength.toString(),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Content-Security-Policy":
          "default-src 'none'; img-src 'self' data:; sandbox",
      },
    });
  } catch (error) {
    console.error("[kb/images] Error:", error);
    return jsonError(sanitizeError(error), 500);
  }
};
