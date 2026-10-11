import type { WorkflowNodeLifecycle } from "./node-status";

/**
 * Clases DaisyUI por ciclo de vida de nodo, compartidas entre el punto de la
 * timeline (AutomationNodeCard) y el badge de estado (WorkflowNodeBadge) para
 * que no diverjan.
 */

/** Color del punto del timeline. */
export const NODE_LIFECYCLE_DOT_CLASSES: Readonly<
  Record<WorkflowNodeLifecycle, string>
> = {
  completed: "bg-success",
  in_progress: "bg-info",
  pending: "bg-warning",
  blocked: "bg-error",
  skipped: "bg-neutral opacity-60",
  not_applicable: "bg-neutral opacity-60",
  unknown: "bg-neutral",
};

/** Variante del badge de estado (soft: tinte suave en vez de relleno sólido). */
export const NODE_LIFECYCLE_BADGE_CLASSES: Readonly<
  Record<WorkflowNodeLifecycle, string>
> = {
  completed: "badge-soft badge-success",
  in_progress: "badge-soft badge-info",
  pending: "badge-soft badge-warning",
  blocked: "badge-soft badge-error",
  skipped: "badge-soft badge-neutral italic",
  not_applicable: "badge-soft badge-neutral line-through",
  unknown: "badge-soft badge-neutral",
};
