import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "@db/index";
import { mesas } from "@db/schema";
import { jsonError, jsonResponse, sanitizeError } from "@lib/apiResponse";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { can } from "@lib/roleConfig";
import {
  KB_IMAGE_MAX_BYTES,
  KbImageValidationError,
  processKbImageUpload,
} from "@lib/kbImageUpload";

export const POST: APIRoute = async ({ request, locals }) => {
  const denied = await requireWriteAccess(locals, "base-conocimiento");
  if (denied) return denied;

  try {
    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader === null) {
      return jsonError(
        "Se requiere el encabezado Content-Length para subir la imagen.",
        411,
      );
    }

    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      return jsonError("El encabezado Content-Length no es válido.", 400);
    }
    if (contentLength > KB_IMAGE_MAX_BYTES + 128 * 1024) {
      return jsonError("La imagen supera el límite de 2 MB.", 413);
    }

    const form = await request.formData();
    const file = form.get("file");
    const sessionHelpdeskId = locals.user.helpdeskId;
    if (
      typeof sessionHelpdeskId !== "number" ||
      !Number.isInteger(sessionHelpdeskId) ||
      sessionHelpdeskId <= 0
    ) {
      return jsonError("Tu usuario no tiene mesa asignada.", 400);
    }
    let helpdeskId = sessionHelpdeskId;

    if (can(locals.user.role, "admin")) {
      const rawHelpdeskId = form.get("helpdeskId");
      if (rawHelpdeskId !== null) {
        const parsedHelpdeskId =
          typeof rawHelpdeskId === "string"
            ? Number(rawHelpdeskId)
            : Number.NaN;
        if (!Number.isInteger(parsedHelpdeskId) || parsedHelpdeskId <= 0) {
          return jsonError("La mesa indicada no existe o está inactiva.", 400);
        }

        const [mesa] = await db
          .select({ invgateId: mesas.invgateId })
          .from(mesas)
          .where(
            and(eq(mesas.invgateId, parsedHelpdeskId), eq(mesas.active, true)),
          )
          .limit(1);

        if (!mesa) {
          return jsonError("La mesa indicada no existe o está inactiva.", 400);
        }
        helpdeskId = parsedHelpdeskId;
      }
    }

    if (!(file instanceof File)) {
      return jsonError("No se recibió ninguna imagen.", 400);
    }

    try {
      const { url } = await processKbImageUpload(file, helpdeskId);
      return jsonResponse({ url }, 200);
    } catch (error) {
      if (error instanceof KbImageValidationError) {
        return jsonError(error.message, 400);
      }
      throw error;
    }
  } catch (error) {
    console.error("[kb/upload] Error:", error);
    return jsonError(sanitizeError(error), 500);
  }
};
