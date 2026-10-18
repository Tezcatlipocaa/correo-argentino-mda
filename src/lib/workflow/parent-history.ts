import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { automationParents } from "@/db/schema";
import { ACTIVE_STATUS_IDS, isActiveStatus } from "./automation-status";
import { listClosures } from "./closures";
import type { AutomationClosure } from "./closures";
import type { AutomationSummary } from "./discovery";
import { normalizeForCompare } from "./labels";
import { nowSeconds } from "./time";
import { markActivityDay } from "./activity-days";

/**
 * Historial persistente de padres de automatización. Alimenta el listado
 * completo de la vista de automatizaciones (creados y finalizados), a
 * diferencia de `automation_tracked_parents` que solo mantiene activos.
 *
 * Se puebla como side-effect del scan de discovery y nunca poda filas.
 */

type AutomationParentRecord = typeof automationParents.$inferSelect;

/**
 * Inserta/actualiza los padres vistos en un scan. `firstSeenAt` solo se fija
 * al insertar; el resto de los campos se refresca en cada corrida.
 */
export function upsertAutomationParents(
  items: readonly AutomationSummary[],
): void {
  if (items.length === 0) {
    return;
  }

  const now = nowSeconds();

  // Estado previo (para detectar movimiento y marcar el día de actividad).
  const previous = new Map<number, { updatedAt: number; statusId: number }>();
  try {
    const ids = items.map((item) => item.id);
    const rows = db
      .select({
        automationId: automationParents.automationId,
        updatedAt: automationParents.updatedAt,
        statusId: automationParents.statusId,
      })
      .from(automationParents)
      .where(inArray(automationParents.automationId, ids))
      .all();
    for (const row of rows) {
      previous.set(row.automationId, {
        updatedAt: row.updatedAt,
        statusId: row.statusId,
      });
    }
  } catch {
    // Sin estado previo: se asume todo nuevo (marca el día de creación).
  }

  try {
    db.transaction((tx) => {
      for (const item of items) {
        tx.insert(automationParents)
          .values({
            automationId: item.id,
            prettyId: item.prettyId,
            displayName: item.displayName,
            branchCode: item.branchCode,
            branchName: item.branchName,
            statusId: item.statusId,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            closedAt: item.closedAt,
            estimatedEndAt: item.estimatedEndAt ?? null,
            region: item.region ?? null,
            locality: item.locality ?? null,
            progressPercent: item.progressPercent ?? null,
            assignedGroupId: item.assignedGroupId ?? null,
            assignedGroupName: item.assignedGroupName ?? null,
            firstSeenAt: now,
            lastSeenAt: now,
          })
          .onConflictDoUpdate({
            target: automationParents.automationId,
            set: {
              prettyId: item.prettyId,
              displayName: item.displayName,
              branchCode: item.branchCode,
              branchName: item.branchName,
              statusId: item.statusId,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
              closedAt: item.closedAt,
              estimatedEndAt: item.estimatedEndAt ?? null,
              region: item.region ?? null,
              locality: item.locality ?? null,
              assignedGroupId: item.assignedGroupId ?? null,
              assignedGroupName: item.assignedGroupName ?? null,
              lastSeenAt: now,
            },
          })
          .run();
      }
    });
  } catch {
    return;
  }

  // Día de actividad: creación (caso nuevo) o el día del último movimiento.
  for (const item of items) {
    const before = previous.get(item.id);
    if (before === undefined) {
      markActivityDay(item.id, item.createdAt);
    } else if (
      before.updatedAt !== item.updatedAt ||
      before.statusId !== item.statusId
    ) {
      markActivityDay(item.id, item.updatedAt);
    }
  }
}

function toSummary(
  row: AutomationParentRecord,
  closure: AutomationClosure | undefined,
): AutomationSummary {
  const base: AutomationSummary = {
    id: row.automationId,
    prettyId: row.prettyId,
    branchCode: row.branchCode,
    branchName: row.branchName,
    displayName: row.displayName,
    statusId: row.statusId,
    isActive: closure ? false : isActiveStatus(row.statusId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: closure ? closure.closedAt : row.closedAt,
    estimatedEndAt: row.estimatedEndAt,
    region: row.region,
    locality: row.locality,
    assignedGroupId: row.assignedGroupId,
    assignedGroupName: row.assignedGroupName,
    progressPercent: row.progressPercent,
  };

  return closure ? { ...base, localClosure: closure } : base;
}

export type AutomationParentStatusFilter = "all" | "active" | "finalized";

/** Orden del listado. */
export type AutomationParentOrder = "recent" | "oldest" | "updated";

/** Buckets de antigüedad (por `createdAt`) para el filtro de casos en curso. */
export type AutomationParentAge = "0-7" | "8-15" | "16-30" | "30+";

export const AUTOMATION_PARENT_AGE_BUCKETS: readonly AutomationParentAge[] = [
  "0-7",
  "8-15",
  "16-30",
  "30+",
];

export interface AutomationParentsQuery {
  page?: number;
  pageSize?: number;
  /** Término de búsqueda por NIS, prettyId, sucursal o título. */
  q?: string;
  status?: AutomationParentStatusFilter;
  /** Región exacta (columna `region`). */
  region?: string;
  /** Bucket de antigüedad por `createdAt`. */
  age?: AutomationParentAge;
  /** Rango de creación (epoch segundos), inclusivo/excluyente. */
  from?: number;
  to?: number;
  order?: AutomationParentOrder;
}

export interface AutomationParentsPage {
  items: AutomationSummary[];
  /** Total de filas que matchean la búsqueda/filtro (para paginar). */
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const AUTOMATION_PARENTS_PAGE_SIZE = 20;

/** Acentos/ñ que se aplanan en SQLite para búsquedas insensibles a tildes. */
const SEARCH_ACCENTS: readonly (readonly [string, string])[] = [
  ["á", "a"],
  ["é", "e"],
  ["í", "i"],
  ["ó", "o"],
  ["ú", "u"],
  ["ü", "u"],
  ["ñ", "n"],
  ["Á", "A"],
  ["É", "E"],
  ["Í", "I"],
  ["Ó", "O"],
  ["Ú", "U"],
  ["Ü", "U"],
  ["Ñ", "N"],
];

/**
 * Expresión de columna normalizada para búsqueda: aplana acentos/ñ y baja a
 * minúsculas en SQL (SQLite no es accent-insensitive y su `lower()` solo cubre
 * ASCII). El término se normaliza con `normalizeForCompare` para que ambos
 * lados coincidan ("guillon" → "Guillón").
 */
function normalizedSearchColumn(column: AnySQLiteColumn): SQL {
  let expr: SQL = sql`${column}`;
  for (const [from, to] of SEARCH_ACCENTS) {
    expr = sql`replace(${expr}, ${from}, ${to})`;
  }
  return sql`lower(${expr})`;
}

const DAY_SECONDS = 86_400;

/** Rango de `createdAt` (en días hacia atrás) de cada bucket de antigüedad. */
const AGE_RANGES: Readonly<
  Record<AutomationParentAge, { minDays: number; maxDays: number | null }>
> = {
  "0-7": { minDays: 0, maxDays: 7 },
  "8-15": { minDays: 7, maxDays: 15 },
  "16-30": { minDays: 15, maxDays: 30 },
  "30+": { minDays: 30, maxDays: null },
};

function buildParentsWhere(
  query: AutomationParentsQuery,
  closureIds: readonly number[],
  nowSeconds: number,
) {
  const conditions: (SQL | undefined)[] = [];
  const term = (query.q ?? "").trim();

  if (term) {
    // Substring literal vía `instr` (no `LIKE`): evita que `%`/`_` del término
    // actúen como comodines.
    const needle = normalizeForCompare(term);
    const contains = (column: AnySQLiteColumn): SQL =>
      sql`instr(${normalizedSearchColumn(column)}, ${needle}) > 0`;
    conditions.push(
      or(
        contains(automationParents.branchCode),
        contains(automationParents.prettyId),
        contains(automationParents.branchName),
        contains(automationParents.displayName),
      ),
    );
  }

  const status = query.status ?? "all";
  if (status === "active") {
    conditions.push(
      inArray(automationParents.statusId, [...ACTIVE_STATUS_IDS]),
    );
    if (closureIds.length > 0) {
      conditions.push(
        notInArray(automationParents.automationId, [...closureIds]),
      );
    }
  } else if (status === "finalized") {
    // Finalizada = estado finalizado en InvGate o cierre local en el portal.
    const finalized = [
      notInArray(automationParents.statusId, [...ACTIVE_STATUS_IDS]),
      ...(closureIds.length > 0
        ? [inArray(automationParents.automationId, [...closureIds])]
        : []),
    ];
    conditions.push(or(...finalized));
  }

  if (query.region) {
    conditions.push(eq(automationParents.region, query.region));
  }
  if (query.from !== undefined) {
    conditions.push(gte(automationParents.createdAt, query.from));
  }
  if (query.to !== undefined) {
    conditions.push(lt(automationParents.createdAt, query.to));
  }
  if (query.age && AGE_RANGES[query.age]) {
    const range = AGE_RANGES[query.age];
    if (range.minDays > 0) {
      conditions.push(
        lt(
          automationParents.createdAt,
          nowSeconds - range.minDays * DAY_SECONDS,
        ),
      );
    }
    if (range.maxDays !== null) {
      conditions.push(
        gte(
          automationParents.createdAt,
          nowSeconds - range.maxDays * DAY_SECONDS,
        ),
      );
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/** Orden SQL del listado según `AutomationParentOrder`. */
function buildOrderBy(order: AutomationParentOrder = "recent") {
  if (order === "oldest") {
    return [asc(automationParents.createdAt), asc(automationParents.automationId)];
  }
  if (order === "updated") {
    return [
      desc(automationParents.updatedAt),
      desc(automationParents.createdAt),
    ];
  }
  return [desc(automationParents.createdAt), desc(automationParents.automationId)];
}

/**
 * Página de padres para el listado "Todas las automatizaciones". La búsqueda y
 * los filtros corren en SQL para que la paginación sea correcta sobre todo el
 * historial (no solo la página visible).
 */
export function listAutomationParentsPage(
  query: AutomationParentsQuery = {},
): AutomationParentsPage {
  const pageSize =
    query.pageSize && query.pageSize > 0
      ? Math.floor(query.pageSize)
      : AUTOMATION_PARENTS_PAGE_SIZE;

  try {
    const closures = listClosures();
    const where = buildParentsWhere(query, [...closures.keys()], nowSeconds());

    const total = db
      .select({ value: count() })
      .from(automationParents)
      .where(where)
      .get()?.value ?? 0;

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(
      Math.max(1, Math.floor(query.page ?? 1) || 1),
      totalPages,
    );

    const rows = db
      .select()
      .from(automationParents)
      .where(where)
      .orderBy(...buildOrderBy(query.order))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return {
      items: rows.map((row) => toSummary(row, closures.get(row.automationId))),
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch {
    return { items: [], total: 0, page: 1, pageSize, totalPages: 1 };
  }
}

/**
 * Normaliza los query params del listado/export a un `AutomationParentsQuery`.
 * Ignora valores inválidos (fail-open a "sin filtro").
 */
export function parseAutomationParentsQuery(
  params: URLSearchParams,
): AutomationParentsQuery {
  const statusRaw = params.get("status") ?? "all";
  const status: AutomationParentStatusFilter = (
    ["all", "active", "finalized"] as const
  ).includes(statusRaw as AutomationParentStatusFilter)
    ? (statusRaw as AutomationParentStatusFilter)
    : "all";

  const ageRaw = params.get("age") ?? "";
  const age = (AUTOMATION_PARENT_AGE_BUCKETS as readonly string[]).includes(
    ageRaw,
  )
    ? (ageRaw as AutomationParentAge)
    : undefined;

  const orderRaw = params.get("order") ?? "recent";
  const order: AutomationParentOrder = (
    ["recent", "oldest", "updated"] as const
  ).includes(orderRaw as AutomationParentOrder)
    ? (orderRaw as AutomationParentOrder)
    : "recent";

  const page = Number.parseInt(params.get("page") ?? "1", 10);

  return {
    q: (params.get("q") ?? "").trim(),
    status,
    region: (params.get("region") ?? "").trim() || undefined,
    age,
    from: parseDateParam(params.get("from"), false),
    to: parseDateParam(params.get("to"), true),
    order,
    page: Number.isInteger(page) ? page : 1,
  };
}

/**
 * Convierte un param de fecha `YYYY-MM-DD` a epoch en segundos (hora local).
 * `endOfDay` desplaza al inicio del día siguiente para que un `lt` inclusive
 * cubra todo el día elegido.
 */
function parseDateParam(
  value: string | null,
  endOfDay: boolean,
): number | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setDate(date.getDate() + 1);
  return Math.floor(date.getTime() / 1000);
}

/** Todas las filas que matchean los filtros (sin paginar) para exportar. */
export function listAutomationParentsForExport(
  query: AutomationParentsQuery = {},
  limit = 5000,
): AutomationSummary[] {
  try {
    const closures = listClosures();
    const where = buildParentsWhere(query, [...closures.keys()], nowSeconds());
    const rows = db
      .select()
      .from(automationParents)
      .where(where)
      .orderBy(...buildOrderBy(query.order))
      .limit(limit)
      .all();
    return rows.map((row) => toSummary(row, closures.get(row.automationId)));
  } catch {
    return [];
  }
}

/** Epoch (`last_seen_at`) del último scan que tocó el historial. */
export function getAutomationParentsDataAsOf(): number | null {
  try {
    const row = db
      .select({ value: sql<number | null>`max(${automationParents.lastSeenAt})` })
      .from(automationParents)
      .get();
    return typeof row?.value === "number" ? row.value : null;
  } catch {
    return null;
  }
}

/** Regiones distintas presentes en el historial (para el filtro). */
export function listAutomationRegions(): string[] {
  try {
    const rows = db
      .selectDistinct({ region: automationParents.region })
      .from(automationParents)
      .where(isNotNull(automationParents.region))
      .all();
    return rows
      .map((row) => row.region)
      .filter((region): region is string => Boolean(region))
      .sort((a, b) => a.localeCompare(b, "es-AR"));
  } catch {
    return [];
  }
}

/** Padres más recientes por actualización (destacada + "Actualizadas recientemente"). */
export function listRecentAutomationParents(limit = 4): AutomationSummary[] {
  if (limit <= 0) {
    return [];
  }
  try {
    const closures = listClosures();
    const rows = db
      .select()
      .from(automationParents)
      .orderBy(
        desc(automationParents.updatedAt),
        desc(automationParents.createdAt),
      )
      .limit(limit)
      .all();
    return rows.map((row) => toSummary(row, closures.get(row.automationId)));
  } catch {
    return [];
  }
}

/**
 * Actualiza el estado mutable de un padre ya visto, sin alterar `firstSeenAt`.
 * Lo usa el progreso liviano (apertura de card) para reflejar en el listado los
 * cambios hechos directamente en InvGate.
 */
export function upsertAutomationParentStatus(
  automationId: number,
  status: { statusId: number; updatedAt: number; closedAt: number | null },
): void {
  try {
    db.update(automationParents)
      .set({
        statusId: status.statusId,
        updatedAt: status.updatedAt,
        closedAt: status.closedAt,
        lastSeenAt: nowSeconds(),
      })
      .where(eq(automationParents.automationId, automationId))
      .run();
    markActivityDay(automationId, status.updatedAt);
  } catch {
    return;
  }
}

/** Suma 1 al contador de reaperturas locales del padre. */
export function incrementAutomationReopenCount(automationId: number): void {
  try {
    db.update(automationParents)
      .set({ reopenCount: sql`${automationParents.reopenCount} + 1` })
      .where(eq(automationParents.automationId, automationId))
      .run();
  } catch {
    return;
  }
}

/**
 * Persiste el progreso calculado (detalle o path liviano) en el historial.
 * El scan de discovery NO escribe esta columna, así que el dato sobrevive a
 * re-escaneos; sólo lo tienen los casos que se abrieron/resolvieron alguna vez.
 */
export function updateAutomationParentProgress(
  automationId: number,
  progress: { percent: number; completed: number; applicableTotal: number },
): void {
  try {
    db.update(automationParents)
      .set({
        progressPercent: progress.percent,
        progressCompleted: progress.completed,
        progressTotal: progress.applicableTotal,
        lastSeenAt: nowSeconds(),
      })
      .where(eq(automationParents.automationId, automationId))
      .run();
    markActivityDay(automationId, nowSeconds());
  } catch {
    return;
  }
}
