import type { APIRoute } from "astro";
import { db } from "@db/index";
import { resourceLinks, applications } from "@db/schema";
import { eq } from "drizzle-orm";
import { jsonResponse, jsonError } from "@lib/apiResponse";
import { requireSession } from "@lib/rbac-middleware";
import { validateRequestCsrf } from "@lib/csrf";
import { checkRateLimit, RATE_LIMITS } from "@lib/rateLimit";
import { resolveClientIp } from "@lib/clientIp";
import { canUserAccessCredentials } from "@lib/credentialAccess";
import { decryptData } from "@lib/encryption";

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  // 1. Validar sesión
  const sessionError = await requireSession(locals);
  if (sessionError) return sessionError;

  // 2. Validar CSRF
  const isCsrfValid = await validateRequestCsrf(request, locals);
  if (!isCsrfValid) {
    return jsonError("Token CSRF inválido o ausente", 403, "no-store");
  }

  // 3. Validar Rate Limit por IP / Usuario
  const clientIp = resolveClientIp(clientAddress, request.headers.get("x-forwarded-for"));
  const rateLimitKey = `cred-reveal:${locals.user.id}:${clientIp}`;
  const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMITS.credentialReveal);
  if (!rateCheck.ok) {
    return jsonError(
      `Demasiadas solicitudes de revelado de credenciales. Reintentá en ${rateCheck.retryAfter}s`,
      429,
      "no-store",
    );
  }

  // 4. Parsear body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError("Cuerpo JSON inválido", 400, "no-store");
  }

  const { entityType, entityId, metaIndex } = body;
  if (!entityType || !entityId || typeof entityId !== "number") {
    return jsonError("Parámetros 'entityType' y 'entityId' requeridos", 400, "no-store");
  }

  const user = locals.user;

  try {
    if (entityType === "resource_link") {
      const link = await db.query.resourceLinks.findFirst({
        where: eq(resourceLinks.id, entityId),
      });

      if (!link) {
        return jsonError("Enlace no encontrado", 404, "no-store");
      }

      const hasAccess = canUserAccessCredentials(user, {
        credentialMinRole: link.credentialMinRole,
        credentialHelpdesk: link.credentialHelpdesk,
      });

      if (!hasAccess) {
        return jsonError("No tenés permisos para visualizar esta credencial", 403, "no-store");
      }

      if (!link.credentialPassword) {
        return jsonResponse({ value: "" }, 200, "no-store");
      }

      const decryptedPassword = decryptData(link.credentialPassword);
      return jsonResponse({ value: decryptedPassword }, 200, "no-store");
    }

    if (entityType === "application") {
      const app = await db.query.applications.findFirst({
        where: eq(applications.id, entityId),
      });

      if (!app) {
        return jsonError("Aplicativo no encontrado", 404, "no-store");
      }

      if (!app.metadata) {
        return jsonResponse({ value: "" }, 200, "no-store");
      }

      const decryptedMetaJson = decryptData(app.metadata);
      let parsedList: Array<{ label: string; value: string; minRole?: string; helpdesk?: string | null }> = [];
      try {
        parsedList = JSON.parse(decryptedMetaJson);
      } catch {
        return jsonError("Metadatos de credenciales corruptos en el servidor", 500, "no-store");
      }

      const targetIdx = typeof metaIndex === "number" ? metaIndex : 0;
      const targetMeta = parsedList[targetIdx];

      if (!targetMeta) {
        return jsonError("Credencial no encontrada en el índice solicitado", 404, "no-store");
      }

      const hasAccess = canUserAccessCredentials(user, {
        credentialMinRole: targetMeta.minRole,
        credentialHelpdesk: targetMeta.helpdesk,
      });

      if (!hasAccess) {
        return jsonError("No tenés permisos para visualizar esta credencial", 403, "no-store");
      }

      return jsonResponse({ value: targetMeta.value || "" }, 200, "no-store");
    }

    return jsonError("entityType no soportado", 400, "no-store");
  } catch (error: any) {
    console.error("[api/credentials/reveal] Error:", error);
    return jsonError("Error interno al procesar credencial", 500, "no-store");
  }
};
