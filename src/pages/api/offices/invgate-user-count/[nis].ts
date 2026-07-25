import type { APIRoute } from "astro";
import { db } from "@db/index";
import { offices, officeInvgateLinks } from "@db/schema";
import { eq } from "drizzle-orm";
import { invgateGet } from "@lib/invgateClient";
import { jsonResponse, jsonError } from "@lib/apiResponse";

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return jsonError("No autorizado", 401);

  try {
    const nis = params.nis;
    if (!nis) return jsonError("NIS requerido", 400);

    const links = await db
      .select({ invgateLocationId: officeInvgateLinks.invgateLocationId })
      .from(officeInvgateLinks)
      .innerJoin(offices, eq(officeInvgateLinks.officeId, offices.id))
      .where(eq(offices.code, nis))
      .limit(1);

    if (links.length === 0) {
      return jsonResponse({ ok: true, total: 0 });
    }

    const invgateLocationId = links[0].invgateLocationId;

    const result = await invgateGet<any>("locations");
    if (!result.ok || !("data" in result)) {
      return jsonResponse({ ok: true, total: 0 });
    }

    const locations = Array.isArray(result.data)
      ? result.data
      : (result.data as any).data;

    if (!Array.isArray(locations)) {
      return jsonResponse({ ok: true, total: 0 });
    }

    const match = locations.find((l: any) => l.id === invgateLocationId);
    return jsonResponse({
      ok: true,
      total: match?.total ?? 0,
    });
  } catch (error) {
    console.error("[InvGateUserCount] Error:", error);
    return jsonError("Error al obtener usuarios de InvGate", 500);
  }
};
