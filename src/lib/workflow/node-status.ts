/**
 * Ciclo de vida normalizado de un nodo del workflow.
 * Estados: completed | in_progress | pending | blocked | skipped |
 * not_applicable | unknown.
 */
export type WorkflowNodeLifecycle =
  | "completed"
  | "in_progress"
  | "pending"
  | "blocked"
  | "skipped"
  | "not_applicable"
  | "unknown";

export const NODE_LIFECYCLE_LABELS: Readonly<
  Record<WorkflowNodeLifecycle, string>
> = {
  completed: "Completado",
  in_progress: "En progreso",
  pending: "Pendiente",
  blocked: "Bloqueado",
  skipped: "Omitido",
  not_applicable: "No aplica",
  unknown: "Desconocido",
};

/**
 * MAPEO v1 — SUPUESTO DOCUMENTADO (2026-08):
 *
 * Los IDs de estado provienen de /incident.attributes.status (validado).
 * La SEMÁNTICA de cada estado respecto al avance del workflow es supuesta:
 * en QA existe evidencia solo de solicitudes en estado 2 ("Abierto"); ningún
 * hijo ha alcanzado estados terminales todavía (ni siquiera los hijos de
 * procesos que avanzaron hace días permanecen en Abierto).
 *
 * Hipótesis adoptada (semántica estándar de InvGate Service Management):
 * - 1 Nuevo       -> pending      (creado, sin trabajo iniciado)
 * - 2 Abierto     -> in_progress  (en ejecución)
 * - 3 Pendiente   -> blocked      (esperando a terceros/datos)
 * - 4 En espera   -> blocked
 * - 5 Solucionado -> completed
 * - 6 Cerrado     -> completed
 * - 7 Rechazado   -> not_applicable (excluido del progreso)
 * - 8 Cancelado   -> not_applicable
 *
 * Revisar contra datos reales cuando exista la primera automatización con
 * pasos terminados en producción/QA.
 */
const REQUEST_STATUS_LIFECYCLE: Readonly<Record<number, WorkflowNodeLifecycle>> =
  {
    1: "pending",
    2: "in_progress",
    3: "blocked",
    4: "blocked",
    5: "completed",
    6: "completed",
    7: "not_applicable",
    8: "not_applicable",
  };

/**
 * Mapeo de tareas internas (/incident.tasks), según documentación oficial:
 * 0 OPEN, 1 FINISHED, 2 DELETED, 3 SKIPPED. Sin muestras reales aún ([] en QA).
 */
const TASK_STATUS_LIFECYCLE: Readonly<Record<number, WorkflowNodeLifecycle>> = {
  0: "pending",
  1: "completed",
  2: "skipped",
  3: "skipped",
};

export function mapRequestStatusToLifecycle(statusId: number): WorkflowNodeLifecycle {
  return REQUEST_STATUS_LIFECYCLE[statusId] ?? "unknown";
}

export function mapTaskStatusToLifecycle(statusId: number): WorkflowNodeLifecycle {
  return TASK_STATUS_LIFECYCLE[statusId] ?? "unknown";
}

export interface WorkflowProgress {
  completed: number;
  /** Nodos aplicables: excluye skipped/not_applicable (progreso solo sobre aplicables). */
  applicableTotal: number;
  percent: number;
}

const NON_APPLICABLE_LIFECYCLES: ReadonlySet<WorkflowNodeLifecycle> = new Set([
  "skipped",
  "not_applicable",
]);

export function computeWorkflowProgress(
  lifecycles: readonly WorkflowNodeLifecycle[],
): WorkflowProgress {
  const applicable = lifecycles.filter(
    (lifecycle) => !NON_APPLICABLE_LIFECYCLES.has(lifecycle),
  );
  const completed = applicable.filter((lifecycle) => lifecycle === "completed");

  return {
    completed: completed.length,
    applicableTotal: applicable.length,
    percent:
      applicable.length === 0
        ? 0
        : Math.round((completed.length / applicable.length) * 100),
  };
}
