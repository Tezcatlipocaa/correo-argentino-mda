import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { automationParents, officeInvgateLinks, offices } from "@/db/schema";
import { getServerEnv } from "@lib/invgate/automation/env";
import { getIncidents } from "@lib/invgate/automation/incidents";
import { resolveSectorNames } from "@lib/invgate/automation/helpdesk-names";
import { invgateGet } from "@lib/invgateClient";
import { readPersistedCache, writePersistedCache } from "@lib/invgate/cache";
import { getCategoryPathMap } from "./category-resolver";
import { listClosures } from "./closures";
import { normalizeLabel } from "./labels";
import { loadTitleIndex, matchCanonicalTitle } from "./title-catalog";
import { nowSeconds } from "./time";

/**
 * Monitoreo post‑automatización: detecta tickets de error de la sucursal dentro
 * de los días posteriores al cierre de su automatización.
 *
 * Fuente: una vista guardada de InvGate con los tickets de error
 * (`INVGATE_MOSAIC_VIEW_ID`) → ids → bulk → filtro local por `location_id`
 * (resuelto desde `branch_code → offices → office_invgate_links`) y ventana
 * `[closedAt, closedAt + AUTOMATION_POST_WINDOW_DAYS]`. Cada ticket se clasifica
 * por **ruta de categoría** en Mosaic (software) / Hardware / Otro. Cacheado 5
 * min para no martillar la API.
 */

const SECONDS_PER_DAY = 86_400;
const DEFAULT_WINDOW_DAYS = 3;
const DEFAULT_CANDIDATE_DAYS = 30;
const MOSAIC_TICKETS_CACHE_KEY = "automation.mosaic_tickets.v4";
const MOSAIC_TICKETS_TTL_MS = 5 * 60 * 1000;
/** Tope de ids del bulk (la vista debería estar acotada a tickets recientes). */
const MAX_MOSAIC_IDS = 1000;

export type PostErrorKind = "mosaic" | "hardware" | "otro";

/**
 * Clasifica un ticket por su **ruta de categoría** normalizada (`a » b » c`).
 * Hardware se evalúa antes que Mosaic porque "Terminal Mosaic" contiene
 * "mosaic" (las categorías de hardware cuelgan de `FieldServices » … » HW
 * TMosaic » …`). Función pura.
 */
export function classifyCategoryPath(path: string | null | undefined): PostErrorKind {
  const normalized = (path ?? "").toLowerCase();
  if (!normalized) return "otro";
  if (
    normalized.includes("hw tmosaic") ||
    normalized.includes("fieldservices")
  ) {
    return "hardware";
  }
  if (normalized.includes("mosaic")) return "mosaic";
  return "otro";
}

/** ¿Es un pedido/gestión (no un error)? Se excluye del monitoreo. */
export function isRequestTitle(title: string): boolean {
  return /^\s*pedido\b/i.test(title);
}

function mosaicViewId(): number | null {
  const parsed = Number.parseInt(getServerEnv("INVGATE_MOSAIC_VIEW_ID"), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function postAutomationWindowDays(): number {
  const parsed = Number.parseInt(
    getServerEnv("AUTOMATION_POST_WINDOW_DAYS"),
    10,
  );
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_WINDOW_DAYS;
}

/**
 * Días hacia atrás para considerar una automatización "recién finalizada" y
 * revisar su ventana post‑cierre. Default 30 (mayor que la ventana de errores,
 * porque el monitoreo sigue siendo útil después de que la ventana se cierra).
 */
export function postAutomationCandidateDays(): number {
  const parsed = Number.parseInt(
    getServerEnv("AUTOMATION_POST_CANDIDATE_DAYS"),
    10,
  );
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_CANDIDATE_DAYS;
}

/** ¿Está configurada la fuente de tickets Mosaic? */
export function postAutomationConfigured(): boolean {
  return mosaicViewId() !== null;
}

export interface MosaicTicket {
  id: number;
  prettyId: string;
  title: string;
  locationId: number | null;
  createdAt: number;
  categoryId: number | null;
  /** Helpdesk asignado en InvGate (`assigned_group_id`). */
  helpdeskId: number | null;
  /** Nombre del helpdesk asignado; null si no se pudo resolver. */
  helpdeskName: string | null;
  /** Título canónico del catálogo del portal; null si no hay match seguro. */
  canonicalTitle: string | null;
  kind: PostErrorKind;
}

interface ByViewResponse {
  requestIds?: number[];
}

/** Tickets Mosaic de la vista configurada (cacheado 5 min). `null` = sin fuente. */
export async function fetchMosaicTickets(): Promise<MosaicTicket[] | null> {
  const viewId = mosaicViewId();
  if (viewId === null) return null;

  const cached = readPersistedCache<MosaicTicket[]>(MOSAIC_TICKETS_CACHE_KEY);
  if (cached) return cached;

  const viewResult = await invgateGet<ByViewResponse>(
    `incidents.by.view?view_id=${viewId}`,
    20000,
  );
  if (!viewResult.ok) return null;

  const ids = (Array.isArray(viewResult.data?.requestIds)
    ? viewResult.data.requestIds
    : []
  ).slice(0, MAX_MOSAIC_IDS);
  if (ids.length === 0) {
    writePersistedCache(MOSAIC_TICKETS_CACHE_KEY, [], MOSAIC_TICKETS_TTL_MS);
    return [];
  }

  const details = await getIncidents(ids);
  if (!details.ok) return null;

  // Rutas de categoría (cacheadas 24 h) para clasificar cada ticket.
  let categoryPaths: Map<number, string> = new Map();
  try {
    categoryPaths = await getCategoryPathMap();
  } catch {
    categoryPaths = new Map();
  }

  const rawTickets: MosaicTicket[] = Object.values(details.data)
    .filter((incident) => typeof incident?.id === "number")
    .filter((incident) => !isRequestTitle(incident.title ?? ""))
    .map((incident) => {
      const categoryId =
        typeof incident.category_id === "number" ? incident.category_id : null;
      return {
        id: incident.id,
        prettyId: incident.pretty_id ?? `#${incident.id}`,
        title: incident.title ?? "",
        locationId:
          typeof incident.location_id === "number"
            ? incident.location_id
            : null,
        createdAt: incident.created_at ?? 0,
        categoryId,
        helpdeskId:
          typeof incident.assigned_group_id === "number"
            ? incident.assigned_group_id
            : null,
        helpdeskName: null,
        canonicalTitle: null,
        kind: classifyCategoryPath(
          categoryId !== null ? categoryPaths.get(categoryId) : null,
        ),
      };
    });

  // Nombre de la mesa asignada (helpdesk) de cada ticket (cacheado 24 h).
  let helpdeskNames = new Map<number, string>();
  try {
    helpdeskNames = await resolveSectorNames(
      rawTickets
        .map((ticket) => ticket.helpdeskId)
        .filter((id): id is number => id !== null),
    );
  } catch {
    helpdeskNames = new Map();
  }

  // Título canónico del catálogo del portal (para mostrar el título homologado).
  let titleIndex = null as Awaited<ReturnType<typeof loadTitleIndex>> | null;
  try {
    titleIndex = await loadTitleIndex();
  } catch {
    titleIndex = null;
  }

  const tickets: MosaicTicket[] = rawTickets.map((ticket) => {
    const canonical =
      titleIndex !== null
        ? matchCanonicalTitle(ticket.title, titleIndex).canonical
        : null;
    return {
      ...ticket,
      helpdeskName:
        ticket.helpdeskId !== null
          ? (helpdeskNames.get(ticket.helpdeskId) ?? null)
          : null,
      canonicalTitle: canonical !== ticket.title ? canonical : null,
    };
  });

  writePersistedCache(
    MOSAIC_TICKETS_CACHE_KEY,
    tickets,
    MOSAIC_TICKETS_TTL_MS,
  );
  return tickets;
}

/** `branch_code → invgate_location_id[]` (desde el vínculo de oficinas). */
export function loadBranchLocationMap(): Map<string, number[]> {
  const map = new Map<string, number[]>();
  try {
    const rows = db
      .select({
        code: offices.code,
        locationId: officeInvgateLinks.invgateLocationId,
      })
      .from(officeInvgateLinks)
      .innerJoin(offices, eq(offices.id, officeInvgateLinks.officeId))
      .where(isNotNull(officeInvgateLinks.invgateLocationId))
      .all();
    for (const row of rows) {
      if (!row.code || typeof row.locationId !== "number") continue;
      const list = map.get(row.code) ?? [];
      list.push(row.locationId);
      map.set(row.code, list);
    }
  } catch {
    return map;
  }
  return map;
}

export interface PostAutomationCandidate {
  automationId: number;
  displayName: string;
  branchCode: string | null;
  branchName: string | null;
  closedAt: number;
}

export interface PostAutomationError {
  id: number;
  prettyId: string;
  title: string;
  createdAt: number;
  kind: PostErrorKind;
  helpdeskName: string | null;
  /** Título canónico del catálogo; null si el original ya es correcto. */
  canonicalTitle: string | null;
}

export interface PostAutomationMatch {
  automationId: number;
  displayName: string;
  closedAt: number;
  windowEnd: number;
  errors: PostAutomationError[];
  /** Conteo por tipo (mosaic/hardware/otro). */
  byKind: Record<PostErrorKind, number>;
}

/** Totales por tipo de un conjunto de matches. */
export function summarizeByKind(
  matches: readonly PostAutomationMatch[],
): Record<PostErrorKind, number> {
  const totals: Record<PostErrorKind, number> = {
    mosaic: 0,
    hardware: 0,
    otro: 0,
  };
  for (const match of matches) {
    totals.mosaic += match.byKind.mosaic;
    totals.hardware += match.byKind.hardware;
    totals.otro += match.byKind.otro;
  }
  return totals;
}

function countByKind(
  errors: readonly PostAutomationError[],
): Record<PostErrorKind, number> {
  const counts: Record<PostErrorKind, number> = {
    mosaic: 0,
    hardware: 0,
    otro: 0,
  };
  for (const error of errors) counts[error.kind] += 1;
  return counts;
}

/** Fallback cuando el ticket no trae `location_id`: matchea por nombre/código. */
export function titleMentionsBranch(
  title: string,
  branchName: string | null,
  branchCode: string | null,
): boolean {
  const normalized = normalizeLabel(title);
  if (!normalized) return false;
  if (branchCode) {
    const code = normalizeLabel(branchCode);
    if (code && normalized.includes(code)) return true;
  }
  if (branchName) {
    const name = normalizeLabel(branchName);
    if (name && name.length >= 4 && normalized.includes(name)) return true;
  }
  return false;
}

/**
 * Tickets de error de una sucursal dentro de la ventana posterior al cierre.
 * Función pura (testeable sin red ni DB).
 */
export function selectMosaicErrors(
  tickets: readonly MosaicTicket[],
  candidate: { closedAt: number; branchName: string | null; branchCode: string | null },
  locationIds: ReadonlySet<number>,
  windowDays: number,
): PostAutomationError[] {
  const windowEnd = candidate.closedAt + windowDays * SECONDS_PER_DAY;
  return tickets
    .filter((ticket) => {
      if (ticket.createdAt < candidate.closedAt) return false;
      if (ticket.createdAt > windowEnd) return false;
      if (ticket.locationId !== null) return locationIds.has(ticket.locationId);
      return titleMentionsBranch(
        ticket.title,
        candidate.branchName,
        candidate.branchCode,
      );
    })
    .map((ticket) => ({
      id: ticket.id,
      prettyId: ticket.prettyId,
      title: ticket.title,
      createdAt: ticket.createdAt,
      kind: ticket.kind,
      helpdeskName: ticket.helpdeskName,
      canonicalTitle: ticket.canonicalTitle,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Errores post‑automatización por caso: para cada automatización finalizada,
 * los tickets Mosaic de su sucursal creados dentro de la ventana posterior al
 * cierre. Solo devuelve las automatizaciones con al menos un error.
 */
export async function findPostAutomationErrors(
  candidates: readonly PostAutomationCandidate[],
  windowDays = postAutomationWindowDays(),
): Promise<PostAutomationMatch[]> {
  if (candidates.length === 0) return [];
  const tickets = await fetchMosaicTickets();
  if (!tickets || tickets.length === 0) return [];

  const locations = loadBranchLocationMap();
  const matches: PostAutomationMatch[] = [];

  for (const candidate of candidates) {
    const locationIds = new Set(
      candidate.branchCode ? (locations.get(candidate.branchCode) ?? []) : [],
    );
    const errors = selectMosaicErrors(
      tickets,
      candidate,
      locationIds,
      windowDays,
    );

    if (errors.length > 0) {
      matches.push({
        automationId: candidate.automationId,
        displayName: candidate.displayName,
        closedAt: candidate.closedAt,
        windowEnd: candidate.closedAt + windowDays * SECONDS_PER_DAY,
        errors,
        byKind: countByKind(errors),
      });
    }
  }

  return matches.sort((a, b) => b.closedAt - a.closedAt);
}

/**
 * Automatizaciones finalizadas dentro de la ventana de monitoreo (resolución
 * en InvGate o cierre local), ordenadas por fecha de cierre descendente.
 */
export function listRecentlyFinalizedAutomations(
  windowDays = postAutomationWindowDays(),
): PostAutomationCandidate[] {
  const now = nowSeconds();
  const from = now - windowDays * SECONDS_PER_DAY;

  try {
    const closures = listClosures();
    const rows = db
      .select({
        automationId: automationParents.automationId,
        displayName: automationParents.displayName,
        branchCode: automationParents.branchCode,
        branchName: automationParents.branchName,
        closedAt: automationParents.closedAt,
      })
      .from(automationParents)
      .all();

    const result: PostAutomationCandidate[] = [];
    for (const row of rows) {
      const closedAt =
        closures.get(row.automationId)?.closedAt ?? row.closedAt ?? null;
      if (closedAt === null || closedAt < from || closedAt > now) continue;
      result.push({
        automationId: row.automationId,
        displayName: row.displayName,
        branchCode: row.branchCode,
        branchName: row.branchName,
        closedAt,
      });
    }
    return result.sort((a, b) => b.closedAt - a.closedAt);
  } catch {
    return [];
  }
}
