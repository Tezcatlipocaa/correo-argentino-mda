import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/db/index";
import {
  users,
  sessions,
  mesas,
  agents,
  offices,
  officeInvgateLinks,
  provinces,
  regions,
  terminals,
  schedules,
  saturdayRotationConfig,
  agentSaturdayGroups,
  weekendOvertimeConfig,
  weekendOvertimeShifts,
  qualityAudits,
  auditParameters,
  auditScores,
  monthlySummaries,
  employees,
  employeeOffices,
  auditLogs,
} from "../src/db/schema";
import {
  eq,
  and,
  or,
  desc,
  lt,
  like,
  inArray,
  sql,
  getTableColumns,
} from "drizzle-orm";
import * as officeQueriesMod from "../src/lib/officeQueries";
const { getOffices } = officeQueriesMod;
import { isSucursalAutomatizada } from "../src/lib/officeHelpers";
import {
  getTerminalDisplay,
  getTerminalStatusCounts,
  getTTStatusCounts,
  getMediterraneaStatusCounts,
  getTerminalModelsByBrand,
} from "../src/lib/terminalQueries";
import { getAttendanceData } from "../src/lib/attendance";
import { getUnassignedFeedbackCount } from "../src/lib/getUnassignedFeedbackCount";
import { activeAgentCondition } from "../src/lib/activeUsers";

export interface BenchmarkStat {
  name: string;
  category: string;
  iterations: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
}

function computeStats(
  name: string,
  category: string,
  samples: number[],
): BenchmarkStat {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avgMs = Number((sum / sorted.length).toFixed(3));
  const p50Ms = Number(sorted[Math.floor(sorted.length * 0.5)].toFixed(3));
  const p95Ms = Number(
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))].toFixed(3),
  );
  const minMs = Number(sorted[0].toFixed(3));
  const maxMs = Number(sorted[sorted.length - 1].toFixed(3));
  return {
    name,
    category,
    iterations: sorted.length,
    avgMs,
    p50Ms,
    p95Ms,
    minMs,
    maxMs,
  };
}

async function measure(
  name: string,
  category: string,
  fn: () => Promise<unknown> | unknown,
  iterations = 15,
  warmup = 2,
): Promise<BenchmarkStat> {
  for (let i = 0; i < warmup; i++) {
    await fn();
  }
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    const t1 = performance.now();
    samples.push(t1 - t0);
  }
  return computeStats(name, category, samples);
}

async function runBenchmarks() {
  const label = process.argv[2] || "run";

  let resolveSessionUserFn: ((id: string) => Promise<unknown>) | null = null;
  try {
    const mod = await import("../src/lib/sessionCache");
    if (typeof mod.resolveSessionUser === "function") {
      resolveSessionUserFn = mod.resolveSessionUser;
    }
  } catch {
    resolveSessionUserFn = null;
  }

  const getOfficeTypeCountsFn =
    typeof (officeQueriesMod as Record<string, unknown>).getOfficeTypeCounts ===
    "function"
      ? ((officeQueriesMod as Record<string, unknown>)
          .getOfficeTypeCounts as () => Promise<unknown>)
      : null;

  const [sampleUser] = await db.select().from(users).limit(1);
  const sampleUsername = sampleUser?.username ?? "admin";
  const sampleSessionId = "perf_bench_temp_session_id";
  let createdTempSession = false;
  if (sampleUser) {
    await db
      .insert(sessions)
      .values({
        id: sampleSessionId,
        userId: sampleUser.id,
        expiresAt: Date.now() + 3600_000,
        fingerprint: null,
      })
      .onConflictDoNothing();
    createdTempSession = true;
  }

  const monthsRows = await db
    .select({ month: sql<string>`distinct substr(${schedules.date}, 1, 7)` })
    .from(schedules);
  const availableMonths = monthsRows
    .map((r) => r.month)
    .filter(Boolean)
    .sort();
  const historicalMonth = availableMonths[0] || "2026-06";

  const results: BenchmarkStat[] = [];

  // 1. Startup / Session / Layout
  results.push(
    await measure(
      "middleware_session_lookup",
      "1. Inicio & Middleware",
      async () => {
        if (resolveSessionUserFn) {
          return resolveSessionUserFn(sampleSessionId);
        }
        const [session] = await db
          .select({
            id: sessions.id,
            userId: sessions.userId,
            expiresAt: sessions.expiresAt,
            fingerprint: sessions.fingerprint,
          })
          .from(sessions)
          .where(eq(sessions.id, sampleSessionId));
        if (session) {
          await db
            .select({
              id: users.id,
              username: users.username,
              role: users.role,
              helpdeskId: users.helpdeskId,
              helpdeskName: users.helpdeskName,
              active: users.active,
              mesaActive: mesas.active,
              mesaName: mesas.name,
            })
            .from(users)
            .leftJoin(mesas, eq(users.helpdeskId, mesas.invgateId))
            .where(eq(users.id, session.userId));
        }
      },
      30,
    ),
  );

  if (createdTempSession) {
    await db.delete(sessions).where(eq(sessions.id, sampleSessionId));
  }

  results.push(
    await measure(
      "layout_unassigned_feedback",
      "1. Inicio & Middleware",
      async () => {
        await getUnassignedFeedbackCount();
      },
      30,
    ),
  );

  results.push(
    await measure(
      "home_agent_by_username",
      "1. Inicio & Middleware",
      async () => {
        await db
          .select({ name: agents.name })
          .from(agents)
          .where(eq(agents.username, sampleUsername))
          .limit(1);
      },
      30,
    ),
  );

  // 2. Oficinas (Pantalla inicial, búsqueda y paginación profunda)
  results.push(
    await measure(
      "offices_page_1",
      "2. Directorio de Oficinas",
      async () => {
        await getOffices({ page: 1, limit: 100 });
      },
      10,
    ),
  );

  results.push(
    await measure(
      "offices_deep_page_20",
      "2. Directorio de Oficinas",
      async () => {
        await getOffices({ page: 20, limit: 100 });
      },
      10,
    ),
  );

  results.push(
    await measure(
      "offices_search_ip_hostname",
      "2. Directorio de Oficinas",
      async () => {
        await getOffices({ page: 1, limit: 100, search: "10." });
      },
      10,
    ),
  );

  results.push(
    await measure(
      "offices_type_counts",
      "2. Directorio de Oficinas",
      async () => {
        if (getOfficeTypeCountsFn) {
          return getOfficeTypeCountsFn();
        }
        const rawCounts = await db
          .select({
            type: offices.type,
            officeType: offices.officeType,
            name: offices.name,
            invgateDisplayName: officeInvgateLinks.invgateDisplayName,
          })
          .from(offices)
          .leftJoin(
            officeInvgateLinks,
            eq(offices.id, officeInvgateLinks.officeId),
          );
        let auto = 0;
        let noAuto = 0;
        for (const row of rawCounts) {
          if (row.type === "SUCURSAL") {
            if (isSucursalAutomatizada(row)) auto++;
            else noAuto++;
          }
        }
        return { auto, noAuto };
      },
      15,
    ),
  );

  // 3. Inventario de Terminales
  results.push(
    await measure(
      "terminals_page_1",
      "3. Inventario de Terminales",
      async () => {
        await getTerminalDisplay({ page: 1, limit: 50 });
      },
      10,
    ),
  );

  results.push(
    await measure(
      "terminals_deep_page_15",
      "3. Inventario de Terminales",
      async () => {
        await getTerminalDisplay({ page: 15, limit: 50 });
      },
      10,
    ),
  );

  results.push(
    await measure(
      "terminals_global_aggregations",
      "3. Inventario de Terminales",
      async () => {
        await Promise.all([
          getTerminalStatusCounts(),
          getTTStatusCounts(),
          getMediterraneaStatusCounts(),
          getTerminalModelsByBrand(),
        ]);
      },
      10,
    ),
  );

  // 4. Supervisión & Contenido Antiguo (Cronograma, Asistencia, Calidad)
  results.push(
    await measure(
      "asistencia_historical_month",
      "4. Supervisión & Historial",
      async () => {
        await getAttendanceData(
          `${historicalMonth}-01`,
          `${historicalMonth}-28`,
        );
      },
      10,
    ),
  );

  results.push(
    await measure(
      "cronograma_historical_month",
      "4. Supervisión & Historial",
      async () => {
        const startDate = `${historicalMonth}-01`;
        const endDate = `${historicalMonth}-31`;
        await Promise.all([
          db
            .select()
            .from(schedules)
            .where(
              and(
                sql`${schedules.date} >= ${startDate}`,
                sql`${schedules.date} <= ${endDate}`,
              ),
            ),
          db
            .select()
            .from(agentSaturdayGroups)
            .where(eq(agentSaturdayGroups.month, historicalMonth)),
          db
            .select()
            .from(weekendOvertimeShifts)
            .where(
              and(
                sql`${weekendOvertimeShifts.weekendStartDate} >= ${startDate}`,
                sql`${weekendOvertimeShifts.weekendStartDate} <= ${endDate}`,
              ),
            ),
        ]);
      },
      15,
    ),
  );

  results.push(
    await measure(
      "calidad_6_months_history",
      "4. Supervisión & Historial",
      async () => {
        const months = [
          "05-2026",
          "06-2026",
          "07-2026",
          "08-2026",
          "09-2026",
          "10-2026",
        ];
        const [allAgentsRows, allParams, allAuditsRows, summaries] =
          await Promise.all([
            db
              .select({
                id: agents.id,
                name: agents.name,
                username: agents.username,
              })
              .from(agents)
              .leftJoin(users, eq(users.id, agents.userId))
              .where(
                and(eq(agents.incluidoCalidad, true), activeAgentCondition()),
              )
              .orderBy(agents.name),
            db.select().from(auditParameters).orderBy(auditParameters.order),
            db
              .select()
              .from(qualityAudits)
              .where(inArray(qualityAudits.month, months)),
            db
              .select()
              .from(monthlySummaries)
              .where(eq(monthlySummaries.month, "10-2026")),
          ]);
        const auditIds = allAuditsRows.map((a) => a.id);
        if (auditIds.length > 0) {
          await db
            .select()
            .from(auditScores)
            .where(inArray(auditScores.auditId, auditIds));
        }
        return allAgentsRows.length + allParams.length + summaries.length;
      },
      15,
    ),
  );

  // 5. Buscador de Usuarios & Historial de Auditoría
  results.push(
    await measure(
      "employees_search_query",
      "5. Buscador & Auditoría",
      async () => {
        const pattern = "*[gG][oOóÓ][mM][eEéÉ][zZ]*";
        const rows = await db
          .select({
            ...getTableColumns(employees),
            officeName: offices.name,
          })
          .from(employees)
          .leftJoin(offices, eq(employees.sucursal, offices.code))
          .where(
            or(
              sql`${employees.fullname} GLOB ${pattern}`,
              sql`${employees.username} GLOB ${pattern}`,
              sql`${employees.dni} GLOB ${pattern}`,
            ),
          )
          .orderBy(employees.fullname)
          .limit(50);
        return rows.length;
      },
      15,
    ),
  );

  results.push(
    await measure(
      "audit_logs_recent_and_old",
      "5. Buscador & Auditoría",
      async () => {
        const [recent, oldPage] = await Promise.all([
          db
            .select()
            .from(auditLogs)
            .orderBy(desc(auditLogs.timestamp))
            .limit(100),
          db
            .select()
            .from(auditLogs)
            .orderBy(desc(auditLogs.timestamp))
            .limit(100)
            .offset(500),
        ]);
        return recent.length + oldPage.length;
      },
      20,
    ),
  );

  const totalP50 = Number(
    results.reduce((acc, r) => acc + r.p50Ms, 0).toFixed(2),
  );
  const totalAvg = Number(
    results.reduce((acc, r) => acc + r.avgMs, 0).toFixed(2),
  );

  console.log(`\n=== BENCHMARK RESULTS [${label}] ===`);
  console.table(
    results.map((r) => ({
      Categoría: r.category,
      Operación: r.name,
      "p50 (ms)": r.p50Ms,
      "p95 (ms)": r.p95Ms,
      "avg (ms)": r.avgMs,
      "min (ms)": r.minMs,
      "max (ms)": r.maxMs,
    })),
  );
  console.log(
    `Total acumulado -> p50: ${totalP50} ms | avg: ${totalAvg} ms\n`,
  );

  const outDir = path.resolve(
    process.cwd(),
    "conductor/tracks/perf_optimization_20261016",
  );
  if (fs.existsSync(outDir)) {
    const outFile = path.join(outDir, `benchmark-${label}.json`);
    fs.writeFileSync(
      outFile,
      JSON.stringify(
        {
          label,
          timestamp: new Date().toISOString(),
          totalP50Ms: totalP50,
          totalAvgMs: totalAvg,
          results,
        },
        null,
        2,
      ),
      "utf-8",
    );
  }
}

runBenchmarks().catch((err) => {
  console.error(err);
  process.exit(1);
});
