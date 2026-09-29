import { db } from "@db/index";
import { assignmentHistory } from "@db/schema";
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

export { evaluateRejectedRequestRule };

/**
 * Catálogo documental de automatizaciones programadas para la asignación de autogestiones.
 * Utilizado para informar a los supervisores en la interfaz de usuario.
 */
export const AUTOGESTION_AUTOMATION_RULES: AutogestionRuleDoc[] = [
  {
    id: "solicitud_rechazada",
    name: "Devolución de Solicitudes Rechazadas",
    description:
      "Asigna de manera autónoma al operador creador aquellos tickets que ingresan a la mesa con la categoría 'Solicitud rechazada en revisión', permitiendo que el operador subsane o complete la gestión de forma inmediata.",
    status: "active",
    intervalMinutes: 10,
    triggerEvent: "Sondeo automático cada 10 minutos y al refrescar la cola de autogestiones",
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
      "El ticket se reasigna automáticamente en InvGate al operador con una nota de verificación y registro auditable en historial. No retrasa ni altera la posición del operador en la ronda cíclica general (skipQueueUpdate).",
    updatedAt: "2026-09-29",
  },
];

/**
 * Evalúa una lista de tickets sin asignar contra todas las reglas activas.
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

  for (const ticket of tickets) {
    // 1. Regla: Solicitudes rechazadas en revisión
    const rejectedEval = evaluateRejectedRequestRule(ticket, allOperators);
    if (rejectedEval.canAssign) {
      actionableResults.push(rejectedEval);
      continue; // Un ticket solo se asigna por una regla a la vez
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
  const { ticketId, ticketNumber, targetOperator, ruleId, ruleName } = evaluation;

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
      const commentMessage = `Asignado automáticamente por regla de autogestión: ${ruleName}. Para su correspondiente subsanación y verificación.`;
      await addTicketComment(ticketId, commentMessage, authorId, 1);
    } catch (commentErr: any) {
      console.warn(
        `[AutoAssignment] No se pudo agregar comentario explicativo al ticket #${ticketId}:`,
        commentErr?.message || commentErr
      );
    }

    // 3. Registrar auditoría en historial (tipo 'automatica')
    const now = Date.now();
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

    // 4. Invalidar caché en memoria de tickets sin asignar
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
