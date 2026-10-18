import {
  computeAutomationMetrics,
  computeMonthlySnapshot,
} from "../src/lib/workflow/metrics";

/**
 * Verificación de la agregación de métricas de automatizaciones (función pura).
 * Ejecución: npx tsx tests/workflow-metrics.test.mjs
 */

const DAY = 86_400;
const nowDate = new Date(2026, 9, 9, 12, 0, 0);
const now = Math.floor(nowDate.getTime() / 1000);
const at = (daysAgo) => now - daysAgo * DAY;

const rows = [
  {
    automationId: 1,
    displayName: "A",
    branchCode: "B1",
    branchName: "Uno",
    statusId: 2,
    createdAt: at(2),
    updatedAt: at(1),
    closedAt: null,
  },
  {
    automationId: 2,
    displayName: "B",
    branchCode: "B2",
    branchName: "Dos",
    statusId: 1,
    createdAt: at(40),
    updatedAt: at(30),
    closedAt: null,
  },
  {
    automationId: 3,
    displayName: "C",
    branchCode: "B1",
    branchName: "Uno",
    statusId: 6,
    createdAt: at(10),
    updatedAt: at(3),
    closedAt: at(3),
  },
  {
    automationId: 4,
    displayName: "D",
    branchCode: "B2",
    branchName: "Dos",
    statusId: 2,
    createdAt: at(20),
    updatedAt: at(1),
    closedAt: null,
  },
  {
    automationId: 5,
    displayName: "E",
    branchCode: "B3",
    branchName: "Tres",
    statusId: 5,
    createdAt: at(100),
    updatedAt: at(90),
    closedAt: at(90),
  },
  {
    automationId: 6,
    displayName: "F",
    branchCode: "B1",
    branchName: "Uno",
    statusId: 3,
    createdAt: at(5),
    updatedAt: at(2),
    closedAt: null,
  },
];

const closures = new Map([
  [
    4,
    {
      automationId: 4,
      kind: "manual",
      reason: "Se cierra con tickets pendientes",
      percent: 80,
      closedBy: "ana",
      closedAt: at(1),
    },
  ],
]);

const metrics = computeAutomationMetrics(rows, closures, now);

const failures = [];
function check(name, condition) {
  if (!condition) {
    failures.push(`FAIL: ${name}`);
  } else {
    console.log(`ok - ${name}`);
  }
}

check(
  "totales: 6 registros, 3 activos, 3 finalizados",
  metrics.totals.total === 6 &&
    metrics.totals.active === 3 &&
    metrics.totals.finalized === 3,
);
check(
  "lead time: mediana 10, promedio 12, p90 19 sobre 3",
  metrics.leadTime.sample === 3 &&
    metrics.leadTime.medianDays === 10 &&
    metrics.leadTime.averageDays === 12 &&
    metrics.leadTime.p90Days === 19,
);
check(
  "backlog por antigüedad: 2 en 0-7, 0 en 8-15/16-30, 1 en >30",
  metrics.backlog[0].count === 2 &&
    metrics.backlog[1].count === 0 &&
    metrics.backlog[2].count === 0 &&
    metrics.backlog[3].count === 1,
);
check(
  "activo más antiguo = #2 con 40 días",
  metrics.oldestActive?.automationId === 2 &&
    metrics.oldestActive?.days === 40,
);
check(
  "ranking por activos: B1 (2) con más reciente, B2 (1) más antiguo",
  metrics.topBranchesByActive.map((b) => b.key).join(",") === "B1,B2" &&
    metrics.topBranchesByActive[1].oldestActiveDays === 40,
);
check(
  "throughput: rango real 2026-07 → 2026-10 (sin meses fantasma)",
  metrics.throughput.length === 4 &&
    metrics.throughput[0].month === "2026-07" &&
    metrics.throughput[metrics.throughput.length - 1].month === "2026-10",
);
check(
  "lead time por mes: 2026-10 tiene muestra 2 y mediana 13",
  metrics.leadTimeByMonth.length === 4 &&
    metrics.leadTimeByMonth[3].month === "2026-10" &&
    metrics.leadTimeByMonth[3].sample === 2 &&
    metrics.leadTimeByMonth[3].medianDays === 13,
);
check(
  "resumen ejecutivo y ritmo (histórico)",
  metrics.executive.total === 6 &&
    metrics.executive.finalized === 3 &&
    metrics.executive.active === 3 &&
    metrics.pace.finalizedPerWeek !== null &&
    metrics.pace.etaWeeks !== null,
);

// --- Fase 0/1: SLA, región, mesa, progreso, reaperturas, calidad, ventana ---
{
  const at2 = (daysAgo) => now - daysAgo * DAY;
  const row = (partial) => ({
    branchCode: "B0",
    branchName: "Base",
    estimatedEndAt: null,
    region: null,
    locality: null,
    assignedGroupId: null,
    assignedGroupName: null,
    progressPercent: null,
    reopenCount: 0,
    ...partial,
  });

  const rows2 = [
    row({
      automationId: 101,
      displayName: "A1",
      statusId: 6,
      createdAt: at2(10),
      updatedAt: at2(2),
      closedAt: at2(2),
      estimatedEndAt: now,
      region: "Metro",
      assignedGroupName: "Mesa A",
      branchCode: "B1",
    }),
    row({
      automationId: 102,
      displayName: "A2",
      statusId: 5,
      createdAt: at2(20),
      updatedAt: at2(1),
      closedAt: at2(1),
      estimatedEndAt: at2(5),
      region: "Metro",
      assignedGroupName: "Mesa A",
      reopenCount: 1,
      branchCode: "B2",
    }),
    row({
      automationId: 103,
      displayName: "A3",
      statusId: 2,
      createdAt: at2(3),
      updatedAt: at2(20),
      closedAt: null,
      region: "Sur",
      assignedGroupName: "Mesa B",
      progressPercent: 50,
      branchCode: "B3",
    }),
    row({
      automationId: 104,
      displayName: "A4",
      statusId: 1,
      createdAt: at2(40),
      updatedAt: at2(2),
      closedAt: null,
      progressPercent: 20,
      branchCode: "B4",
    }),
  ];

  const emptyClosures = new Map();
  const activeDays = new Map([
    [101, 3],
    [102, 6],
    [103, 2],
    [104, 10],
  ]);
  const metrics2 = computeAutomationMetrics(rows2, emptyClosures, now, {
    activeDaysByAutomation: activeDays,
  });

  check(
    "SLA: 1 de 2 on-time (50%), desvío promedio 1 día",
    metrics2.sla.sample === 2 &&
      metrics2.sla.onTime === 1 &&
      metrics2.sla.onTimeRate === 50 &&
      metrics2.sla.avgDeviationDays === 1,
  );
  check(
    "por región: Metro finaliza 2 (mediana 13.5), Sur tiene 1 activo",
    metrics2.byRegion.length === 2 &&
      metrics2.byRegion[0].label === "Metro" &&
      metrics2.byRegion[0].finalized === 2 &&
      metrics2.byRegion[0].medianLeadDays === 13.5 &&
      metrics2.byRegion[1].active === 1,
  );
  check(
    "tiempo trabajado: mediana 4.5 días activos, sin actividad mediana 9",
    metrics2.time.sampleActive === 4 &&
      metrics2.time.medianActiveDays === 4.5 &&
      metrics2.time.medianIdleDays === 9,
  );
  check(
    "distribución sin actividad: 0/1/1/2 en los buckets",
    metrics2.time.idleBuckets.map((b) => b.count).join(",") === "0,1,1,2",
  );
  check(
    "progreso: promedio 35, 1 estancado, 1 crítico",
    metrics2.progress.withData === 2 &&
      metrics2.progress.average === 35 &&
      metrics2.progress.stalled === 1 &&
      metrics2.progress.critical === 1,
  );
  check(
    "calidad del dato: sin fecha estimada 2, sin región 1",
    metrics2.dataQuality.total === 4 &&
      metrics2.dataQuality.missingEstimatedEnd === 2 &&
      metrics2.dataQuality.missingRegion === 1 &&
      metrics2.dataQuality.missingBranchCode === 0,
  );

  const windowed = computeAutomationMetrics(rows2, emptyClosures, now, {
    windowDays: 30,
  });
  check(
    "ventana 30d: cohorte 3, 1 activo, 2 finalizados",
    windowed.window.days === 30 &&
      windowed.totals.total === 3 &&
      windowed.totals.active === 1 &&
      windowed.totals.finalized === 2,
  );
  check(
    "delta vs período anterior: +200% creados; finalizados sin base",
    windowed.delta.createdPct === 200 && windowed.delta.finalizedPct === null,
  );

  const snapshot = computeMonthlySnapshot(rows2, emptyClosures, "2026-10");
  check(
    "snapshot 2026-10: creados 1, finalizados 2, activos al cierre 2",
    snapshot.created === 1 &&
      snapshot.finalized === 2 &&
      snapshot.activeAtMonthEnd === 2 &&
      snapshot.medianLeadDays === 13.5 &&
      snapshot.p90LeadDays === 19 &&
      snapshot.onTimeRate === 50,
  );
}

// Redondeo de la antigüedad por sucursal a 1 decimal.
{
  const rows3 = [
    {
      automationId: 700,
      displayName: "Fraccionaria",
      branchCode: "B9",
      branchName: "Nueve",
      statusId: 2,
      createdAt: now - 25.5222916 * DAY,
      updatedAt: now,
      closedAt: null,
      region: null,
    },
  ];
  const m = computeAutomationMetrics(rows3, new Map(), now);
  const stat = m.topBranchesByActive.find((b) => b.key === "B9");
  check(
    "antigüedad por sucursal redondeada a 1 decimal (25.5)",
    stat?.oldestActiveDays === 25.5,
  );
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-metrics: all checks passed");
