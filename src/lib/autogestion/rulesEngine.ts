import { db } from "@db/index";
import { agents, assignmentHistory } from "@db/schema";
import { eq } from "drizzle-orm";
import {
  reassignTicketToAgent,
  addTicketComment,
  invalidateUnassignedTicketsCache,
} from "@/lib/invgate/agsTickets";
import type { AgentDisponibilidad } from "@lib/disponibilidad";
import type {
  AutogestionRuleDoc,
  RuleEvaluationResult,
  AutoAssignmentExecutionResult,
} from "./types";
import { evaluateRejectedRequestRule } from "./rules/rejectedRequestRule";
import { evaluateGeneralCyclicRule } from "./rules/generalCyclicRule";

export { evaluateRejectedRequestRule, evaluateGeneralCyclicRule };

/**
 * Catálogo documental de automatizaciones programadas para la asignación de autogestiones.
 * Utilizado para informar a los supervisores en la interfaz de usuario con orden de prioridad.
 */
export const AUTOGESTION_AUTOMATION_RULES: AutogestionRuleDoc[] = [
  {
    id: "solicitud_rechazada",
    priority: 1,
    name: "Devolución de Solicitudes Rechazadas",
    description:
      "Asigna de manera autónoma al operador creador aquellos tickets que ingresan a la mesa con la categoría 'Solicitud rechazada en revisión', permitiendo que el operador subsane o complete la gestión de forma inmediata.",
    status: "active",
    intervalMinutes: 10,
    triggerEvent: "Sondeo automático cada 10 minutos (Prioridad 1)",
    conditions: [
      {
        label: "Categoría del Ticket",
        description: "El ticket debe pertenecer a la categoría 'Solicitud rechazada en revisión'.",
        required: true,
      },
      {
        label: "Creador Operador MDA",
        description: "El usuario que generó el ticket debe ser un operador registrado en la Mesa de Ayuda.",
        required: true,
      },
      {
        label: "Disponibilidad en Tiempo Real",
        description: "El operador debe encontrarse dentro de su horario de jornada, sin break activo y con estado disponible.",
        required: true,
      },
      {
        label: "Asignable a Autogestiones",
        description: "El operador debe tener activo el atributo asignable para la cola de autogestiones.",
        required: true,
      },
    ],
    effect:
      "El ticket se reasigna automáticamente en InvGate al operador creador con una nota de verificación y registro auditable en historial. No retrasa ni altera la posición del operador en la ronda cíclica general (skipQueueUpdate).",
    updatedAt: "2026-09-29",
  },
  {
    id: "asignacion_ciclica_general",
    priority: 2,
    name: "Asignación Cíclica de Nuevas Autogestiones",
    description:
      "Distribuye de manera autónoma las nuevas autogestiones de categorías generales al operador disponible que encabeza la fila de espera cíclica (mayor tiempo sin recibir AGS o sin asignaciones previas hoy).",
    status: "active",
    intervalMinutes: 10,
    triggerEvent: "Sondeo automático cada 10 minutos (Prioridad 2, posterior a Solicitudes Rechazadas)",
    conditions: [
      {
        label: "Categoría General / Cliente",
        description: "Tickets de la mesa 3950 que no correspondan a 'Solicitud rechazada en revisión' (o creados por clientes externos).",
        required: true,
      },
      {
        label: "Turno en Cola Cíclica",
        description: "Operador disponible y asignable que encabeza la fila de espera cíclica (menor timestamp o sin asignación hoy).",
        required: true,
      },
      {
        label: "Disponibilidad en Tiempo Real",
        description: "El operador debe encontrarse en jornada laboral, sin break activo y con estado disponible.",
        required: true,
      },
      {
        label: "Asignable a Autogestiones",
        description: "El operador debe tener activo el atributo asignable para la cola de autogestiones.",
        required: true,
      },
    ],
    effect:
      "El ticket se reasigna en InvGate al próximo operador en cola, publica la nota pública 'Se asigna para su gestión.' y actualiza su último tiempo de asignación en base de datos rotando su turno hacia el final de la fila de espera.",
    updatedAt: "2026-09-29",
  },
];

/**
 * Evalúa una lista de tickets sin asignar aplicando precedencia estricta de reglas:
 * 1. Primero evalúa y asigna todas las solicitudes rechazadas a sus respectivos creadores.
 * 2. Los tickets restantes se distribuyen en cascada entre los operadores disponibles por turno cíclico
 *    (un ticket por operador disponible por ciclo hasta agotar tickets o disponibilidad).
 */
export function evaluateAllAutogestionRules(
  tickets: Array<{
    id: number;
    pretty_id?: string;
    category_name?: string;
    category_last_name?: string;
    creator_id?: number;
    creator_username?: string;
    creator_name?: string;
  }>,
  allOperators: AgentDisponibilidad[]
): RuleEvaluationResult[] {
  const actionableResults: RuleEvaluationResult[] = [];
  const assignedAgentIdsInCycle = new Set<number>();
  const unhandledTickets: typeof tickets = [];

  // Paso 1: Precedencia estricta - Evaluar regla 1 (Solicitudes rechazadas en revisión)
  for (const ticket of tickets) {
    const eligibleForP1 = allOperators.filter((op) => !assignedAgentIdsInCycle.has(op.agentId));
    const rejectedEval = evaluateRejectedRequestRule(ticket, eligibleForP1);
    if (rejectedEval.canAssign && rejectedEval.targetOperator) {
      rejectedEval.skipQueueUpdate = true;
      actionableResults.push(rejectedEval);
      assignedAgentIdsInCycle.add(rejectedEval.targetOperator.agentId);
    } else {
      unhandledTickets.push(ticket);
    }
  }

  // Paso 2: Evaluar regla 2 (Asignación cíclica general en cascada sobre los tickets restantes)
  for (const ticket of unhandledTickets) {
    const availableOperatorsForCyclic = allOperators.filter(
      (op) => !assignedAgentIdsInCycle.has(op.agentId)
    );
    if (availableOperatorsForCyclic.length === 0) {
      break;
    }

    const cyclicEval = evaluateGeneralCyclicRule(ticket, availableOperatorsForCyclic);
    if (cyclicEval.canAssign && cyclicEval.targetOperator) {
      actionableResults.push(cyclicEval);
      assignedAgentIdsInCycle.add(cyclicEval.targetOperator.agentId);
    }
  }

  return actionableResults;
}

/**
 * Ejecuta la asignación automática en InvGate y la base de datos local
 * siguiendo las políticas de preservación de cola cíclica y registro de auditoría.
 */
export async function executeAutoAssignment(
  evaluation: RuleEvaluationResult,
  authorName: string = "Automatización MDA"
): Promise<AutoAssignmentExecutionResult> {
  const { ticketId, ticketNumber, targetOperator, ruleId, ruleName, skipQueueUpdate, customComment } = evaluation;

  if (!targetOperator || !targetOperator.invgateId) {
    return {
      success: false,
      ticketId,
      ticketNumber,
      ruleId,
      error: "No se proporcionó un operador de destino válido con ID de InvGate.",
    };
  }

  const targetInvgateId = targetOperator.invgateId;
  const authorId = targetInvgateId || 1;

  try {
    // 1. Reasignar ticket en InvGate Helpdesk 3950
    const reassignRes = await reassignTicketToAgent(ticketId, targetInvgateId, 3950, authorId);
    if (!reassignRes.ok) {
      return {
        success: false,
        ticketId,
        ticketNumber,
        ruleId,
        error: `Error al reasignar ticket en InvGate: ${reassignRes.message}`,
      };
    }

    // 2. Publicar comentario automático aclaratorio
    try {
      const commentMessage =
        customComment ||
        (ruleId === "asignacion_ciclica_general"
          ? "Se asigna para su gestión."
          : `Asignado automáticamente por regla de autogestión: ${ruleName}. Para su correspondiente subsanación y verificación.`);
      await addTicketComment(ticketId, commentMessage, authorId, 1);
    } catch (commentErr: any) {
      console.warn(
        `[AutoAssignment] No se pudo agregar comentario explicativo al ticket #${ticketId}:`,
        commentErr?.message || commentErr
      );
    }

    const now = Date.now();

    // 3. Si la regla requiere rotar la cola (skipQueueUpdate === false), actualizar timestamp en agents
    if (skipQueueUpdate === false) {
      try {
        await db
          .update(agents)
          .set({
            lastAutogestionAssignedAt: now,
            lastAutogestionAssignedBy: `${authorName} (${ruleName})`,
          })
          .where(eq(agents.id, targetOperator.agentId));
      } catch (dbErr) {
        console.error(
          `[AutoAssignment] Error al actualizar tiempo de asignación en agents para ID ${targetOperator.agentId}:`,
          dbErr
        );
      }
    }

    // 4. Registrar auditoría en historial (tipo 'automatica')
    try {
      await db.insert(assignmentHistory).values({
        agentId: targetOperator.agentId,
        agentName: targetOperator.nombre,
        ticketNumber: ticketNumber || `#${ticketId}`,
        assignedBy: `${authorName} (${ruleName})`,
        assignedAt: now,
        type: "automatica",
      });
    } catch (histErr) {
      console.error("[AutoAssignment] Error guardando historial de asignación automática:", histErr);
    }

    // 5. Invalidar caché en memoria de tickets sin asignar
    invalidateUnassignedTicketsCache();

    return {
      success: true,
      ticketId,
      ticketNumber,
      assignedTo: targetOperator.nombre,
      agentId: targetOperator.agentId,
      ruleId,
    };
  } catch (error: any) {
    console.error(`[AutoAssignment] Excepción al ejecutar asignación para ticket #${ticketId}:`, error);
    return {
      success: false,
      ticketId,
      ticketNumber,
      ruleId,
      error: error?.message || "Error desconocido al procesar la asignación automática.",
    };
  }
}
