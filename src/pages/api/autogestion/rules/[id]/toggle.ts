import type { APIRoute } from "astro";
import { requireWriteAccess } from "@lib/rbac-middleware";
import { validateRequestCsrf } from "@lib/csrf";
import { checkSlidingRateLimit } from "@lib/rateLimit";
import { jsonResponse, jsonError } from "@lib/apiResponse";
import { AUTOGESTION_AUTOMATION_RULES } from "@/lib/autogestion/rulesEngine";
import {
  getAutogestionRuleStates,
  resolveRuleEnabled,
  setAutogestionRuleState,
} from "@/lib/autogestion/ruleState";
import { logAdminActionStructured } from "@lib/auditLogger";

/**
 * Habilita o deshabilita una automatización de AGS.
 * El estado real persiste en `autogestion_rule_state`; el worker PM2 lo lee en
 * cada ciclo (≤10 min de latencia, sin reinicio).
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const authError = await requireWriteAccess(locals, "asignacion_ag");
  if (authError) return authError;

  if (!(await validateRequestCsrf(request, locals))) {
    return jsonError("Token CSRF inválido o ausente", 403);
  }

  const user = locals.user;
  if (!user) return jsonError("Sesión requerida", 401);

  if (!checkSlidingRateLimit(`rate:rule-toggle:${user.id}`, 15, 60_000)) {
    return jsonError("Demasiadas solicitudes. Intenta de nuevo en un minuto.", 429);
  }

  const ruleId = params.id;
  const rule = AUTOGESTION_AUTOMATION_RULES.find((r) => r.id === ruleId);
  if (!ruleId || !rule) {
    return jsonError("Regla de automatización no encontrada", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Payload JSON inválido", 400);
  }

  const enabled = (body as { enabled?: unknown })?.enabled;
  if (typeof enabled !== "boolean") {
    return jsonError("El campo 'enabled' debe ser un valor booleano", 400);
  }

  // Estado previo real (no asumir el complemento): la fila puede no existir y
  // caer al default del catálogo documental.
  const currentStates = await getAutogestionRuleStates();
  const previous = resolveRuleEnabled(ruleId, currentStates);

  await setAutogestionRuleState(ruleId, enabled, user.username);

  await logAdminActionStructured(
    user.username,
    `${enabled ? "Habilitó" : "Deshabilitó"} la automatización '${rule.name}'`,
    "autogestion_rule",
    rule.priority ?? 0,
    { enabled: previous, ruleId },
    { enabled, ruleId }
  );

  return jsonResponse({ ok: true, ruleId, enabled, previous });
};
