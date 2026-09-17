import { getIncidents, getSolutionComments } from "@lib/invgate/automation/incidents";
import { getIncidentLinks } from "@lib/invgate/automation/links";
import { getIncidentTasks } from "@lib/invgate/automation/tasks";
import { deriveInvGateUiUrl } from "@lib/invgate/automation/url";
import { getBranchLocation } from "./branch-location";
import type {
  InvgateAutomationIncident,
  InvgateIncidentLink,
  InvgateIncidentTask,
} from "@lib/invgate/automation/types";
import { htmlToPlainText } from "@lib/format/html-to-text";
import {
  cleanInvGateTitle,
  parseAutomationBranchTitle,
  parseStepLabel,
  buildAutomationDisplayName,
} from "./branch-title";
import { branchNameFromDescription } from "./branch-display";
import { resolveAutomationCategoryId } from "./category-resolver";
import { parseInitialForm } from "./initial-form";
import type { ParsedInitialForm } from "./initial-form";
import {
  parseInstalacionesDescription,
  toParsedInitialForm,
} from "./instalaciones-form";
import {
  computeWorkflowProgress,
  mapRequestStatusToLifecycle,
  mapTaskStatusToLifecycle,
} from "./node-status";
import type { WorkflowNodeLifecycle } from "./node-status";
import {
  buildStageGroups,
  loadWorkflowTemplate,
} from "./stages";
import type { StageGrouping, WorkflowKind } from "./stages";
import { isFinalizedStatus } from "./automation-status";
import { sortChronologically } from "./sort";
import { getUsersByIds } from "@lib/invgate/automation/users";
import {
  getWorkflowRequest,
  parseWorkflowInitialFields,
} from "@lib/invgate/automation/workflow-request";
import type { WorkflowInitialFields } from "@lib/invgate/automation/workflow-request";
import { resolveSectorNames } from "@lib/invgate/automation/helpdesk-names";
import {
  AUTO_CLOSE_REASON,
  getClosure,
  recordClosure,
  removeClosure,
  shouldAutoClose,
} from "./closures";
import type { AutomationClosure } from "./closures";
import { invalidateDiscoveryCache } from "./discovery";

export interface WorkflowNodeActivity {
  createdAt: number;
  text: string;
  /** Autor del comentario en InvGate (id crudo). */
  authorId: number | null;
  /** Nombre display del autor; null si no se pudo resolver. */
  authorName: string | null;
}

export interface AutomationTask {
  refId: number;
  name: string;
  lifecycle: WorkflowNodeLifecycle;
  assignedGroupId: number | null;
  assignedId: number | null;
  completedAt: number | null;
  /** Nombre del sector (nivel → helpdesk padre); null si no se resolvió. */
  sectorName: string | null;
}

export interface AutomationNode {
  kind: "request" | "task";
  refId: number;
  prettyId: string | null;
  stepLabel: string;
  title: string;
  /** Descripción del request en texto plano (fallback de matching por etapa). */
  description: string;
  lifecycle: WorkflowNodeLifecycle;
  rawStatusId: number;
  /** Epoch de creación; null cuando el bulk no devolvió detalles del request. */
  createdAt: number | null;
  invgateUrl: string;
  activity: WorkflowNodeActivity[];
  /** Comentario marcado como solución (solo nodos completados que lo tengan). */
  solution: string | null;
  /** Autor del comentario de solución; null si no aplica o no se resolvió. */
  solutionAuthorName: string | null;
  /** Tareas internas del request (/incident.tasks). */
  tasks: AutomationTask[];
}

/** Formulario inicial completado al crear la automatización (primer comentario del padre). */
export interface AutomationInitialForm {
  createdAt: number;
  text: string;
  /** Campos parseados; null cuando el texto no corresponde a la plantilla de sucursal. */
  parsed: ParsedInitialForm | null;
  /** Nombre del autor si el formulario vino de un comentario. */
  authorName: string | null;
}

export interface AutomationDetail {
  id: number;
  prettyId: string;
  title: string;
  displayName: string;
  statusId: number;
  processId: number;
  createdAt: number;
  closedAt: number | null;
  initialForm: AutomationInitialForm | null;
  nodes: AutomationNode[];
  /**
   * Agrupación por etapas según la plantilla global configurada (null = sin
   * etapas configuradas: la vista cae a la timeline plana cronológica).
   */
  stages: StageGrouping | null;
  /** `workflow` = flujo AUTSUC nuevo; `legacy` = casos manuales previos. */
  workflowKind: WorkflowKind;
  progress: { completed: number; applicableTotal: number; percent: number };
  /** Región/localidad: jerarquía del formulario o DB de oficinas por código. */
  location: { region: string | null; locality: string | null } | null;
  /** Cierre local en el portal (manual o auto); null si sigue en curso. */
  closure: AutomationClosure | null;
}

export type AutomationDetailResult =
  | { ok: true; detail: AutomationDetail }
  | { ok: false; message: string };

/**
 * Cache de detalles por id (TTL corto): el detalle consulta links/tasks/bulk
 * por cada apertura; para monitoreo, un desfase de minutos es tolerable y
 * el cache acota el consumo de API ante aperturas repetidas.
 *
 * Estrategia de served para la navegación (single-flight + stale-while-revalidate):
 * - Entrada fresca (< TTL) -> se devuelve al instante.
 * - Pipeline en flight del mismo id -> los llamadores concurrentes (hidratación
 *   de la barra del listado + navegación al detalle) comparten la misma
 *   promesa, sin contención de API ni trabajo duplicado.
 * - Entrada vencida pero dentro del tope de staleness (30 min) -> se devuelve
 *   el último dato conocido al instante y la pipeline corre en background
 *   para refrescar. Ids jamás vistos esperan la pipeline (única vía lenta).
 */
const DETAIL_CACHE_TTL_MS = 2 * 60_000;
const DETAIL_STALE_MAX_MS = 30 * 60_000;
const DETAIL_CACHE_MAX_ENTRIES = 50;

interface CachedDetailEntry {
  result: AutomationDetailResult;
  expiresAt: number;
  cachedAt: number;
}

const detailCache = new Map<number, CachedDetailEntry>();
const inflightDetail = new Map<number, Promise<AutomationDetailResult>>();

function runDetailPipeline(
  automationId: number,
): Promise<AutomationDetailResult> {
  const existing = inflightDetail.get(automationId);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const result = await resolveAutomationDetailUncached(automationId);
      if (result.ok) {
        detailCache.set(automationId, {
          result,
          expiresAt: Date.now() + DETAIL_CACHE_TTL_MS,
          cachedAt: Date.now(),
        });

        if (detailCache.size > DETAIL_CACHE_MAX_ENTRIES) {
          const oldest = detailCache.keys().next().value;
          if (oldest !== undefined) {
            detailCache.delete(oldest);
          }
        }
      }
      return result;
    } finally {
      inflightDetail.delete(automationId);
    }
  })();

  inflightDetail.set(automationId, promise);
  return promise;
}

export async function resolveAutomationDetail(
  automationId: number,
): Promise<AutomationDetailResult> {
  const cached = detailCache.get(automationId);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const inFlight = inflightDetail.get(automationId);
  if (inFlight) {
    return inFlight;
  }

  if (cached && now - cached.cachedAt <= DETAIL_STALE_MAX_MS) {
    void runDetailPipeline(automationId);
    return cached.result;
  }

  return runDetailPipeline(automationId);
}

/**
 * Invalida el detalle cacheado de una automatización (memoria + in-flight)
 * cuando cambia su estado local (cierre/reapertura) para que el próximo render
 * no sirva un `closure` viejo.
 */
export function invalidateAutomationDetail(automationId: number): void {
  detailCache.delete(automationId);
  inflightDetail.delete(automationId);
}

function toActivity(
  comments:
    | readonly {
        message: string;
        created_at: number;
        author_id?: number;
      }[]
    | undefined,
): WorkflowNodeActivity[] {
  if (!comments) {
    return [];
  }
  return [...comments]
    .sort((a, b) => a.created_at - b.created_at)
    .map((comment) => ({
      createdAt: comment.created_at,
      text: htmlToPlainText(comment.message),
      authorId:
        typeof comment.author_id === "number" ? comment.author_id : null,
      authorName: null,
    }));
}

function buildRequestNodes(
  links: readonly InvgateIncidentLink[],
  incidentsById: Record<string, InvgateAutomationIncident>,
): AutomationNode[] {
  const nodes = links.map((link) => {
    const incident = incidentsById[String(link.id)];
    const cleanTitle = cleanInvGateTitle(link.title);
    // El bulk puede omitir campos del request (title undefined observado en
    // producción): los títulos de link y bulk se combinan con degradación.
    const incidentTitle = incident ? cleanInvGateTitle(incident.title ?? "") : "";

    if (!incident) {
      // El enlace existe pero el bulk no devolvió detalles del request.
      return {
        kind: "request" as const,
        refId: link.id,
        prettyId: `#${link.id}`,
        stepLabel: parseStepLabel(cleanTitle),
        title: cleanTitle,
        description: "",
        lifecycle: mapRequestStatusToLifecycle(-1),
        rawStatusId: -1,
        createdAt: null,
        invgateUrl: deriveInvGateUiUrl(link.id),
        activity: [],
        solution: null,
        solutionAuthorName: null,
        tasks: [],
      };
    }

    return {
      kind: "request" as const,
      refId: incident.id,
      prettyId: incident.pretty_id,
      stepLabel: parseStepLabel(incidentTitle || cleanTitle),
      title: incidentTitle,
      description: htmlToPlainText(incident.description ?? ""),
      lifecycle: mapRequestStatusToLifecycle(incident.status_id),
      rawStatusId: incident.status_id,
      createdAt: incident.created_at,
      invgateUrl: deriveInvGateUiUrl(incident.id),
      activity: toActivity(incident.comments),
      solution: null,
      solutionAuthorName: null,
      tasks: [],
    };
  });

  return sortChronologically(nodes);
}

/** Convierte las tareas internas de un request al modelo de la card. */
function toAutomationTasks(
  tasks: readonly InvgateIncidentTask[],
): AutomationTask[] {
  return tasks.map((task) => ({
    refId: task.task_id,
    name: task.name,
    lifecycle: mapTaskStatusToLifecycle(task.status),
    assignedGroupId:
      typeof task.helpdesk_id === "number" ? task.helpdesk_id : null,
    assignedId: typeof task.agent_id === "number" ? task.agent_id : null,
    completedAt:
      typeof task.completed_at === "number" ? task.completed_at : null,
    sectorName: null,
  }));
}

/**
 * Busca entre los hijos vinculados el primero con data de INSTALACIONES
 * (título "Instalaciones para AUTSUC #...") y description parseable. Los
 * hijos con data siempre vienen del bulk del detalle (padre + hijos,
 * comments=1). De los duplicados gana el más nuevo (contiene el mismo
 * encabezado de Sucursal/Jefe).
 */
function findInstalacionesChild(
  links: readonly InvgateIncidentLink[],
  incidentsById: Record<string, InvgateAutomationIncident>,
): InvgateAutomationIncident | null {
  const candidates = links
    .map((link) => incidentsById[String(link.id)])
    .filter(
      (incident): incident is InvgateAutomationIncident =>
        typeof incident === "object" &&
        incident !== null &&
        Boolean(incident.description),
    )
    .filter((incident) =>
      /^instalaciones para autsuc/i.test(
        cleanInvGateTitle(incident.title ?? "").trim(),
      ),
    )
    .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

  return candidates[0] ?? null;
}

/**
 * Clasifica la automatización para elegir el layout de etapas:
 * - `workflow`: título del padre "AUTSUC …" o hijo "Instalaciones para AUTSUC".
 * - `legacy`: casos manuales anteriores a Luis Guillón.
 */
export function detectWorkflowKind(
  parentTitle: string,
  nodes: readonly AutomationNode[],
): WorkflowKind {
  if (/^autsuc\b/i.test(parentTitle.trim())) {
    return "workflow";
  }
  const hasInstalacionesChild = nodes.some((node) =>
    /^instalaciones para autsuc/i.test(node.title.trim()),
  );
  return hasInstalacionesChild ? "workflow" : "legacy";
}

/**
 * Mergea los initial fields del workflow (best-effort `/wf.request`) sobre el
 * formulario parseado. Los valores del workflow ganan cuando están presentes;
 * si no había formulario, se crea uno base.
 */
export function mergeWorkflowInitialFields(
  parsed: ParsedInitialForm | null,
  fields: WorkflowInitialFields,
): ParsedInitialForm {
  const base: ParsedInitialForm = parsed ?? {
    intro: [],
    sucursal: null,
    ipRange: null,
    estimatedEnd: null,
    jefe: null,
    jefeZonal: null,
    otherFields: [],
  };

  const mergedJefe = {
    name: fields.jefeName ?? base.jefe?.name ?? null,
    dni: fields.jefeDni ?? base.jefe?.dni ?? null,
    legajo: fields.jefeLegajo ?? base.jefe?.legajo ?? null,
    extras: base.jefe?.extras ?? [],
  };
  const hasJefe =
    mergedJefe.name !== null ||
    mergedJefe.dni !== null ||
    mergedJefe.legajo !== null ||
    mergedJefe.extras.length > 0;

  const otherFields = [...base.otherFields];
  if (fields.nis && !otherFields.some((f) => /^nis$/i.test(f.label.trim()))) {
    otherFields.push({ label: "NIS", value: fields.nis });
  }

  return {
    ...base,
    jefe: hasJefe ? mergedJefe : null,
    jefeZonal: fields.jefeZonal ?? base.jefeZonal ?? null,
    otherFields,
  };
}

/**
 * Pipeline v2 de una automatización (mismo costo HTTP que v1):
 * links + tasks en paralelo → UN solo bulk /incidents (padre+hijos, comments=1) →
 * validación de categoría sobre el padre ya traído → nodos con actividad +
 * formulario inicial + progreso.
 *
 * Dato empírico v1: la secuencia de pasos sigue el orden temporal de creación
 * (arriba el primero); el desempate usa el ID ascendente observado.
 */
/**
 * Detalle de una automatización. El pipeline en sí vive en
 * resolveAutomationDetailUncached.
 */
async function resolveAutomationDetailUncached(
  automationId: number,
): Promise<AutomationDetailResult> {
  const linksResult = await getIncidentLinks(automationId);

  if (!linksResult.ok) {
    return { ok: false, message: linksResult.message };
  }

  const linkIds = linksResult.data.map((link) => link.id);
  const [detailsResult, childTasksResults] = await Promise.all([
    getIncidents([automationId, ...linkIds], { includeComments: true }),
    Promise.all(linkIds.map((id) => getIncidentTasks(id))),
  ]);

  if (!detailsResult.ok) {
    return {
      ok: false,
      message: `No se pudieron obtener los detalles de la automatización: ${detailsResult.message}`,
    };
  }

  const parentIncident = detailsResult.data[String(automationId)];

  if (!parentIncident) {
    return {
      ok: false,
      message: `El ticket ${automationId} no existe en InvGate.`,
    };
  }

  if (parentIncident.category_id !== (await resolveAutomationCategoryId())) {
    return {
      ok: false,
      message: `El ticket ${automationId} no pertenece a la categoría de automatizaciones (category_id=${parentIncident.category_id})`,
    };
  }

  const nodes = buildRequestNodes(linksResult.data, detailsResult.data);

  // Tareas internas por request vinculado → se muestran dentro de su card.
  const tasksByRef = new Map<number, InvgateIncidentTask[]>();
  childTasksResults.forEach((result, index) => {
    if (result.ok) {
      tasksByRef.set(linkIds[index], result.data);
    }
  });
  const taskGroupIds: number[] = [];
  for (const node of nodes) {
    node.tasks = toAutomationTasks(tasksByRef.get(node.refId) ?? []);
    for (const task of node.tasks) {
      if (task.assignedGroupId) {
        taskGroupIds.push(task.assignedGroupId);
      }
    }
  }
  const sectorNames = await resolveSectorNames(taskGroupIds);
  for (const node of nodes) {
    for (const task of node.tasks) {
      task.sectorName = task.assignedGroupId
        ? (sectorNames.get(task.assignedGroupId) ?? null)
        : null;
    }
  }

  const completedRequestIds = nodes
    .filter((node) => node.kind === "request" && node.lifecycle === "completed")
    .map((node) => node.refId);
  const [solutions, template] = await Promise.all([
    getSolutionComments(completedRequestIds),
    loadWorkflowTemplate(),
  ]);
  const solutionAuthorByRef = new Map<number, number | null>();
  for (const node of nodes) {
    const solution = solutions.get(node.refId);
    node.solution = solution ? htmlToPlainText(solution.message) : null;
    solutionAuthorByRef.set(node.refId, solution?.authorId ?? null);
  }

  const cleanedTitle = cleanInvGateTitle(parentIncident.title);

  /**
   * Fuentes del formulario inicial (2026-09, ambas validadas):
   * 1. Description del padre (formato histórico de producción).
   * 2. Primer comentario del padre (formato QA / formularios por comentario).
   * El comentario de reasignación de mesa históricamente pisaba la description
   * cuando se prefería el comentario: ahora la description gana.
   */
  const parentFormComment = toActivity(parentIncident.comments)[0] ?? null;

  const descriptionSource =
    parentIncident.description && parentIncident.description.length > 0
      ? {
          createdAt: parentIncident.created_at,
          text: htmlToPlainText(parentIncident.description),
        }
      : null;

  let formSource: {
    createdAt: number;
    text: string;
    authorId?: number | null;
  } | null = descriptionSource;
  let parsedForm = formSource ? parseInitialForm(formSource.text) : null;

  if (parsedForm === null && parentFormComment) {
    formSource = parentFormComment;
    parsedForm = parseInitialForm(formSource.text);
  }

  /**
   * Tercera fuente (workflow AUTSUC 2026-09, ticket 79867): el padre llega sin
   * description ni comentarios; la solicitud vive en la description de los
   * hijos "Instalaciones para AUTSUC #...". Ante un texto no reconocido el
   * parser devuelve null y la UI degrada al texto crudo o al título.
   */
  if (parsedForm === null) {
    const instalacionesChild = findInstalacionesChild(
      linksResult.data,
      detailsResult.data,
    );
    if (instalacionesChild) {
      const instalacionesInfo = parseInstalacionesDescription(
        htmlToPlainText(instalacionesChild.description ?? ""),
      );
      if (instalacionesInfo) {
        const fallbackAuthorshipDate =
          instalacionesChild.created_at ?? parentIncident.created_at;
        formSource = {
          createdAt: fallbackAuthorshipDate,
          text: htmlToPlainText(instalacionesChild.description ?? ""),
        };
        parsedForm = toParsedInitialForm(instalacionesInfo);
      }
    }
  }

  // Best-effort: initial fields del workflow (/wf.request). En instancias que
  // todavía no exponen el endpoint devuelve null y todo queda igual.
  const workflowFields = parseWorkflowInitialFields(
    await getWorkflowRequest(parentIncident.id),
  );
  if (workflowFields) {
    parsedForm = mergeWorkflowInitialFields(parsedForm, workflowFields);
    if (!formSource) {
      formSource = { createdAt: parentIncident.created_at, text: "" };
    }
  }

  // Resolución única de nombres de autores de comentarios (actividad,
  // solución y formulario si vino de un comentario).
  const authorIds = new Set<number>();
  for (const node of nodes) {
    for (const entry of node.activity) {
      if (entry.authorId) {
        authorIds.add(entry.authorId);
      }
    }
  }
  for (const authorId of solutionAuthorByRef.values()) {
    if (authorId) {
      authorIds.add(authorId);
    }
  }
  const formAuthorId =
    parentFormComment && formSource === parentFormComment
      ? parentFormComment.authorId
      : null;
  if (formAuthorId) {
    authorIds.add(formAuthorId);
  }

  const authorNames = await getUsersByIds([...authorIds]);
  for (const node of nodes) {
    for (const entry of node.activity) {
      if (entry.authorId) {
        entry.authorName = authorNames.get(entry.authorId) ?? null;
      }
    }
    const solutionAuthorId = solutionAuthorByRef.get(node.refId) ?? null;
    node.solutionAuthorName = solutionAuthorId
      ? (authorNames.get(solutionAuthorId) ?? null)
      : null;
  }

  const workflowKind = detectWorkflowKind(cleanedTitle, nodes);
  let stages: StageGrouping | null = null;
  if (template) {
    stages = buildStageGroups(nodes, template, {
      finalized: isFinalizedStatus(parentIncident.status_id),
      workflowKind,
    });
  }

  const progress = computeWorkflowProgress(nodes.map((node) => node.lifecycle));

  /**
   * Cierre automático oportunista: cuando el detalle se calcula (apertura del
   * caso o card del listado) y el flujo llegó al 100% sin etapas bloqueantes
   * faltantes, se registra el cierre local. Idempotente por `getClosure`.
   */
  let closure = getClosure(automationId);

  // Auto-cierres que dejaron de aplicar (el progreso retrocedió o apareció una
  // etapa bloqueante faltante) se limpian para no dejar el caso finalizado.
  if (
    closure &&
    closure.kind === "auto" &&
    (progress.percent < 100 || (stages?.missingBlockingCount ?? 0) > 0)
  ) {
    removeClosure(automationId);
    invalidateDiscoveryCache();
    closure = null;
  }

  if (
    !closure &&
    shouldAutoClose({
      statusId: parentIncident.status_id,
      percent: progress.percent,
      missingBlockingCount: stages?.missingBlockingCount ?? 0,
      hasClosure: false,
    })
  ) {
    closure = recordClosure({
      automationId,
      kind: "auto",
      reason: AUTO_CLOSE_REASON,
      percent: progress.percent,
      closedBy: "sistema",
    });
    invalidateDiscoveryCache();
  }

  const branchCode = parseAutomationBranchTitle(cleanedTitle).branchCode ?? null;
  const branchLocation = await getBranchLocation(branchCode);
  const region = parsedForm?.sucursal?.region ?? branchLocation?.region ?? null;
  const locality =
    parsedForm?.sucursal?.locality ?? branchLocation?.locality ?? null;
  const location = region || locality ? { region, locality } : null;

  return {
    ok: true,
    detail: {
      id: parentIncident.id,
      prettyId: parentIncident.pretty_id,
      title: cleanedTitle,
      displayName: buildAutomationDisplayName(
        cleanedTitle,
        branchNameFromDescription(parentIncident.description),
      ),
      statusId: parentIncident.status_id,
      processId: parentIncident.process_id ?? 0,
      createdAt: parentIncident.created_at,
      closedAt: parentIncident.closed_at,
      initialForm: formSource
        ? {
            createdAt: formSource.createdAt,
            text: formSource.text,
            parsed: parsedForm,
            authorName: formAuthorId
              ? (authorNames.get(formAuthorId) ?? null)
              : null,
          }
        : null,
      nodes,
      stages,
      workflowKind,
      progress,
      location,
      closure,
    },
  };
}
