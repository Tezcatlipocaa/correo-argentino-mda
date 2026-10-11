import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { titleFavorites, titles } from "@/db/schema";
import { jsonResponse, jsonError } from "@lib/apiResponse";

/**
 * Favoritos de títulos por usuario (perfil). Requiere sesión activa; cualquier
 * rol logueado puede marcar/desmarcar. El GET devuelve [] si no hay sesión.
 */
function currentUserId(locals: App.Locals): number | null {
  const id = locals.user?.id ?? 0;
  return id > 0 ? id : null;
}

export const GET: APIRoute = async ({ locals }) => {
  const userId = currentUserId(locals);
  if (userId === null) {
    return jsonResponse({ favorites: [] }, 200, "no-store");
  }

  const rows = await db
    .select({ titleId: titleFavorites.titleId })
    .from(titleFavorites)
    .where(eq(titleFavorites.userId, userId));

  return jsonResponse(
    { favorites: rows.map((row) => row.titleId) },
    200,
    "no-store",
  );
};

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = currentUserId(locals);
  if (userId === null) {
    return jsonError("Sesión no iniciada", 401);
  }

  const body = (await request.json().catch(() => null)) as {
    titleId?: unknown;
  } | null;
  const titleId = Number(body?.titleId);
  if (!Number.isInteger(titleId) || titleId <= 0) {
    return jsonError("titleId inválido", 400);
  }

  const [title] = await db
    .select({ id: titles.id })
    .from(titles)
    .where(eq(titles.id, titleId))
    .limit(1);
  if (!title) {
    return jsonError("Título inexistente", 404);
  }

  await db
    .insert(titleFavorites)
    .values({ userId, titleId })
    .onConflictDoNothing();

  return jsonResponse({ success: true, favorite: true }, 200, "no-store");
};

export const DELETE: APIRoute = async ({ url, locals }) => {
  const userId = currentUserId(locals);
  if (userId === null) {
    return jsonError("Sesión no iniciada", 401);
  }

  const titleId = Number(url.searchParams.get("titleId"));
  if (!Number.isInteger(titleId) || titleId <= 0) {
    return jsonError("titleId inválido", 400);
  }

  await db
    .delete(titleFavorites)
    .where(
      and(
        eq(titleFavorites.userId, userId),
        eq(titleFavorites.titleId, titleId),
      ),
    );

  return jsonResponse({ success: true, favorite: false }, 200, "no-store");
};
