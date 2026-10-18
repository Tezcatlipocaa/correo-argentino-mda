import { db } from "@/db";
import { automationParents } from "@/db/schema";
import { getServerEnv } from "@lib/invgate/automation/env";
import { isActiveStatus } from "./automation-status";
import { listClosures } from "./closures";
import type { AutomationClosure } from "./closures";
import { countActiveDaysByAutomation } from "./activity-days";
import type { AutomationParentAge } from "./parent-history";

/**
 * Métricas del workflow de automatizaciones calculadas sobre los datos locales
 * (`automation_parents` + `automation_closures`). No consulta InvGate: es una
 * lectura barata que corre en SSR.
 *
 * La tabla `automation_parents` se puebla como side-effect del discovery scan
 * (nunca poda), así que el histórico arranca en la implantación del módulo y el
 * `statusId` puede tener hasta el TTL del scan de desfase.
 */

export interface MetricsParentRow {
  automationId: number;
  displayName: string;
  branchCode: string | null;
  branchName: string | null;
  statusId: number;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
  estimatedEndAt?: number | null;
  region?: string | null;
  assignedGroupName?: string | null;
  progressPercent?: number | null;
  reopenCount?: number;
  lastSeenAt?: number | null;
}

export interface MonthlyThroughput {
  /** Clave `YYYY-MM`. */
  month: string;
  created: number;
  finalized: number;
}

export interface MonthlyLeadTime {
  /** Clave `YYYY-MM`. */
  month: string;
  /** Casos resueltos en el mes con tiempo de ciclo válido. */
  sample: number;
  medianDays: number | null;
  p90Days: number | null;
}

export interface ExecutiveSummary {
  total: number;
  finalized: number;
  active: number;
  medianLeadDays: number | null;
  onTimeRate: number | null;
}

export interface PaceMetrics {
  /** Finalizaciones por semana (según la ventana o el histórico). */
  finalizedPerWeek: number | null;
  /** Semanas estimadas para vaciar el WIP al ritmo actual. */
  etaWeeks: number | null;
}

export interface TimeMetrics {
  /** Casos con días activos registrados. */
  sampleActive: number;
  medianActiveDays: number | null;
  /** Mediana de días de calendario sin actividad (calendario − activos). */
  medianIdleDays: number | null;
  /** Distribución del WIP por días sin actividad. */
  idleBuckets: { label: string; count: number }[];
}

export interface BacklogBucket {
  label: string;
  /** Código del filtro de antigüedad del listado (`AutomationParentAge`). */
  age: AutomationParentAge;
  count: number;
}

export interface BranchStat {
  key: string;
  label: string;
  count: number;
  /** Casos activos más antiguos del grupo (días); null si no hay activos. */
  oldestActiveDays: number | null;
}

export interface GroupStat {
  key: string;
  label: string;
  total: number;
  active: number;
  finalized: number;
  medianLeadDays: number | null;
}

export interface MetricsWindow {
  /** Días de la ventana; null = histórico completo. */
  days: number | null;
}

export interface MetricsDelta {
  createdPct: number | null;
  finalizedPct: number | null;
  medianLeadDaysPct: number | null;
  /** Diferencia en puntos porcentuales del on-time rate. */
  onTimeRatePoints: number | null;
}

export interface AutomationMetrics {
  window: MetricsWindow;
  /** KPIs de la cohorte de la ventana (por `createdAt`). */
  totals: {
    total: number;
    active: number;
    finalized: number;
  };
  leadTime: {
    sample: number;
    medianDays: number | null;
    averageDays: number | null;
    p90Days: number | null;
  };
  delta: MetricsDelta;
  sla: {
    sample: number;
    onTime: number;
    onTimeRate: number | null;
    avgDeviationDays: number | null;
  };
  progress: {
    withData: number;
    average: number | null;
    stalled: number;
    stalledThresholdDays: number;
    critical: number;
    ageThresholdDays: number;
  };
  /** Números headline para el resumen ejecutivo. */
  executive: ExecutiveSummary;
  /** Ritmo de cierre y proyección del backlog. */
  pace: PaceMetrics;
  /** Tiempo trabajado (días activos) y días sin actividad. */
  time: TimeMetrics;
  dataQuality: {
    total: number;
    missingBranchCode: number;
    missingEstimatedEnd: number;
    missingRegion: number;
  };
  byRegion: GroupStat[];
  throughput: MonthlyThroughput[];
  /** Mediana/p90 de tiempo de ciclo por mes (casos resueltos en el mes). */
  leadTimeByMonth: MonthlyLeadTime[];
  backlog: BacklogBucket[];
  oldestActive: {
    automationId: number;
    displayName: string;
    days: number;
  } | null;
  topBranchesByActive: BranchStat[];
  /** Epoch del último scan que tocó el historial (`last_seen_at`). */
  dataAsOf: number | null;
}

export interface AutomationMetricsOptions {
  /** Días de la ventana (createdAt). null/undefined = histórico completo. */
  windowDays?: number | null;
  /**
   * Días activos por automatización (`automation_activity_days`). Si no se pasa,
   * las métricas de tiempo salen vacías (la página las lee de la DB).
   */
  activeDaysByAutomation?: ReadonlyMap<number, number>;
}

const SECONDS_PER_DAY = 86_400;
const MAX_MONTHS = 12;
const TOP_N = 8;

const DEFAULT_STALLED_THRESHOLD_DAYS = 15;
const DEFAULT_AGE_THRESHOLD_DAYS = 30;

/** Umbral de días sin movimiento para marcar un caso en curso como estancado. */
function getStalledThresholdDays(): number {
  const raw = Number.parseInt(
    getServerEnv("AUTOMATION_STALLED_THRESHOLD_DAYS"),
    10,
  );
  return Number.isInteger(raw) && raw > 0
    ? raw
    : DEFAULT_STALLED_THRESHOLD_DAYS;
}

/** Umbral de antigüedad para marcar un caso en curso como crítico. */
function getAgeThresholdDays(): number {
  const raw = Number.parseInt(getServerEnv("AUTOMATION_AGE_THRESHOLD_DAYS"), 10);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_AGE_THRESHOLD_DAYS;
}

interface ClassifiedRow {
  row: MetricsParentRow;
  active: boolean;
  closure: AutomationClosure | undefined;
  /** Epoch de resolución (closure local o cierre en InvGate). */
  closedAt: number | null;
}

function resolveClosedAt(
  row: MetricsParentRow,
  closure: AutomationClosure | undefined,
): number | null {
  return closure?.closedAt ?? row.closedAt ?? null;
}

function classify(
  rows: readonly MetricsParentRow[],
  closures: ReadonlyMap<number, AutomationClosure>,
): ClassifiedRow[] {
  return rows.map((row) => {
    const closure = closures.get(row.automationId);
    return {
      row,
      active: isActiveStatus(row.statusId) && !closure,
      closure,
      closedAt: resolveClosedAt(row, closure),
    };
  });
}

function daysBetweenSeconds(start: number, end: number): number {
  return (end - start) / SECONDS_PER_DAY;
}

function monthKey(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Lista de meses `YYYY-MM` entre dos claves, inclusive. */
function iterateMonths(start: string, end: string): string[] {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  const months: string[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/**
 * Rango de meses a graficar: desde el primer mes con datos (creación o cierre)
 * hasta el mes actual, con tope de `maxMonths`. Evita los "meses fantasma"
 * previos a la implantación.
 */
function buildMonthRange(
  rows: readonly MetricsParentRow[],
  closures: ReadonlyMap<number, AutomationClosure>,
  nowSeconds: number,
  maxMonths: number,
): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    seen.add(monthKey(row.createdAt));
    const closedAt = resolveClosedAt(row, closures.get(row.automationId));
    if (closedAt !== null) seen.add(monthKey(closedAt));
  }
  if (seen.size === 0) return [monthKey(nowSeconds)];

  const sorted = [...seen].sort();
  const range = iterateMonths(sorted[0], monthKey(nowSeconds));
  return range.length > maxMonths ? range.slice(range.length - maxMonths) : range;
}

/** Días de calendario desde el caso más viejo hasta ahora (para el ritmo). */
function historicalSpanDays(
  rows: readonly MetricsParentRow[],
  nowSeconds: number,
): number | null {
  if (rows.length === 0) return null;
  const earliest = Math.min(...rows.map((row) => row.createdAt));
  return Math.max(1, daysBetweenSeconds(earliest, nowSeconds));
}

function median(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, index)];
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

function inWindow(
  timestamp: number | null,
  from: number | null,
  to: number,
): boolean {
  if (timestamp === null) return false;
  if (from === null) return true;
  return timestamp >= from && timestamp < to;
}

function leadDaysOf(item: ClassifiedRow): number | null {
  if (item.closedAt === null || item.closedAt < item.row.createdAt) return null;
  return daysBetweenSeconds(item.row.createdAt, item.closedAt);
}

/** Margen para considerar un cierre "en fecha" (cubre todo el día estimado). */
const ON_TIME_SLACK_SECONDS = 86_399;

function hasEstimate(item: ClassifiedRow): boolean {
  return typeof item.row.estimatedEndAt === "number" && item.closedAt !== null;
}

function isOnTime(item: ClassifiedRow): boolean {
  return (
    hasEstimate(item) &&
    (item.closedAt as number) <=
      (item.row.estimatedEndAt as number) + ON_TIME_SLACK_SECONDS
  );
}

/** Días de ciclo de los casos con fecha válida, ordenados ascendente. */
function collectLeadDays(items: readonly ClassifiedRow[]): number[] {
  return items
    .map(leadDaysOf)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
}

/** SLA: muestra, on-time y desvío promedio contra la fecha estimada. */
function buildSla(items: readonly ClassifiedRow[]): {
  sample: number;
  onTime: number;
  rate: number | null;
  avgDeviationDays: number | null;
} {
  const sample = items.filter(hasEstimate);
  const onTime = sample.filter(isOnTime).length;
  const deviations = sample.map((item) =>
    daysBetweenSeconds(
      item.row.estimatedEndAt as number,
      item.closedAt as number,
    ),
  );
  return {
    sample: sample.length,
    onTime,
    rate: sample.length === 0 ? null : round1((onTime / sample.length) * 100),
    avgDeviationDays: round1(
      deviations.length === 0
        ? null
        : deviations.reduce((sum, value) => sum + value, 0) /
            deviations.length,
    ),
  };
}

function percentileChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function branchKey(row: MetricsParentRow): string {
  return row.branchCode ?? row.branchName ?? "sin-sucursal";
}

function branchLabel(row: MetricsParentRow): string {
  if (row.branchCode && row.branchName) {
    return `${row.branchCode} · ${row.branchName}`;
  }
  return row.branchCode ?? row.branchName ?? "Sin sucursal";
}

function buildBranchStats(
  classified: readonly ClassifiedRow[],
  opts: { onlyActive: boolean; nowSeconds: number },
): BranchStat[] {
  const groups = new Map<string, BranchStat>();
  for (const item of classified) {
    if (opts.onlyActive && !item.active) continue;
    const key = branchKey(item.row);
    let stat = groups.get(key);
    if (!stat) {
      stat = {
        key,
        label: branchLabel(item.row),
        count: 0,
        oldestActiveDays: null,
      };
      groups.set(key, stat);
    }
    stat.count += 1;
    if (item.active) {
      const age = daysBetweenSeconds(item.row.createdAt, opts.nowSeconds);
      stat.oldestActiveDays =
        stat.oldestActiveDays === null
          ? age
          : Math.max(stat.oldestActiveDays, age);
    }
  }

  return [...groups.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        (b.oldestActiveDays ?? -1) - (a.oldestActiveDays ?? -1),
    )
    .slice(0, TOP_N)
    .map((stat) => ({
      ...stat,
      oldestActiveDays: round1(stat.oldestActiveDays),
    }));
}

function buildGroupStats(
  classified: readonly ClassifiedRow[],
  keyOf: (row: MetricsParentRow) => { key: string; label: string } | null,
): GroupStat[] {
  const groups = new Map<string, GroupStat & { leadDays: number[] }>();
  for (const item of classified) {
    const key = keyOf(item.row);
    if (!key) continue;
    let stat = groups.get(key.key);
    if (!stat) {
      stat = {
        key: key.key,
        label: key.label,
        total: 0,
        active: 0,
        finalized: 0,
        medianLeadDays: null,
        leadDays: [],
      };
      groups.set(key.key, stat);
    }
    stat.total += 1;
    if (item.active) {
      stat.active += 1;
    } else {
      stat.finalized += 1;
      const lead = leadDaysOf(item);
      if (lead !== null) stat.leadDays.push(lead);
    }
  }

  return [...groups.values()]
    .map(({ leadDays, ...stat }) => ({
      ...stat,
      medianLeadDays: round1(median([...leadDays].sort((a, b) => a - b))),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N);
}

interface PeriodMetrics {
  created: number;
  finalized: number;
  medianLeadDays: number | null;
  onTimeRate: number | null;
}

/** KPIs mínimos de un período, para el delta contra el período anterior. */
function computePeriod(
  rows: readonly MetricsParentRow[],
  closures: ReadonlyMap<number, AutomationClosure>,
  from: number | null,
  to: number,
): PeriodMetrics {
  // Misma semántica que la ventana actual: cohorte por `createdAt`, y los KPIs
  // (finalizadas, lead time, SLA) sobre esa cohorte. Así el delta compara
  // poblaciones equivalentes.
  const cohort = rows.filter((row) => inWindow(row.createdAt, from, to));
  const classified = classify(cohort, closures);
  const finalized = classified.filter((item) => !item.active);
  const leadDays = collectLeadDays(finalized);
  const sla = buildSla(finalized);

  return {
    created: cohort.length,
    finalized: finalized.length,
    medianLeadDays: median(leadDays),
    onTimeRate: sla.rate,
  };
}

/**
 * Función pura de agregación (testeable sin DB). Recibe las filas del historial,
 * los cierres locales, el "ahora" en segundos y una ventana opcional.
 */
export function computeAutomationMetrics(
  rows: readonly MetricsParentRow[],
  closures: ReadonlyMap<number, AutomationClosure>,
  nowSeconds: number,
  options: AutomationMetricsOptions = {},
): AutomationMetrics {
  const windowDays =
    typeof options.windowDays === "number" && options.windowDays > 0
      ? Math.floor(options.windowDays)
      : null;
  const from = windowDays === null ? null : nowSeconds - windowDays * SECONDS_PER_DAY;
  const to = nowSeconds + 1;

  const cohort = rows.filter((row) => inWindow(row.createdAt, from, to));
  const classified = classify(cohort, closures);

  const active = classified.filter((item) => item.active);
  const finalized = classified.filter((item) => !item.active);

  const leadDays = collectLeadDays(finalized);
  const sla = buildSla(finalized);

  const monthRange = buildMonthRange(rows, closures, nowSeconds, MAX_MONTHS);
  const throughput: MonthlyThroughput[] = monthRange.map((key) => ({
    month: key,
    created: rows.filter((row) => monthKey(row.createdAt) === key).length,
    finalized: rows.filter((row) => {
      const closedAt = resolveClosedAt(row, closures.get(row.automationId));
      return closedAt !== null && monthKey(closedAt) === key;
    }).length,
  }));

  const leadTimeByMonth: MonthlyLeadTime[] = monthRange.map((key) => {
    const closedInMonth = classified.filter(
      (item) => item.closedAt !== null && monthKey(item.closedAt) === key,
    );
    const days = collectLeadDays(closedInMonth);
    return {
      month: key,
      sample: days.length,
      medianDays: round1(median(days)),
      p90Days: round1(percentile(days, 90)),
    };
  });

  // Tiempo trabajado (días activos) y días sin actividad.
  const activeDaysByAutomation = options.activeDaysByAutomation ?? new Map();
  const activitySamples: number[] = [];
  const idleSamples: number[] = [];
  for (const item of classified) {
    const activeDays = activeDaysByAutomation.get(item.row.automationId);
    if (typeof activeDays !== "number") continue;
    activitySamples.push(activeDays);
    const end = item.closedAt ?? nowSeconds;
    const calendarDays = Math.max(
      0,
      daysBetweenSeconds(item.row.createdAt, end),
    );
    idleSamples.push(Math.max(0, calendarDays - activeDays));
  }
  const idleDefs = [
    { label: "0 días", max: 0 },
    { label: "1 a 3 días", max: 3 },
    { label: "4 a 7 días", max: 7 },
    { label: "Más de 7 días", max: Infinity },
  ];
  const idleBuckets = idleDefs.map((bucket) => ({
    label: bucket.label,
    count: 0,
  }));
  for (const idle of idleSamples) {
    const index = idleDefs.findIndex((bucket) => idle <= bucket.max);
    idleBuckets[index === -1 ? idleBuckets.length - 1 : index].count += 1;
  }

  // Ritmo de cierre y ETA del backlog.
  const paceWindowDays = windowDays ?? historicalSpanDays(rows, nowSeconds);
  const finalizedPerWeek =
    paceWindowDays && paceWindowDays > 0
      ? round1((finalized.length / paceWindowDays) * 7)
      : null;
  const etaWeeks =
    finalizedPerWeek && finalizedPerWeek > 0
      ? round1(active.length / finalizedPerWeek)
      : null;

  const bucketDefs: {
    label: string;
    age: AutomationParentAge;
    max: number;
  }[] = [
    { label: "0 a 7 días", age: "0-7", max: 7 },
    { label: "8 a 15 días", age: "8-15", max: 15 },
    { label: "16 a 30 días", age: "16-30", max: 30 },
    { label: "Más de 30 días", age: "30+", max: Infinity },
  ];
  const backlog: BacklogBucket[] = bucketDefs.map((bucket) => ({
    label: bucket.label,
    age: bucket.age,
    count: 0,
  }));
  for (const item of active) {
    const age = daysBetweenSeconds(item.row.createdAt, nowSeconds);
    const index = bucketDefs.findIndex((bucket) => age <= bucket.max);
    backlog[index === -1 ? backlog.length - 1 : index].count += 1;
  }

  const oldestActiveItem = active.reduce<ClassifiedRow | null>(
    (oldest, item) =>
      oldest === null || item.row.createdAt < oldest.row.createdAt
        ? item
        : oldest,
    null,
  );

  const stalledThresholdDays = getStalledThresholdDays();
  const ageThresholdDays = getAgeThresholdDays();
  const withProgress = active.filter(
    (item) => typeof item.row.progressPercent === "number",
  );
  const progressAverage =
    withProgress.length === 0
      ? null
      : withProgress.reduce(
          (sum, item) => sum + (item.row.progressPercent as number),
          0,
        ) / withProgress.length;
  const stalled = active.filter((item) => {
    const percent = item.row.progressPercent;
    if (typeof percent !== "number" || percent >= 100) return false;
    return (
      daysBetweenSeconds(item.row.updatedAt, nowSeconds) > stalledThresholdDays
    );
  }).length;
  const critical = active.filter(
    (item) =>
      daysBetweenSeconds(item.row.createdAt, nowSeconds) > ageThresholdDays,
  ).length;

  const missingBranchCode = cohort.filter((row) => !row.branchCode).length;
  const missingEstimatedEnd = cohort.filter(
    (row) => typeof row.estimatedEndAt !== "number",
  ).length;
  const missingRegion = cohort.filter((row) => !row.region).length;

  const seenTimes = rows
    .map((row) => row.lastSeenAt)
    .filter((value): value is number => typeof value === "number");
  const dataAsOf = seenTimes.length > 0 ? Math.max(...seenTimes) : null;

  const byRegion = buildGroupStats(classified, (row) =>
    row.region ? { key: row.region, label: row.region } : null,
  );

  const current = {
    created: cohort.length,
    finalized: finalized.length,
    medianLeadDays: median(leadDays),
    onTimeRate: sla.rate,
  };
  let previous: PeriodMetrics | null = null;
  if (windowDays !== null && from !== null) {
    previous = computePeriod(rows, closures, from - windowDays * SECONDS_PER_DAY, from);
  }

  return {
    window: { days: windowDays },
    totals: {
      total: cohort.length,
      active: active.length,
      finalized: finalized.length,
    },
    leadTime: {
      sample: leadDays.length,
      medianDays: round1(median(leadDays)),
      averageDays: round1(
        leadDays.length === 0
          ? null
          : leadDays.reduce((sum, value) => sum + value, 0) / leadDays.length,
      ),
      p90Days: round1(percentile(leadDays, 90)),
    },
    delta: {
      createdPct: previous ? percentileChange(current.created, previous.created) : null,
      finalizedPct: previous
        ? percentileChange(current.finalized, previous.finalized)
        : null,
      medianLeadDaysPct: previous
        ? percentileChange(current.medianLeadDays, previous.medianLeadDays)
        : null,
      onTimeRatePoints:
        previous && current.onTimeRate !== null && previous.onTimeRate !== null
          ? Math.round((current.onTimeRate - previous.onTimeRate) * 10) / 10
          : null,
    },
    sla: {
      sample: sla.sample,
      onTime: sla.onTime,
      onTimeRate: sla.rate,
      avgDeviationDays: sla.avgDeviationDays,
    },
    progress: {
      withData: withProgress.length,
      average: round1(progressAverage),
      stalled,
      stalledThresholdDays,
      critical,
      ageThresholdDays,
    },
    executive: {
      total: cohort.length,
      finalized: finalized.length,
      active: active.length,
      medianLeadDays: round1(median(leadDays)),
      onTimeRate: sla.rate,
    },
    pace: { finalizedPerWeek, etaWeeks },
    time: {
      sampleActive: activitySamples.length,
      medianActiveDays: round1(
        median([...activitySamples].sort((a, b) => a - b)),
      ),
      medianIdleDays: round1(median([...idleSamples].sort((a, b) => a - b))),
      idleBuckets,
    },
    dataQuality: {
      total: cohort.length,
      missingBranchCode,
      missingEstimatedEnd,
      missingRegion,
    },
    byRegion,
    throughput,
    leadTimeByMonth,
    backlog,
    oldestActive:
      oldestActiveItem === null
        ? null
        : {
            automationId: oldestActiveItem.row.automationId,
            displayName: oldestActiveItem.row.displayName,
            days: round1(
              daysBetweenSeconds(oldestActiveItem.row.createdAt, nowSeconds),
            ) as number,
          },
    topBranchesByActive: buildBranchStats(classified, {
      onlyActive: true,
      nowSeconds,
    }),
    dataAsOf,
  };
}

export interface MonthlySnapshot {
  month: string;
  created: number;
  finalized: number;
  finalizedByPortal: number;
  activeAtMonthEnd: number;
  medianLeadDays: number | null;
  p90LeadDays: number | null;
  onTimeRate: number | null;
}

/**
 * KPIs de un mes calendario (`YYYY-MM`, hora local) para el snapshot histórico.
 * `activeAtMonthEnd` = casos creados antes del cierre del mes y todavía sin
 * resolución a esa fecha.
 */
export function computeMonthlySnapshot(
  rows: readonly MetricsParentRow[],
  closures: ReadonlyMap<number, AutomationClosure>,
  month: string,
): MonthlySnapshot {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = Math.floor(
    new Date(year, monthNumber - 1, 1).getTime() / 1000,
  );
  const monthEnd = Math.floor(new Date(year, monthNumber, 1).getTime() / 1000);

  const classified = classify(rows, closures);
  const created = rows.filter(
    (row) => row.createdAt >= monthStart && row.createdAt < monthEnd,
  ).length;

  const finalizedInMonth = classified.filter(
    (item) =>
      item.closedAt !== null &&
      item.closedAt >= monthStart &&
      item.closedAt < monthEnd,
  );
  const byPortal = finalizedInMonth.filter((item) =>
    closures.has(item.row.automationId),
  ).length;

  const leadDays = collectLeadDays(finalizedInMonth);
  const sla = buildSla(finalizedInMonth);

  const activeAtMonthEnd = classified.filter(
    (item) =>
      item.row.createdAt < monthEnd &&
      (item.closedAt === null || item.closedAt >= monthEnd),
  ).length;

  return {
    month,
    created,
    finalized: finalizedInMonth.length,
    finalizedByPortal: byPortal,
    activeAtMonthEnd,
    medianLeadDays: round1(median(leadDays)),
    p90LeadDays: round1(percentile(leadDays, 90)),
    onTimeRate: sla.rate,
  };
}

/** Lee el historial local y calcula las métricas. */
export function getAutomationMetrics(
  options: AutomationMetricsOptions = {},
): AutomationMetrics {
  const nowSeconds = Math.floor(Date.now() / 1000);

  let rows: MetricsParentRow[] = [];
  try {
    rows = db
      .select({
        automationId: automationParents.automationId,
        displayName: automationParents.displayName,
        branchCode: automationParents.branchCode,
        branchName: automationParents.branchName,
        statusId: automationParents.statusId,
        createdAt: automationParents.createdAt,
        updatedAt: automationParents.updatedAt,
        closedAt: automationParents.closedAt,
        estimatedEndAt: automationParents.estimatedEndAt,
        region: automationParents.region,
        assignedGroupName: automationParents.assignedGroupName,
        progressPercent: automationParents.progressPercent,
        reopenCount: automationParents.reopenCount,
        lastSeenAt: automationParents.lastSeenAt,
      })
      .from(automationParents)
      .all();
  } catch {
    rows = [];
  }

  return computeAutomationMetrics(rows, listClosures(), nowSeconds, {
    ...options,
    activeDaysByAutomation:
      options.activeDaysByAutomation ?? countActiveDaysByAutomation(),
  });
}

export interface MetricDefinition {
  key: string;
  label: string;
  description: string;
  formula?: string;
}

/**
 * Definiciones de las métricas (fuente única para tooltips y glosario).
 */
export const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    key: "total",
    label: "Total histórico",
    description:
      "Casos que el portal vio alguna vez. Mide cobertura del portal, no el universo real de InvGate: arranca en la implantación del módulo.",
  },
  {
    key: "active",
    label: "En curso (WIP)",
    description:
      "Casos con estado activo en InvGate (1-4) y sin cierre local en el portal. Es el trabajo abierto ahora.",
  },
  {
    key: "finalized",
    label: "Finalizadas",
    description:
      "Casos con estado finalizado en InvGate (5-8) o con cierre local en el portal.",
  },
  {
    key: "leadTime",
    label: "Tiempo de ciclo",
    description:
      "Días de calendario entre la creación y la resolución (cierre local o en InvGate). Incluye esperas; no es tiempo efectivo de trabajo.",
    formula: "mediana/p90 de (fecha de cierre − fecha de creación)",
  },
  {
    key: "sla",
    label: "Cumplimiento de fecha estimada",
    description:
      "Porcentaje de casos resueltos dentro de la fecha estimada del título. Sólo aplica a los títulos con fecha (workflow AUTSUC).",
    formula: "on-time = cierre ≤ fecha estimada + fin del día",
  },
  {
    key: "oldestActive",
    label: "Activo más antiguo",
    description:
      "El caso en curso con mayor antigüedad. Es la peor antigüedad del backlog.",
  },
  {
    key: "throughput",
    label: "Casos por mes",
    description:
      "Casos creados y finalizados por mes, desde el inicio del historial (máx. 12 meses). Sirve para ver tendencia y si el alta supera al cierre.",
  },
  {
    key: "backlog",
    label: "Backlog por antigüedad",
    description:
      "Distribución del trabajo en curso según hace cuánto se inició (0-7 / 8-15 / 16-30 / +30 días).",
  },
  {
    key: "progress",
    label: "Progreso del WIP",
    description:
      "Avance promedio de los casos en curso con progreso conocido. Se persiste sólo para casos abiertos alguna vez.",
  },
  {
    key: "stalled",
    label: "Casos estancados",
    description:
      "Casos en curso sin actualización de InvGate en más del umbral configurado (AUTOMATION_STALLED_THRESHOLD_DAYS).",
  },
  {
    key: "critical",
    label: "Casos críticos",
    description:
      "Casos en curso con antigüedad mayor al umbral configurado (AUTOMATION_AGE_THRESHOLD_DAYS).",
  },
  {
    key: "region",
    label: "Por región",
    description:
      "Volumen, casos en curso y tiempo de ciclo agrupados por región de la sucursal.",
  },
  {
    key: "leadTimeByMonth",
    label: "Tiempo de ciclo por mes",
    description:
      "Mediana y p90 del tiempo de ciclo de los casos resueltos en cada mes. Muestra la tendencia de mejora.",
    formula: "mediana/p90 de (cierre − creación) por mes de cierre",
  },
  {
    key: "time",
    label: "Tiempo trabajado",
    description:
      "Días con actividad (movimiento en InvGate) por caso y días de calendario sin actividad. Se alimenta del log de actividad del portal.",
    formula: "días activos = días con movimiento; sin actividad = calendario − activos",
  },
  {
    key: "pace",
    label: "Ritmo y proyección",
    description:
      "Finalizaciones por semana en la ventana y semanas estimadas para vaciar el WIP al ritmo actual.",
    formula: "ETA = WIP ÷ (finalizadas por semana)",
  },
  {
    key: "dataQuality",
    label: "Calidad del dato",
    description:
      "Casos sin código de sucursal, sin fecha estimada o sin región resuelta. Afecta la cobertura de las demás métricas.",
  },
];
