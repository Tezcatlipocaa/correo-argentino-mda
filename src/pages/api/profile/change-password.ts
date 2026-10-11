import type { APIRoute } from "astro";
import { db } from "@db/index";
import { sessions, users } from "@db/schema";
import { and, eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { passwordSchema, hashPassword } from "@lib/security";
import { logAdminFromAstro } from "@lib/auditLogger";
import { jsonResponse, jsonError } from "@lib/apiResponse";
import { validateRequestCsrf, validateCsrfToken } from "@lib/csrf";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || user.id === 0) {
    return jsonError("Sesión no iniciada", 401);
  }

  try {
    let isCsrfValid = await validateRequestCsrf(request, locals);
    const formData = await request.formData();

    if (!isCsrfValid && locals.sessionId) {
      const formToken = formData.get("csrf_token")?.toString();
      if (formToken && validateCsrfToken(formToken, locals.sessionId)) {
        isCsrfValid = true;
      }
    }

    if (!isCsrfValid) {
      return jsonError("Token CSRF inválido o ausente", 403);
    }

    const currentPassword = formData.get("currentPassword")?.toString();
    const newPassword = formData.get("newPassword")?.toString();

    if (!currentPassword) {
      return jsonError("La contraseña actual es requerida", 400);
    }

    if (!newPassword) {
      return jsonError("La nueva contraseña es requerida", 400);
    }

    const pwdValidation = passwordSchema.safeParse(newPassword);
    if (!pwdValidation.success) {
      return jsonError(pwdValidation.error.issues[0].message, 400);
    }

    const [dbUser] = await db
      .select({ password: users.password })
      .from(users)
      .where(eq(users.id, user.id));

    if (!dbUser) {
      return jsonError("Usuario no encontrado", 404);
    }

    const isCurrentValid = await bcrypt.compare(
      currentPassword,
      dbUser.password,
    );
    if (!isCurrentValid) {
      return jsonError("La contraseña actual es incorrecta", 400);
    }

    const hashedPassword = await hashPassword(newPassword);
    db.transaction((tx) => {
      tx.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id))
        .run();

      if (locals.sessionId) {
        tx.delete(sessions)
          .where(
            and(
              eq(sessions.userId, user.id),
              ne(sessions.id, locals.sessionId),
            ),
          )
          .run();
      }
    });

    await logAdminFromAstro(locals, "Cambió su propia contraseña");

    return jsonResponse({
      success: true,
      message: "Contraseña actualizada exitosamente",
    });
  } catch (e) {
    console.error("Change password error:", e);
    return jsonError("Error al actualizar la contraseña", 500);
  }
};
