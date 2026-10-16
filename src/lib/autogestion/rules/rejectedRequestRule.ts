import type { AgentDisponibilidad } from "@lib/disponibilidad";
import type { RuleEvaluationResult } from "../types";

/**
 * Normaliza un string eliminando acentos, caracteres especiales y pasando a minúsculas.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const REJECTED_REQUEST_TARGET_CATEGORY = "solicitud rechazada en revision";

/**
 * El nombre de la categoría NO es estable entre instancias de InvGate: en QA es
 * "Solicitud rechazada en revisión" (singular) y en producción
 * "Solicitudes rechazadas en revisión" (plural, id 2591). Comparar por el
 * singular con `includes` nunca matcheaba en prod.
 */
const REJECTED_CATEGORY_PATTERN = /solicitud(?:es)?\s+rechazadas?\s+en\s+revision/;

export function isRejectedRequestCategory(
  name: string | null | undefined
): boolean {
  return REJECTED_CATEGORY_PATTERN.test(normalizeText(name));
}

/**
 * Evalúa si un ticket de InvGate cumple con la regla de autoasignación por solicitud rechazada:
 * 1. Categoría = "Solicitud rechazada en revisión"
 * 2. Creador del ticket = Operador de Mesa de Ayuda registrado
 * 3. Operador creador = Actualmente disponible y asignable para autogestiones
 */
export function evaluateRejectedRequestRule(
  ticket: {
    id: number;
    pretty_id?: string;
    category_name?: string;
    category_last_name?: string;
    creator_id?: number;
    creator_username?: string;
    creator_name?: string;
  },
  allOperators: AgentDisponibilidad[]
): RuleEvaluationResult {
  const ticketId = ticket.id;
  const ticketNumber = ticket.pretty_id || `#${ticket.id}`;
  const ruleId = "solicitud_rechazada";
  const ruleName = "Devolución de Solicitudes Rechazadas";

  // 1. Evaluar Categoría
  const matchesCategory =
    isRejectedRequestCategory(ticket.category_last_name) ||
    isRejectedRequestCategory(ticket.category_name);

  if (!matchesCategory) {
    return {
      ruleId,
      ruleName,
      ticketId,
      ticketNumber,
      matchesCategory: false,
      isMdaOperator: false,
      isOperatorAvailable: false,
      canAssign: false,
      reason: `La categoría '${ticket.category_last_name || ticket.category_name || "Sin categoría"}' no corresponde a '${REJECTED_REQUEST_TARGET_CATEGORY}'.`,
    };
  }

  // 2. Evaluar si el Creador es un Operador de MDA
  const ticketCreatorUserClean = normalizeText(
    (ticket.creator_username || "").split("@")[0]
  );
  const ticketCreatorId = ticket.creator_id;
  const ticketCreatorNameClean = normalizeText(ticket.creator_name || "");

  const matchedOperator = allOperators.find((op) => {
    // Coincidencia prioritaria por InvGate ID
    if (ticketCreatorId && op.invgateId && op.invgateId === ticketCreatorId) {
      return true;
    }
    // Coincidencia por username corporativo
    if (op.username && ticketCreatorUserClean) {
      const opUserClean = normalizeText(op.username.split("@")[0]);
      if (opUserClean && opUserClean === ticketCreatorUserClean) {
        return true;
      }
    }
    // Coincidencia por nombre completo si no hay colisión de ID/username
    if (op.nombre && ticketCreatorNameClean && !ticketCreatorId && !ticketCreatorUserClean) {
      const opNameClean = normalizeText(op.nombre);
      if (opNameClean && opNameClean === ticketCreatorNameClean) {
        return true;
      }
    }
    return false;
  });

  if (!matchedOperator) {
    return {
      ruleId,
      ruleName,
      ticketId,
      ticketNumber,
      matchesCategory: true,
      isMdaOperator: false,
      isOperatorAvailable: false,
      canAssign: false,
      reason: `El creador '${ticket.creator_name || ticket.creator_username || ticket.creator_id || "Desconocido"}' no corresponde a un operador registrado en la Mesa de Ayuda.`,
    };
  }

  // 3. Evaluar Disponibilidad y si es asignable para Autogestiones
  const isAvailable = Boolean(matchedOperator.disponible);
  const isAssignable = matchedOperator.asignableAgs !== false; // true por defecto si no es falso
  const hasInvgateId = Boolean(matchedOperator.invgateId);

  if (!isAssignable) {
    return {
      ruleId,
      ruleName,
      ticketId,
      ticketNumber,
      matchesCategory: true,
      isMdaOperator: true,
      isOperatorAvailable: false,
      canAssign: false,
      targetOperator: matchedOperator,
      reason: `El operador creador ${matchedOperator.nombre} no está configurado como asignable para autogestiones.`,
    };
  }

  if (!isAvailable) {
    return {
      ruleId,
      ruleName,
      ticketId,
      ticketNumber,
      matchesCategory: true,
      isMdaOperator: true,
      isOperatorAvailable: false,
      canAssign: false,
      targetOperator: matchedOperator,
      reason: `El operador creador ${matchedOperator.nombre} no está disponible actualmente (${matchedOperator.motivo || "No disponible"}).`,
    };
  }

  if (!hasInvgateId) {
    return {
      ruleId,
      ruleName,
      ticketId,
      ticketNumber,
      matchesCategory: true,
      isMdaOperator: true,
      isOperatorAvailable: true,
      canAssign: false,
      targetOperator: matchedOperator,
      reason: `El operador creador ${matchedOperator.nombre} no tiene un ID de InvGate vinculado.`,
    };
  }

  return {
    ruleId,
    ruleName,
    ticketId,
    ticketNumber,
    matchesCategory: true,
    isMdaOperator: true,
    isOperatorAvailable: true,
    canAssign: true,
    targetOperator: matchedOperator,
  };
}
