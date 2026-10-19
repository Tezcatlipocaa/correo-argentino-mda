import type { APIRoute } from "astro";
import { db } from "@db/index";
import { sessions } from "@db/schema";
import { eq } from "drizzle-orm";
import { verifySessionId, deleteSessionCookie } from "@lib/session";
import { invalidateSessionCache } from "@lib/sessionCache";
import { redirectWithToast } from "@lib/api/redirectWithToast";
import { validateRequestCsrf } from "@lib/csrf";

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const isCsrfValid = await validateRequestCsrf(request, locals);
  if (!isCsrfValid) {
    return new Response("CSRF validation failed", { status: 403 });
  }

  const signedSessionId = cookies.get("session_id")?.value;

  if (signedSessionId) {
    const sessionId = verifySessionId(signedSessionId);
    if (sessionId) {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
      invalidateSessionCache(sessionId);
    }
  }
  deleteSessionCookie(cookies);

  return redirectWithToast("/login", "Sesión cerrada con éxito");
};

export const GET: APIRoute = async () => {
  return new Response("Method Not Allowed. Use POST to logout.", {
    status: 405,
    headers: { Allow: "POST" },
  });
};
