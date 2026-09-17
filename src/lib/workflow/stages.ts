import { db } from "@db/index";
import {
  workflowStages,
  workflowStageTickets,
  type workflowStageTickets as WorkflowStageTicketsTable,
} from "@db/schema";
import { asc } from "drizzle-orm";
import type { AutomationNode } from "./resolver";
import { normalizeLabel, stripLeadingOrdinals } from "./labels";
import { compareChronologically } from "./sort";

/**
 * Plantilla global de etapas del workflow de automatizaciones.
 *
 * Cada etapa agrupa "tickets esperados" (templates) que se matchean contra el
 * step label de los tickets hijos vinculados al padre en InvGate (texto
 * previo al primer " - " del título). El match es tolerante: normaliza
 * casing/acentos, unifica marcadores ordinales ("1°", "1º", "1er") y acepta
 * prefijo, para cubrir réplicas numeradas por InvGate ("2° Configuración...").
 */

export type StageStatus = "waiting" | "in_progress" | "completed";

/**
 * Tipo de automatización: `workflow` = flujo AUTSUC nuevo (5 etapas, gates,
 * Go/No Go); `legacy` = casos manuales anteriores a Luis Guillón (3 etapas
 * simplificadas, sin gates ni Go/No Go).
 */
export type WorkflowKind = "workflow" | "legacy";

type StageTemplateRow = typeof workflowStages.$inferSelect;
export type StageTicketTemplateRow = typeof WorkflowStageTicketsTable.$inferSelect;

/** Labels que matchean un template: matchLabel + aliases configurados. */
export function templateMatchLabels(ticket: {
  matchLabel: string;
  aliases?: string[] | null;
}): string[] {
  const aliases = Array.isArray(ticket.aliases) ? ticket.aliases : [];
  return [ticket.matchLabel, ...aliases].filter(
    (label) => typeof label === "string" && label.trim().length > 0,
  );
}

/** Frases de descripción que también matchean un template (fallback). */
export function templateMatchDescriptions(ticket: {
  matchDescription?: string[] | null;
}): string[] {
  const phrases = Array.isArray(ticket.matchDescription)
    ? ticket.matchDescription
    : [];
  return phrases.filter(
    (phrase) => typeof phrase === "string" && phrase.trim().length > 0,
  );
}

export interface WorkflowTemplate {
  stages: StageTemplateRow[];
  tickets: StageTicketTemplateRow[];
}

export interface StageItemGroup {
  template: StageTicketTemplateRow;
  /** Etiqueta display (displayName ?? matchLabel). */
  label: string;
  blocking: boolean;
  /** Nodos hijos de InvGate que matchean este template (cronológico). */
  nodes: AutomationNode[];
  /** Sin nodos matcheados: se debe mostrar como nodo fantasma "faltante". */
  missing: boolean;
  /** Todos los nodos matcheados en estado terminal resuelto. */
  completed: boolean;
}

export interface StageGroup {
  template: StageTemplateRow;
  status: StageStatus;
  /** Gate: label del item que habilita la etapa (si corresponde). */
  gateLabel: string | null;
  /** true si el gate ya está resuelto (o no hay gate). */
  gateSatisfied: boolean;
  items: StageItemGroup[];
  completedBlocking: number;
  totalBlocking: number;
}

export interface StageGrouping {
  groups: StageGroup[];
  /** Nodos que no matchean ningún template de la plantilla. */
  stagelessNodes: AutomationNode[];
  /** Templates bloqueantes sin ticket asociado (0 para automatizaciones finalizadas). */
  missingBlockingCount: number;
}



/** Conectores gramaticales sin peso propio para el matching por tokens. */
const CONNECTOR_TOKENS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "y",
  "e",
  "o",
  "en",
  "a",
]);

const MIN_SIGNIFICANT_TOKEN_LENGTH = 3;

function significantTokens(normalizedLabel: string): string[] {
  return normalizedLabel
    .split(/\s+/)
    .filter(Boolean)
    .filter(
      (token) =>
        token.length >= MIN_SIGNIFICANT_TOKEN_LENGTH &&
        !CONNECTOR_TOKENS.has(token),
    );
}

function tokenPairMatches(nodeToken: string, templateToken: string): boolean {
  return (
    nodeToken.startsWith(templateToken) || templateToken.startsWith(nodeToken)
  );
}

/**
 * Score de match de una etiqueta candidata contra un matchLabel:
 * - 1.0: igualdad o prefijo (tras normalizar y quitar ordinales).
 * - 0.9: cobertura total por tokens en alguna dirección (títulos con
 *   detalles extra o más cortos, ej: "Solicitud Smart Point").
 * - 0: sin match.
 */
function matchScore(label: string, matchLabel: string): number {
  const nodeKey = labelMatchKey(label);
  if (nodeKey.length === 0) {
    return 0;
  }
  const templateKey = labelMatchKey(matchLabel);
  if (templateKey.length === 0) {
    return 0;
  }
  if (nodeKey === templateKey || nodeKey.startsWith(templateKey)) {
    return 1;
  }
  // Coincidencia total por tokens en AMBAS direcciones:
  // - la plantilla cubierta por el nodo (título con detalles extra), o
  // - el nodo subconjunto de la plantilla (títulos más cortos reales).
  // En el lado inverso (nodo corto) se exigen al menos 2 tokens matcheados
  // para no matchear títulos genéricos de una sola palabra ("Solicitud").
  const nodeTokens = significantTokens(nodeKey);
  const templateTokens = significantTokens(templateKey);
  const matchedTemplateTokens = templateTokens.filter((templateToken) => {
    if (
      nodeTokens.some((nodeToken) =>
        tokenPairMatches(nodeToken, templateToken),
      )
    ) {
      return true;
    }
    return nodeTokens.some((nodeToken, index) => {
      const pairs = [
        index > 0 ? `${nodeTokens[index - 1]}${nodeToken}` : null,
        index + 1 < nodeTokens.length
          ? `${nodeToken}${nodeTokens[index + 1]}`
          : null,
      ].filter((pair) => pair !== null);
      return pairs.some((pair) =>
        tokenPairMatches(pair, templateToken),
      );
    });
  });
  if (
    matchedTemplateTokens.length === templateTokens.length &&
    templateTokens.length > 0
  ) {
    return 0.9;
  }
  const nodeCoversTemplate = nodeCoversTemplateCheck(
    nodeTokens,
    templateTokens,
  );
  if (
    matchedTemplateTokens.length >= 2 &&
    nodeCoversTemplate
  ) {
    return 0.9;
  }
  return 0;
}

function nodeCoversTemplateCheck(
  nodeTokens: readonly string[],
  templateTokens: readonly string[],
): boolean {
  if (nodeTokens.length === 0 || templateTokens.length === 0) {
    return false;
  }
  return nodeTokens.every((nodeToken, index) => {
    if (
      templateTokens.some((templateToken) =>
        tokenPairMatches(nodeToken, templateToken),
      )
    ) {
      return true;
    }
    // Token absorbido por un par vecino unido ("smart"+"point" ≈ "smartpoints").
    const pairs = [
      index > 0 ? `${nodeTokens[index - 1]}${nodeToken}` : null,
      index + 1 < nodeTokens.length
        ? `${nodeToken}${nodeTokens[index + 1]}`
        : null,
    ].filter((pair) => pair !== null);
    return pairs.some((pair) =>
      templateTokens.some((templateToken) =>
        tokenPairMatches(pair, templateToken),
      ),
    );
  });
}

/**
 * Fallback por descripción: todas las palabras significativas de la frase
 * deben aparecer en la descripción del nodo. Score fijo 0.5 para que cualquier
 * match por label (0.9/1.0) gane. Se usa con títulos duplicados (los dos
 * "Instalaciones para AUTSUC…": relevamiento vs visita técnica).
 */
function descriptionMatchScore(
  nodeDescription: string,
  phrase: string,
): number {
  const descriptionTokens = new Set(
    significantTokens(normalizeLabel(nodeDescription)),
  );
  const phraseTokens = significantTokens(normalizeLabel(phrase));
  if (descriptionTokens.size === 0 || phraseTokens.length === 0) {
    return 0;
  }
  const allPresent = phraseTokens.every((phraseToken) =>
    [...descriptionTokens].some((descriptionToken) =>
      tokenPairMatches(descriptionToken, phraseToken),
    ),
  );
  return allPresent ? 0.5 : 0;
}

function labelMatchKey(raw: string): string {
  return stripLeadingOrdinals(normalizeLabel(raw));
}

/**
 * Lee la plantilla global de etapas. Query SQLite local: barata, sin cache.
 * Null cuando no hay etapas configuradas (la vista cae a la timeline plana).
 */
export async function loadWorkflowTemplate(): Promise<WorkflowTemplate | null> {
  try {
    const stages = await db
      .select()
      .from(workflowStages)
      .orderBy(asc(workflowStages.position), asc(workflowStages.id));

    if (stages.length === 0) {
      return null;
    }

    const tickets = await db
      .select()
      .from(workflowStageTickets)
      .orderBy(
        asc(workflowStageTickets.stageId),
        asc(workflowStageTickets.position),
        asc(workflowStageTickets.id),
      );

    return { stages, tickets };
  } catch {
    return null;
  }
}

const NODE_RESOLVED_LIFECYCLES: ReadonlySet<string> = new Set([
  "completed",
  "skipped",
  "not_applicable",
]);

function itemStageForNodes(nodes: readonly AutomationNode[]): StageStatus {
  if (nodes.length === 0) {
    return "in_progress";
  }
  if (nodes.every((node) => NODE_RESOLVED_LIFECYCLES.has(node.lifecycle))) {
    return "completed";
  }
  return "in_progress";
}

/**
 * Agrupa los nodos del detalle por etapas según la plantilla.
 * Los nodos siempre aparecen: los no matcheados van al grupo "Sin etapa".
 */
export function buildStageGroups(
  nodes: readonly AutomationNode[],
  template: WorkflowTemplate | null,
  options: { finalized?: boolean; workflowKind?: WorkflowKind } = {},
): StageGrouping {
  const finalized = options.finalized ?? false;
  const workflowKind = options.workflowKind ?? "workflow";
  const stagelessNodes: AutomationNode[] = [];
  if (!template || template.stages.length === 0) {
    return {
      groups: [],
      stagelessNodes: [...nodes],
      missingBlockingCount: 0,
    };
  }

  const activeStages = template.stages.filter(
    (stage) => (stage.scope ?? "workflow") === workflowKind,
  );

  if (activeStages.length === 0) {
    return {
      groups: [],
      stagelessNodes: [...nodes],
      missingBlockingCount: 0,
    };
  }

  // Template id -> estado construido (para resolver gates entre etapas).
  const itemById = new Map<number, StageItemGroup>();
  const groupsByStageId = new Map<number, StageGroup & { items: StageItemGroup[] }>();

  for (const stage of activeStages) {
    groupsByStageId.set(stage.id, {
      template: stage,
      status: "waiting",
      gateLabel: null,
      gateSatisfied: true,
      items: [],
      completedBlocking: 0,
      totalBlocking: 0,
    });
  }

  const stageTicketTemplates = template.tickets
    .filter((ticket) => groupsByStageId.has(ticket.stageId))
    .sort(
      (a, b) =>
        groupsByStageId.get(b.stageId)!.template.position -
          groupsByStageId.get(a.stageId)!.template.position ||
        b.stageId - a.stageId ||
        b.position - a.position ||
        b.id - a.id,
    )
    .reverse();

  for (const ticketTemplate of stageTicketTemplates) {
    itemById.set(ticketTemplate.id, {
      template: ticketTemplate,
      label: ticketTemplate.displayName?.trim()
        ? ticketTemplate.displayName
        : ticketTemplate.matchLabel,
      blocking: ticketTemplate.blocking,
      nodes: [],
      missing: true,
      completed: false,
    });
  }

  const groupedItems = [...itemById.values()];

  const nodeCandidateLabels = (node: AutomationNode): string[] => {
    const segments = node.title
      .split(/\s+-\s+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    return [node.stepLabel, ...segments];
  };

  const nodeMatchScore = (node: AutomationNode, matchLabel: string): number => {
    let bestScore = 0;
    for (const candidate of nodeCandidateLabels(node)) {
      const score = matchScore(candidate, matchLabel);
      if (score >= 1) {
        return 1;
      }
      if (score > bestScore) {
        bestScore = score;
      }
    }
    return bestScore;
  };

  /** Mejor score del nodo contra matchLabel + aliases del template. */
  const nodeTemplateScore = (
    node: AutomationNode,
    itemGroup: StageItemGroup,
  ): number => {
    let best = 0;
    for (const label of templateMatchLabels(itemGroup.template)) {
      const score = nodeMatchScore(node, label);
      if (score >= 1) {
        return 1;
      }
      if (score > best) {
        best = score;
      }
    }
    if (best > 0) {
      return best;
    }
    // Fallback por descripción (títulos duplicados).
    const description = node.description ?? "";
    for (const phrase of templateMatchDescriptions(itemGroup.template)) {
      const score = descriptionMatchScore(description, phrase);
      if (score > best) {
        best = score;
      }
    }
    return best;
  };

  for (const node of nodes) {
    let best = null;
    let bestScore = 0;
    for (const itemGroup of groupedItems) {
      const score = nodeTemplateScore(node, itemGroup);
      if (score > bestScore) {
        best = itemGroup;
        bestScore = score;
      }
    }
    if (best && bestScore > 0) {
      best.nodes.push(node);
      best.missing = false;
    } else {
      stagelessNodes.push(node);
    }
  }

  for (const itemGroup of itemById.values()) {
    itemGroup.nodes.sort(compareChronologically);
    itemGroup.completed =
      itemStageForNodes(itemGroup.nodes) === "completed";
  }

  // Armar grupos finales por etapa (items ya vienen ordenados por position).
  for (const ticketTemplate of stageTicketTemplates) {
    const itemGroup = itemById.get(ticketTemplate.id)!;
    const stageGroup = groupsByStageId.get(ticketTemplate.stageId)!;
    stageGroup.items.push(itemGroup);
    if (itemGroup.blocking) {
      stageGroup.totalBlocking += 1;
      if (itemGroup.completed) {
        stageGroup.completedBlocking += 1;
      }
    }
  }

  let missingBlockingCount = 0;
  if (workflowKind === "workflow") {
    for (const stageGroup of groupsByStageId.values()) {
      for (const itemGroup of stageGroup.items) {
        if (itemGroup.blocking && itemGroup.missing && !finalized) {
          missingBlockingCount += 1;
        }
      }
    }
  }

  // Nota: los templates de stages inexistentes ya se filtraron arriba.

  const gatesSatisfiedById = new Map<number, boolean>();

  function gateSatisfied(gateItemId: number | null): boolean {
    if (gateItemId === null) {
      return true;
    }
    const cached = gatesSatisfiedById.get(gateItemId);
    if (cached !== undefined) {
      return cached;
    }
    // Gate desconocido (item de etapa inexistente) -> no bloquea.
    const itemGroup = itemById.get(gateItemId);
    const satisfied = itemGroup
      ? itemGroup.completed
      : true;
    gatesSatisfiedById.set(gateItemId, satisfied);
    return satisfied;
  }

  const orderedStages = [...activeStages].sort(
    (a, b) => a.position - b.position || a.id - b.id,
  );

  const groups: StageGroup[] = orderedStages.map((stage) => {
    const stageGroup = groupsByStageId.get(stage.id)!;
    const satisfied =
      workflowKind === "legacy" ? true : gateSatisfied(stage.gateItemId);
    stageGroup.gateSatisfied = satisfied;
    stageGroup.gateLabel =
      stage.gateItemId !== null
        ? (itemById.get(stage.gateItemId)?.label ?? null)
        : null;

    // Una etapa sin tickets bloqueantes (p. ej. "Cierre", cuyas acciones no
    // son tickets hijos) se completa recién cuando finaliza el padre, para no
    // quedar "En curso" para siempre. Si tiene bloqueantes, se completa cuando
    // todos ellos resuelven.
    const allBlockingResolved =
      stageGroup.totalBlocking === 0
        ? finalized
        : stageGroup.completedBlocking === stageGroup.totalBlocking;

    stageGroup.status = !satisfied
      ? "waiting"
      : allBlockingResolved
        ? "completed"
        : "in_progress";

    return stageGroup;
  });

  return { groups, stagelessNodes, missingBlockingCount };
}
