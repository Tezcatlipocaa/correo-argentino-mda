import type { APIRoute } from "astro";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { jsonResponse, sanitizeError, jsonError } from "@lib/apiResponse";
import { invgatePost, invgateGet } from "@lib/invgateClient";
import { invgateQaPost } from "@lib/invgate-qa-client";
import { logAdminAction } from "@lib/auditLogger";
import {
  USE_QA_INVGATE,
  AGENTS_TICKET_CATEGORY_ID,
  AGENTS_TICKET_PRIORITY_ID,
  QA_CUSTOMER_ID,
  QA_CREATOR_ID,
  AGENTS_TICKET_TITLE,
  buildTicketDescription,
} from "@lib/telegrafiaTicket";

export const POST: APIRoute = async ({ request, locals }) => {
  const denied = requireWriteAccess(locals, "usuarios");
  if (denied) return denied;

  const adminUsername = locals.user?.username;
  if (!adminUsername) {
    return jsonError("Usuario de sesión no válido", 401);
  }

  try {
    const body = await request.json();
    const officeCode = body?.officeCode;
    const officeName = body?.officeName;
    const notes = typeof body?.notes === "string" ? body.notes : undefined;

    if (
      typeof officeCode !== "string" ||
      typeof officeName !== "string"
    ) {
      return jsonError(
        "Los campos officeCode y officeName son requeridos.",
        400,
      );
    }

    if (!officeCode.trim() || !officeName.trim()) {
      return jsonError(
        "Los campos officeCode y officeName no pueden estar vacíos.",
        400,
      );
    }

    if (AGENTS_TICKET_CATEGORY_ID === 0) {
      return jsonError(
        "Categoría de ticket no configurada. Revisar src/lib/telegrafiaTicket.ts",
        500,
      );
    }

    let customerId: number;
    let creatorId: number;

    if (USE_QA_INVGATE) {
      // --- QA mode: usar IDs fijos de prueba ---
      customerId = QA_CUSTOMER_ID;
      creatorId = QA_CREATOR_ID;
    } else {
      // --- Production mode: buscar usuario de sesión en InvGate ---
      const customerIdFromBody = body?.customerId;
      if (typeof customerIdFromBody !== "number" || customerIdFromBody <= 0) {
        return jsonError(
          "customerId es requerido y debe ser un ID válido.",
          400,
        );
      }
      customerId = customerIdFromBody;

      const searchRes = await invgateGet<{
        data: Record<string, { id: number; username: string }>;
      }>(`users.by?username=${encodeURIComponent(adminUsername)}`);

      if (!searchRes.ok) {
        return jsonError(
          `Error al buscar usuario en InvGate: ${searchRes.message}`,
          500,
        );
      }

      const userDataMap = searchRes.data?.data;
      if (!userDataMap || Object.keys(userDataMap).length === 0) {
        return jsonError(
          `No se encontró el usuario ${adminUsername} en InvGate.`,
          404,
        );
      }

      const firstUserIdStr = Object.keys(userDataMap)[0];
      creatorId = userDataMap[firstUserIdStr]?.id;

      if (!creatorId) {
        return jsonError(
          `El usuario ${adminUsername} en InvGate no tiene un ID válido.`,
          404,
        );
      }
    }

    const description = buildTicketDescription(
      officeName.trim(),
      officeCode.trim(),
      notes,
    );

    const payload = {
      type_id: 2,
      category_id: AGENTS_TICKET_CATEGORY_ID,
      title: AGENTS_TICKET_TITLE,
      priority_id: AGENTS_TICKET_PRIORITY_ID,
      customer_id: customerId,
      creator_id: creatorId,
      description,
    };

    const postFn = USE_QA_INVGATE ? invgateQaPost : invgatePost;

    const res = await postFn<{
      request_id: number;
      id: number;
    }>("incident", payload);

    if (!res.ok) {
      return jsonError(res.message, 500);
    }

    const username = locals.user?.username || "Sistema";
    const envLabel = USE_QA_INVGATE ? "[QA] " : "";
    await logAdminAction(
      username,
      `${envLabel}Creó ticket de InvGate por agentes caídos en ${officeName.trim()} (${officeCode.trim()})`,
    );

    const id = res.data?.request_id || res.data?.id;
    const invgateBaseUrl = USE_QA_INVGATE
      ? (import.meta.env.INVGATE_QA_BASE_URL || process.env.INVGATE_QA_BASE_URL || "")
      : (import.meta.env.INVGATE_BASE_URL || process.env.INVGATE_BASE_URL || "");
    const cleanBaseUrl = invgateBaseUrl.replace(/\/api\/v1\/?$/, "");
    const ticketUrl = id
      ? `${cleanBaseUrl}/requests/show/index/id/${id}`
      : null;

    return jsonResponse({ success: true, id, ticketUrl });
  } catch (error: any) {
    console.error(
      "POST /api/offices/create-agents-ticket Error:",
      error,
    );
    return jsonError(sanitizeError(error), 500);
  }
};
