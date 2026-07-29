import type { APIRoute } from "astro";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { jsonResponse, sanitizeError, jsonError } from "@lib/apiResponse";
import { invgateQaPost } from "@lib/invgate-qa-client";
import { logAdminAction } from "@lib/auditLogger";

export const POST: APIRoute = async ({ request, locals }) => {
  const denied = requireWriteAccess(locals, "usuarios");
  if (denied) return denied;

  try {
    const body = await request.json();
    const usuarioRaw = body?.usuario;
    const nombreCompletoRaw = body?.nombreCompleto;
    const dniRaw = body?.dni;

    if (
      typeof usuarioRaw !== "string" ||
      typeof nombreCompletoRaw !== "string" ||
      (typeof dniRaw !== "string" && typeof dniRaw !== "number")
    ) {
      return jsonError("Los campos usuario, nombreCompleto y dni son requeridos y deben ser válidos.", 400);
    }

    const usuario = usuarioRaw.trim();
    const nombreCompleto = nombreCompletoRaw.trim();
    const dni = String(dniRaw).trim();

    if (!usuario || !nombreCompleto || !dni) {
      return jsonError("Los campos usuario, nombreCompleto y dni no pueden estar vacíos.", 400);
    }

    const description = `Se solicita asignar al usuario en el grupo InvGate Service Management | Usuarios y grupos.<br><table style="width: 100%; max-width: 600px; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #334155;"><tr><td style="padding: 6px 12px; font-weight: bold; text-transform: uppercase; width: 180px;">Usuario de red</td><td style="padding: 6px 12px;">${usuario}</td></tr><tr><td style="padding: 6px 12px; font-weight: bold; text-transform: uppercase;">Nombre completo</td><td style="padding: 6px 12px;">${nombreCompleto}</td></tr><tr><td style="padding: 6px 12px; font-weight: bold; text-transform: uppercase;">DNI</td><td style="padding: 6px 12px;">${dni}</td></tr><tr><td style="padding: 6px 12px; font-weight: bold; text-transform: uppercase;">Correo corporativo</td><td style="padding: 6px 12px;">${usuario.toLowerCase()}@correoargentino.com.ar</td></tr></table>`;

    const payload = {
      type_id: 2,
      category_id: 61,
      title: "InvGate - Grupo faltante",
      priority_id: 1,
      customer_id: 6,
      creator_id: 6,
      description: description
    };

    const res = await invgateQaPost<{
      request_id: number; id: number 
}>("incident", payload);

    if (!res.ok) {
      return jsonError(res.message, 500);
    }

    const username = locals.user?.username || "Sistema";
    await logAdminAction(username, `Creó ticket de InvGate QA para alta de grupo de ${nombreCompleto} (${usuario})`);

    const id = res.data?.request_id || res.data?.id;
    const invgateBaseUrl = import.meta.env.INVGATE_QA_BASE_URL || process.env.INVGATE_QA_BASE_URL || "";
    const cleanBaseUrl = invgateBaseUrl.replace(/\/api\/v1\/?$/, "");
    const ticketUrl = id ? `${cleanBaseUrl}/incident/show/index/id/${id}` : null;

    return jsonResponse({ success: true, id, ticketUrl });
  } catch (error: any) {
    console.error("POST /api/usuarios/create-invgate-ticket Error:", error);
    return jsonError(sanitizeError(error), 500);
  }
};
