import type { APIRoute } from "astro";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { jsonResponse, sanitizeError, jsonError } from "@lib/apiResponse";
import { invgateQaPost } from "@lib/invgate-qa-client";

export const POST: APIRoute = async ({ request, locals }) => {
  const denied = requireWriteAccess(locals, "usuarios");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { nombre, apellido, usuario } = body;

    if (!nombre || !apellido || !usuario) {
      return jsonError("Los campos nombre, apellido y usuario son requeridos.", 400);
    }

    const description = `Se solicita asignar al usuario en el grupo InvGate Service Management | Usuarios y grupos.\n\nNombre: ${nombre}\nApellido: ${apellido}\nUsuario: ${usuario}`;

    const payload = {
      type_id: 2,
      category_id: 61,
      title: "InvGate - Grupo faltante",
      priority_id: 1,
      customer_id: 6,
      creator_id: 6,
      description: description
    };

    const res = await invgateQaPost<{ id: number }>("incident", payload);

    if (!res.ok) {
      return jsonResponse({ success: false, error: res.message }, 500);
    }

    return jsonResponse({ success: true, id: res.data?.id });
  } catch (error: any) {
    console.error("POST /api/usuarios/create-invgate-ticket Error:", error);
    return jsonResponse({ success: false, error: sanitizeError(error) }, 500);
  }
};
