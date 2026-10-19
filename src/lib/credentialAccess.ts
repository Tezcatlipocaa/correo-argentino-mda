import { normalizeRole, isValidRole, ROLE_HIERARCHY, type Role } from "./rbac";

export interface CredentialAccessParams {
  credentialMinRole?: string | null;
  credentialHelpdesk?: string | null;
}

export interface UserContext {
  id?: number | null;
  role?: string | null;
  helpdeskName?: string | null;
}

/**
 * Evalúa si un usuario tiene permiso para visualizar o revelar credenciales
 * según la jerarquía de roles (ROLE_HIERARCHY) y su mesa de ayuda asignada.
 *
 * Principios:
 * 1. Admin siempre tiene acceso irrestricto (política general del portal).
 * 2. Usuarios anónimos o no autenticados (id === 0 o falsy) son rechazados.
 * 3. Si credentialMinRole no está definido, el default es 'agent' (todos los autenticados).
 * 4. Si credentialHelpdesk está definido y no es vacío, el usuario debe pertenecer a esa mesa.
 */
export function canUserAccessCredentials(
  user: UserContext | null | undefined,
  params: CredentialAccessParams,
): boolean {
  if (!user || !user.id || user.id === 0) {
    return false;
  }

  const role = user.role ? normalizeRole(user.role) : "agent";
  if (role === "admin") {
    return true;
  }

  // 1. Validar rol mínimo
  const rawMinRole = params.credentialMinRole?.trim();
  const requiredRole: Role =
    rawMinRole && isValidRole(rawMinRole)
      ? normalizeRole(rawMinRole)
      : "agent";

  const userRank = ROLE_HIERARCHY[role] ?? 0;
  const requiredRank = ROLE_HIERARCHY[requiredRole] ?? 1;

  if (userRank < requiredRank) {
    return false;
  }

  // 2. Validar mesa de ayuda si está restringida
  const targetHelpdesk = params.credentialHelpdesk?.trim();
  if (targetHelpdesk) {
    const userHelpdesk = (user.helpdeskName ?? "").trim();
    if (userHelpdesk !== targetHelpdesk) {
      return false;
    }
  }

  return true;
}
