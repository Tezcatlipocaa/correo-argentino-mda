import type { AgentDisponibilidad } from "@lib/disponibilidad";
import type { RuleEvaluationResult } from "../types";

import { isRejectedRequestCategory } from "./rejectedRequestRule";

/**
 * Ordena los operadores disponibles según el orden cíclico de autogestión:
 * - Operadores sin asignaciones previas hoy (null) tienen prioridad absoluta.
 * - Luego, operadores ordenados por menor timestamp (mayor tiempo sin recibir AGS).
 */
export function sortOperatorsByCyclicQueue(
  operators: AgentDisponibilidad[]
): AgentDisponibilidad[] {
  return [...operators].sort((a, b) => {
    const tA = a.lastAutogestionAssignedAt ?? 0;
    const tB = b.lastAutogestionAssignedAt ?? 0;
    if (a.lastAutogestionAssignedAt === null && b.lastAutogestionAssignedAt !== null) return -1;
    if (a.lastAutogestionAssignedAt !== null && b.lastAutogestionAssignedAt === null) return 1;
    return tA - tB;
  });
}

/**
 * Evalúa si un ticket general de autogestión puede ser asignado al próximo operador en cola.
 * Verifica previamente que NO sea una "Solicitud rechazada en revisión", ya que esa categoría
 * tiene su propia regla y política de atención.
 *
 * `includeRejected` lo activa `evaluateAllAutogestionRules` solo con los tickets que
 * la regla de rechazadas NO pudo asignar (creador ausente o no disponible, o P1
 * apagada): sin eso, esas solicitudes rechazadas quedaban sin dueño en la mesa para
 * siempre, porque las dos reglas se excluían mutuamente.
 */
export function evaluateGeneralCyclicRule(
  ticket: {
    id: number;
    pretty_id?: string;
    category_name?: string;
    category_last_name?: string;
    creator_id?: number;
    creator_username?: string;
    creator_name?: string;
  },
  allOperators: AgentDisponibilidad[],
  options: { includeRejected?: boolean } = {}
): RuleEvaluationResult {
  const ticketId = ticket.id;
  const ticketNumber = ticket.pretty_id || `#${ticket.id}`;
  const ruleId = "asignacion_ciclica_general";
  const ruleName = "Asignación Cíclica de Nuevas Autogestiones";

  // 1. Verificar que NO sea una "Solicitud rechazada en revisión"
  const isRejectedCategory =
    !options.includeRejected &&
    (isRejectedRequestCategory(ticket.category_last_name) ||
      isRejectedRequestCategory(ticket.category_name));

  if (isRejectedCategory) {
    return {
      ruleId,
      ruleName,
      ticketId,
      ticketNumber,
      matchesCategory: false,
      isMdaOperator: false,
      isOperatorAvailable: false,
      canAssign: false,
      skipQueueUpdate: false,
      reason: "El ticket posee la categoría 'Solicitud rechazada en revisión' y no corresponde a la asignación cíclica general.",
    };
  }

  // Filtrar operadores disponibles, con perfil asignable a AGS y con ID de InvGate
  const eligibleOperators = allOperators.filter(
    (op) => op.disponible && op.asignableAgs !== false && Boolean(op.invgateId)
  );

  if (eligibleOperators.length === 0) {
    return {
      ruleId,
      ruleName,
      ticketId,
      ticketNumber,
      matchesCategory: true,
      isMdaOperator: false,
      isOperatorAvailable: false,
      canAssign: false,
      skipQueueUpdate: false,
      reason: "No hay operadores disponibles o asignables a autogestiones en la cola cíclica.",
    };
  }

  // Ordenar por turno cíclico
  const sortedQueue = sortOperatorsByCyclicQueue(eligibleOperators);
  const nextOperator = sortedQueue[0];

  return {
    ruleId,
    ruleName,
    ticketId,
    ticketNumber,
    matchesCategory: true,
    isMdaOperator: false, // Regla general para tickets de cliente/terceros
    isOperatorAvailable: true,
    canAssign: true,
    skipQueueUpdate: false, // SÍ debe actualizar su tiempo para rotar la cola
    customComment: "Se asigna para su gestión.",
    targetOperator: nextOperator,
  };
}
