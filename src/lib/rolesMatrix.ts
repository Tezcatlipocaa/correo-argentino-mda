// Tabla DESCRIPTIVA de capacidades por rol, renderizada en /admin/usuarios
// ("tabla comparativa de permisos") y usada por `isAllowed` para gating de UI.
// NO es la fuente de verdad: la matriz real vive en `rbac.ts`
// (`getModulePermissions` + `routePermissions` + `hasPermission`) y en
// `helpdeskAccess.ts` (visibilidad por mesa). Si una fila discrepa de esas,
// el bug esta en esta tabla. El test
// `tests/unit/roles-matrix-consistency.test.ts` cubre las filas mapeables.
//
// Nota: la visibilidad efectiva de varias filas (cronograma, cubics, calidad,
// autogestiones, asistencia) tambien depende de la mesa del usuario
// (`isSectionVisibleSync`). Esta tabla modela solo la capa de rol; el gating
// por mesa no se representa aca (es por mesa, no por rol).
import { KB_ACCESS_ROLES, type Role } from "./rbac";

const kbRole = (role: Role): boolean => KB_ACCESS_ROLES.includes(role);

export type RoleMatrixFeature = {
  feature: string;
  icon: string;
  agent: boolean;
  referent: boolean;
  team_leader: boolean;
  supervisor: boolean;
  admin: boolean;
};

export const rolesMatrix: RoleMatrixFeature[] = [
  {
    feature: "Ver Oficinas",
    icon: "boxicons:building-house-filled",
    agent: true,
    referent: true,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Ver Enlaces",
    icon: "boxicons:git-branch-filled",
    agent: true,
    referent: true,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Ver Títulos",
    icon: "boxicons:note-filled",
    agent: true,
    referent: true,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Ver Base de Conocimiento",
    icon: "boxicons:book-library-filled",
    agent: kbRole("agent"),
    referent: kbRole("referent"),
    team_leader: kbRole("team_leader"),
    supervisor: kbRole("supervisor"),
    admin: kbRole("admin"),
  },
  {
    feature: "Administrar Base de Conocimiento",
    icon: "boxicons:book-library-filled",
    agent: kbRole("agent"),
    referent: kbRole("referent"),
    team_leader: kbRole("team_leader"),
    supervisor: kbRole("supervisor"),
    admin: kbRole("admin"),
  },
  {
    feature: "Ver Mesas de Ayuda",
    icon: "boxicons:headphone-filled",
    agent: true,
    referent: true,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Ver Inventario",
    icon: "boxicons:chip-filled",
    agent: true,
    referent: true,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Generar Firmas",
    icon: "boxicons:edit-alt-filled",
    agent: true,
    referent: true,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Ver Cronogramas",
    icon: "boxicons:calendar-filled",
    agent: true,
    referent: true,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Métricas Propias",
    icon: "boxicons:user-id-card-filled",
    agent: true,
    referent: true,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Gestión de Calidad",
    icon: "boxicons:star-filled",
    agent: false,
    referent: true,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Autogestiones",
    icon: "boxicons:user-check-filled",
    agent: false,
    referent: true,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Editar Cronogramas",
    icon: "boxicons:calendar-filled",
    agent: false,
    referent: false,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Asistencia",
    icon: "boxicons:clock-filled",
    agent: false,
    referent: false,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Administrar Títulos",
    icon: "boxicons:note-filled",
    agent: false,
    referent: false,
    team_leader: true,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Administrar Contenido",
    icon: "boxicons:task-filled",
    agent: false,
    referent: false,
    team_leader: false,
    supervisor: true,
    admin: true,
  },
  {
    feature: "Administrar Usuarios",
    icon: "boxicons:group-filled",
    agent: false,
    referent: false,
    team_leader: false,
    supervisor: false,
    admin: true,
  },
  {
    feature: "Logs de Auditoría",
    icon: "boxicons:history-filled",
    agent: false,
    referent: false,
    team_leader: false,
    supervisor: false,
    admin: true,
  },
];

export const isAllowed = (featureName: string, role: string) => {
  const feature = rolesMatrix.find((f) => f.feature === featureName);
  const normalizedRole = role.replace(/[- ]/g, "_");
  return feature
    ? feature[normalizedRole as keyof typeof feature] === true
    : false;
};
