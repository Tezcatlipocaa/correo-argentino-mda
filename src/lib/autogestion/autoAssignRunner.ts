import { getUnassignedTicketsByHelpdesk } from "@/lib/invgate/agsTickets";
import { getDisponibilidadHoy } from "@lib/disponibilidad";
import { evaluateAllAutogestionRules, executeAutoAssignment } from "./rulesEngine";

export interface AutoAssignCycleResult {
  evaluatedCount: number;
  assignedCount: number;
  assignedTickets: Array<{
    ticketId: number;
    ticketNumber: string;
    assignedTo: string;
    ruleId: string;
  }>;
  errors: string[];
  skippedDueToLock?: boolean;
}

let isRunning = false;

/**
 * Consulta si hay un ciclo de autoasignación ejecutándose actualmente.
 */
export function isAutoAssignCycleRunning(): boolean {
  return isRunning;
}

/**
 * Ejecuta un ciclo completo de evaluación y asignación automática de autogestiones.
 * Implementa control de concurrencia y tolerancia a fallos para proteger la API de InvGate.
 */
export async function runAutoAssignCycle(
  authorLabel: string = "Automatización MDA"
): Promise<AutoAssignCycleResult> {
  if (isRunning) {
    console.warn("[AutoAssignRunner] Se omitió el ciclo debido a una ejecución concurrente en curso.");
    return {
      evaluatedCount: 0,
      assignedCount: 0,
      assignedTickets: [],
      errors: [],
      skippedDueToLock: true,
    };
  }

  isRunning = true;

  const result: AutoAssignCycleResult = {
    evaluatedCount: 0,
    assignedCount: 0,
    assignedTickets: [],
    errors: [],
    skippedDueToLock: false,
  };

  try {
    // 1. Obtener tickets sin asignar de la mesa de autogestión (3950)
    const unassignedRes = await getUnassignedTicketsByHelpdesk(3950);
    if (!unassignedRes.ok) {
      const err = `Error al consultar tickets sin asignar de InvGate: ${unassignedRes.error || "Desconocido"}`;
      console.error(`[AutoAssignRunner] ${err}`);
      result.errors.push(err);
      return result;
    }

    const tickets = unassignedRes.tickets || [];
    result.evaluatedCount = tickets.length;

    if (tickets.length === 0) {
      return result;
    }

    // 2. Obtener disponibilidad calculada en tiempo real de los operadores
    const allOperators = await getDisponibilidadHoy();
    const assignableOperators = allOperators.filter((op) => op.asignableAgs !== false);

    // 3. Evaluar reglas de automatización
    const actionable = evaluateAllAutogestionRules(tickets, assignableOperators);

    if (actionable.length === 0) {
      return result;
    }

    // 4. Ejecutar asignaciones automáticas encontradas
    for (const ruleMatch of actionable) {
      try {
        const execRes = await executeAutoAssignment(ruleMatch, authorLabel);
        if (execRes.success) {
          result.assignedCount++;
          result.assignedTickets.push({
            ticketId: execRes.ticketId,
            ticketNumber: execRes.ticketNumber,
            assignedTo: execRes.assignedTo || "Desconocido",
            ruleId: execRes.ruleId,
          });
          console.log(
            `[AutoAssignRunner] Ticket ${execRes.ticketNumber} autoasignado con éxito a ${execRes.assignedTo} vía regla '${ruleMatch.ruleName}'`
          );
        } else if (execRes.error) {
          result.errors.push(execRes.error);
        }
      } catch (assignErr: any) {
        const msg = `Excepción al autoasignar ticket #${ruleMatch.ticketId}: ${assignErr?.message || assignErr}`;
        console.error(`[AutoAssignRunner] ${msg}`);
        result.errors.push(msg);
      }
    }

    return result;
  } catch (globalErr: any) {
    const msg = `Error inesperado en ciclo de autoasignación: ${globalErr?.message || globalErr}`;
    console.error(`[AutoAssignRunner] ${msg}`);
    result.errors.push(msg);
    return result;
  } finally {
    isRunning = false;
  }
}
