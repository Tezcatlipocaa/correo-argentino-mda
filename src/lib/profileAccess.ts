import { eq, or } from "drizzle-orm";
import { db } from "@db/index";
import { agents, employees, offices, sessions } from "@db/schema";
import { hasPermission, normalizeRole } from "@lib/rbac";
import { isSectionVisibleSync } from "@lib/helpdeskAccess";

export type ProfileAccessGroupId =
  | "supervision"
  | "operacion"
  | "herramientas"
  | "admin";

export interface ProfileAccessEntry {
  href: string;
  title: string;
  description: string;
  icon: string;
  iconTone: string;
  group: ProfileAccessGroupId;
}

export interface ProfileAccessGroup {
  id: ProfileAccessGroupId;
  label: string;
  description: string;
}

export const profileAccessGroups: ProfileAccessGroup[] = [
  {
    id: "supervision",
    label: "Supervisión",
    description: "Módulos de gestión de equipo, turnos y performance.",
  },
  {
    id: "operacion",
    label: "Operación",
    description: "Directorios y catálogos de uso cotidiano.",
  },
  {
    id: "herramientas",
    label: "Herramientas",
    description: "Utilidades para resolver tareas de soporte.",
  },
  {
    id: "admin",
    label: "Administración",
    description: "Gestión de usuarios, auditoría y datos del sistema.",
  },
];

export const profileAccessCatalog: ProfileAccessEntry[] = [
  {
    href: "/supervision/cronograma",
    title: "Cronograma",
    description: "Planificación de turnos y guardias del equipo.",
    icon: "boxicons:calendar-filled",
    iconTone: "bg-error/10 text-error",
    group: "supervision",
  },
  {
    href: "/supervision/asistencia",
    title: "Control de asistencia",
    description: "Presentismo y cumplimiento de los horarios pactados.",
    icon: "boxicons:clock-filled",
    iconTone: "bg-success/10 text-success",
    group: "supervision",
  },
  {
    href: "/supervision/calidad-operadores",
    title: "Calidad de operadores",
    description: "Auditorías de llamadas y métricas de rendimiento.",
    icon: "boxicons:bar-chart-big-filled",
    iconTone: "bg-warning/10 text-warning",
    group: "supervision",
  },
  {
    href: "/supervision/asignacion-autogestiones",
    title: "Asignación de autogestiones",
    description: "Gestión de tareas de autogestión del equipo.",
    icon: "boxicons:git-branch-filled",
    iconTone: "bg-secondary/10 text-secondary",
    group: "supervision",
  },
  {
    href: "/titulos",
    title: "Títulos",
    description: "Títulos normalizados listos para la tipificación de tickets.",
    icon: "boxicons:list-ul-filled",
    iconTone: "bg-warning/10 text-warning",
    group: "operacion",
  },
  {
    href: "/mesas-de-ayuda",
    title: "Mesas de Ayuda",
    description: "Matriz de soportes, derivaciones y canales de escalado.",
    icon: "boxicons:headphone-mic-filled",
    iconTone: "bg-accent/10 text-accent",
    group: "operacion",
  },
  {
    href: "/oficinas",
    title: "Oficinas",
    description: "Mapa de cobertura y directorio de oficinas y sucursales.",
    icon: "boxicons:building-house-filled",
    iconTone: "bg-success/10 text-success",
    group: "operacion",
  },
  {
    href: "/inventario-terminales",
    title: "Inventario de terminales",
    description: "Estado, asignación y monitoreo de terminales y cubics.",
    icon: "boxicons:desktop-filled",
    iconTone: "bg-accent/10 text-accent",
    group: "operacion",
  },
  {
    href: "/contactos",
    title: "Contactos",
    description: "Teléfonos, correos y enlaces de servicios y proveedores.",
    icon: "boxicons:phone-filled",
    iconTone: "bg-secondary/10 text-secondary",
    group: "operacion",
  },
  {
    href: "/recursos",
    title: "Enlaces y recursos",
    description: "Centraliza accesos a plataformas internas y externas.",
    icon: "boxicons:link-filled",
    iconTone: "bg-error/10 text-error",
    group: "herramientas",
  },
  {
    href: "/recursos/aplicativos",
    title: "Aplicativos",
    description: "Descargas de herramientas para la operatoria diaria.",
    icon: "boxicons:grid-circle-diagonal-right-filled",
    iconTone: "bg-neutral/10 text-neutral",
    group: "herramientas",
  },
  {
    href: "/base-conocimiento",
    title: "Base de Conocimiento",
    description: "Guías, procedimientos y documentación de la mesa.",
    icon: "boxicons:book-filled",
    iconTone: "bg-info/10 text-info",
    group: "herramientas",
  },
  {
    href: "/buscador-usuarios",
    title: "Buscador de usuarios",
    description: "Encuentra personal interno para chequear datos y accesos.",
    icon: "boxicons:user-search-filled",
    iconTone: "bg-info/10 text-info",
    group: "herramientas",
  },
  {
    href: "/generador-firmas",
    title: "Generador de firmas",
    description: "Genera firmas institucionales para correo electrónico.",
    icon: "boxicons:pencil-draw-filled",
    iconTone: "bg-accent/10 text-accent",
    group: "herramientas",
  },
  {
    href: "/admin/usuarios",
    title: "Usuarios y roles",
    description: "Gestiona usuarios, roles, mesas y accesos del portal.",
    icon: "boxicons:group-filled",
    iconTone: "bg-error/10 text-error",
    group: "admin",
  },
  {
    href: "/admin/invgate/ubicaciones",
    title: "Ubicaciones InvGate",
    description: "Vincular empleados con su sucursal de InvGate.",
    icon: "boxicons:location-alt-filled",
    iconTone: "bg-accent/10 text-accent",
    group: "admin",
  },
  {
    href: "/admin/auditoria",
    title: "Auditoría",
    description: "Registro de acciones realizadas sobre los datos del sistema.",
    icon: "boxicons:history-filled",
    iconTone: "bg-info/10 text-info",
    group: "admin",
  },
  {
    href: "/admin/feedback",
    title: "Sugerencias y reportes",
    description: "Reclamos, solicitudes y errores reportados por usuarios.",
    icon: "boxicons:mail-open-filled",
    iconTone: "bg-warning/10 text-warning",
    group: "admin",
  },
  {
    href: "/admin/papelera",
    title: "Papelera",
    description: "Recuperá elementos eliminados del sistema.",
    icon: "boxicons:trash-filled",
    iconTone: "bg-neutral/10 text-neutral",
    group: "admin",
  },
];

export function isProfileRouteAllowed(
  href: string,
  role: string,
  helpdeskName: string | null,
): boolean {
  if (!hasPermission(href, normalizeRole(role))) return false;
  return isSectionVisibleSync(helpdeskName, role, href);
}

export interface ProfileAccessSection extends ProfileAccessGroup {
  entries: ProfileAccessEntry[];
}

export function getVisibleProfileAccess(
  role: string,
  helpdeskName: string | null,
): ProfileAccessSection[] {
  return profileAccessGroups
    .map((group) => ({
      ...group,
      entries: profileAccessCatalog.filter(
        (entry) =>
          entry.group === group.id &&
          isProfileRouteAllowed(entry.href, role, helpdeskName),
      ),
    }))
    .filter((group) => group.entries.length > 0);
}

export interface ProfileEmployee {
  fullname: string;
  dni: string;
  interno: string | null;
  telefono: string | null;
  position: string | null;
  invgateExists: boolean | null;
  invgateId: number | null;
  sucursal: string | null;
  officeName: string | null;
}

export interface ProfileAgent {
  name: string;
  location: string | null;
  horarioDefault: string | null;
  estadoExcepcional: string | null;
  estadoExcepcionalMotivo: string | null;
  enCronograma: boolean;
  enAsistencia: boolean;
  asignableCubic: boolean;
  incluidoCalidad: boolean;
  asignableAgs: boolean;
}

export interface ProfileDetails {
  employee: ProfileEmployee | null;
  agent: ProfileAgent | null;
  sessionExpiresAt: number | null;
}

export async function getProfileDetails(params: {
  userId: number;
  username: string;
  sessionId?: string | null;
}): Promise<ProfileDetails> {
  const [employee] = await db
    .select({
      fullname: employees.fullname,
      dni: employees.dni,
      interno: employees.interno,
      telefono: employees.telefono,
      position: employees.position,
      invgateExists: employees.invgateExists,
      invgateId: employees.invgateId,
      sucursal: employees.sucursal,
      officeName: offices.name,
    })
    .from(employees)
    .leftJoin(offices, eq(offices.code, employees.sucursal))
    .where(eq(employees.username, params.username))
    .limit(1);

  const [agent] = await db
    .select({
      name: agents.name,
      location: agents.location,
      horarioDefault: agents.horarioDefault,
      estadoExcepcional: agents.estadoExcepcional,
      estadoExcepcionalMotivo: agents.estadoExcepcionalMotivo,
      enCronograma: agents.enCronograma,
      enAsistencia: agents.enAsistencia,
      asignableCubic: agents.asignableCubic,
      incluidoCalidad: agents.incluidoCalidad,
      asignableAgs: agents.asignableAgs,
    })
    .from(agents)
    .where(
      or(eq(agents.userId, params.userId), eq(agents.username, params.username)),
    )
    .limit(1);

  let sessionExpiresAt: number | null = null;
  if (params.sessionId) {
    const [session] = await db
      .select({ expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.id, params.sessionId))
      .limit(1);
    sessionExpiresAt = session?.expiresAt ?? null;
  }

  return { employee: employee ?? null, agent: agent ?? null, sessionExpiresAt };
}

export function formatSessionExpiry(expiresAt: number | null): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  const day = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${day} ${time}`;
}
