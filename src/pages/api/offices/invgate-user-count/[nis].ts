import type { APIRoute } from "astro";
import { db } from "@db/index";
import { offices, officeInvgateLinks } from "@db/schema";
import { eq } from "drizzle-orm";
import { jsonResponse, jsonError } from "@lib/apiResponse";

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return jsonError("No autorizado", 401);

  try {
    const nis = params.nis;
    if (!nis) return jsonError("NIS requerido", 400);

    const rows = await db
      .select({ total: officeInvgateLinks.invgateUserTotal })
      .from(officeInvgateLinks)
      .innerJoin(offices, eq(officeInvgateLinks.officeId, offices.id))
      .where(eq(offices.code, nis))
      .limit(1);

    const total = rows[0]?.total ?? 0;

    return jsonResponse({
      ok: true,
      total,
    });
  } catch (error) {
    console.error("[InvGateUserCount] Error:", error);
    return jsonError("Error al obtener usuarios de InvGate", 500);
  }
};
