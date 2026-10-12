import { test } from "node:test";
import assert from "node:assert/strict";
import type { InvgateIncident } from "@/types/invgate";
import {
  MASS_EVENT_MIN_OFFICES,
  buildCountChart,
  buildModernizacionPorProvincia,
  buildModernizacionTimeline,
  clusterMassEvents,
  countMassEventsByCode,
  countOpenIncidentsByCode,
  toEpochMs,
} from "./officeStats";

const AR_NOON = Date.parse("2026-10-12T15:00:00Z"); // 12:00 en Buenos Aires

function incident(
  id: number,
  categoryId: number | null,
  locationId: number | null,
  createdAtSec: number,
): InvgateIncident {
  return {
    id,
    title: `Ticket ${id}`,
    description: "",
    pretty_id: `I${id}`,
    category_id: categoryId,
    priority_id: 1,
    status_id: 1,
    type_id: 1,
    source_id: 1,
    user_id: 1,
    creator_id: 1,
    assigned_id: null,
    assigned_group_id: null,
    location_id: locationId,
    process_id: null,
    date_ocurred: null,
    created_at: createdAtSec,
    last_update: createdAtSec,
    solved_at: null,
    closed_at: null,
    closed_reason: null,
    data_cleaned: null,
    rating: null,
    attachments: [],
    sla_incident_resolution: null,
    sla_incident_first_reply: null,
    custom_fields: [],
    request_customer_sentiment_initial: "",
    request_customer_sentiment_current: "",
  };
}

test("clusterMassEvents agrupa por categoria+solo hoy y exige el minimo de oficinas", () => {
  const nowMs = AR_NOON;
  const todaySec = Math.floor(AR_NOON / 1000) - 3600;
  const yesterdaySec = todaySec - 24 * 3600;
  const locationToCode = new Map([
    [1, "B0001"], [2, "B0002"], [3, "B0003"], [4, "B0004"], [5, "B0005"], [6, "B0006"],
  ]);
  const incidents = [
    incident(1, 257, 1, todaySec),
    incident(2, 257, 2, todaySec),
    incident(3, 257, 3, todaySec),
    incident(4, 257, 4, todaySec),
    incident(5, 257, 5, todaySec), // 5 oficinas -> evento
    incident(6, 257, 1, todaySec), // repetido: no suma oficina
    incident(7, 257, 6, yesterdaySec), // ayer: fuera de ventana
    incident(8, 999, 6, todaySec), // 1 oficina: bajo el minimo
    incident(9, null, 999, todaySec), // location sin oficina mapeada
  ];
  const events = clusterMassEvents(incidents, locationToCode, nowMs);
  assert.equal(events.length, 1);
  assert.equal(events[0].categoriaId, 257);
  assert.equal(events[0].oficinas, MASS_EVENT_MIN_OFFICES);
  assert.equal(events[0].tickets, 6);
  assert.equal(events[0].officeCodes.length, MASS_EVENT_MIN_OFFICES);
});

test("minimo de oficinas es configurable", () => {
  const nowMs = AR_NOON;
  const todaySec = Math.floor(AR_NOON / 1000) - 3600;
  const locationToCode = new Map([[1, "B0001"], [2, "B0002"]]);
  const incidents = [incident(1, 1, 1, todaySec), incident(2, 1, 2, todaySec)];
  assert.equal(clusterMassEvents(incidents, locationToCode, nowMs).length, 0);
  assert.equal(clusterMassEvents(incidents, locationToCode, nowMs, 2).length, 1);
});

test("countOpenIncidentsByCode y countMassEventsByCode cuentan por NIS", () => {
  const incidents = [
    incident(1, 257, 1, 0),
    incident(2, 257, 1, 0),
    incident(3, 999, 2, 0),
  ];
  const locationToCode = new Map([[1, "B0001"], [2, "B0002"]]);
  const open = countOpenIncidentsByCode(incidents, locationToCode);
  assert.equal(open.get("B0001"), 2);
  assert.equal(open.get("B0002"), 1);
  const events = [
    { categoriaId: 257, titulo: "a", oficinas: 5, tickets: 6, desde: 0, officeCodes: ["B0001", "B0002"] },
  ];
  const byCode = countMassEventsByCode(events);
  assert.equal(byCode.get("B0001"), 1);
  assert.equal(byCode.get("B0002"), 1);
  assert.equal(byCode.get("B9999"), undefined);
});

test("buildModernizacionPorProvincia separa cerrados en ventana de en curso", () => {
  const nowMs = Date.parse("2026-10-12T15:00:00Z");
  const windowStartMs = nowMs - 30 * 24 * 3600 * 1000;
  const rows = [
    { provinceName: "Buenos Aires", createdAt: windowStartMs + 1000, closedAt: nowMs - 1000 }, // cerrado en ventana
    { provinceName: "Buenos Aires", createdAt: nowMs - 1000, closedAt: null }, // en curso
    { provinceName: "Córdoba", createdAt: windowStartMs - 90 * 24 * 3600 * 1000, closedAt: null }, // en curso viejo
    { provinceName: "Córdoba", createdAt: windowStartMs - 1000, closedAt: windowStartMs - 500 }, // cerrado fuera
  ];
  const chart = buildModernizacionPorProvincia(rows, windowStartMs, nowMs);
  assert.deepEqual(chart.labels.slice().sort(), ["Buenos Aires", "Córdoba"]);
  const cerrados = chart.series.find((s) => s.label === "Cerrados")!;
  const enCurso = chart.series.find((s) => s.label === "En curso")!;
  const idxBsAs = chart.labels.indexOf("Buenos Aires");
  const idxCba = chart.labels.indexOf("Córdoba");
  assert.equal(cerrados.data[idxBsAs], 1);
  assert.equal(enCurso.data[idxBsAs], 1);
  assert.equal(cerrados.data[idxCba], 0);
  assert.equal(enCurso.data[idxCba], 1);
});

test("buildModernizacionTimeline apila cerrados y en curso por dia", () => {
  const nowMs = Date.parse("2026-10-12T15:00:00Z");
  const windowStartMs = nowMs - 2 * 24 * 3600 * 1000;
  const rows = [
    { provinceName: "BA", createdAt: windowStartMs + 3600000, closedAt: windowStartMs + 7200000 },
    { provinceName: "BA", createdAt: nowMs - 3600000, closedAt: null },
  ];
  const chart = buildModernizacionTimeline(rows, windowStartMs, nowMs);
  assert.equal(chart.labels.length, 3);
  assert.equal(chart.series[0].data.reduce((a, b) => a + b, 0), 1);
  assert.equal(chart.series[1].data.reduce((a, b) => a + b, 0), 1);
  assert.deepEqual(chart.series[0].data, [1, 0, 0]); // cerrado el primer día
  assert.deepEqual(chart.series[1].data, [0, 0, 1]); // en curso el último día
});

test("buildModernizacionTimeline clampea cierres futuros y altas viejas a los bordes", () => {
  const nowMs = Date.parse("2026-10-12T15:00:00Z");
  const windowStartMs = nowMs - 2 * 24 * 3600 * 1000;
  const rows = [
    { provinceName: "BA", createdAt: windowStartMs + 3600000, closedAt: nowMs + 5 * 24 * 3600 * 1000 }, // cierre futuro
    { provinceName: "BA", createdAt: nowMs - 10 * 24 * 3600 * 1000, closedAt: null }, // alta pre-ventana
  ];
  const chart = buildModernizacionTimeline(rows, windowStartMs, nowMs);
  assert.equal(chart.labels.length, 3);
  assert.deepEqual(chart.series[0].data, [0, 0, 1]); // cierre futuro -> último bucket
  assert.deepEqual(chart.series[1].data, [1, 0, 0]); // alta vieja -> primer bucket
});

test("buildCountChart cuenta por etiqueta, saltea nulos y preserva orden de inserción", () => {
  const chart = buildCountChart(["A", null, "B", "A", undefined], "Incidentes");
  assert.deepEqual(chart.labels, ["A", "B"]);
  assert.equal(chart.series.length, 1);
  assert.equal(chart.series[0].label, "Incidentes");
  assert.deepEqual(chart.series[0].data, [2, 1]);
});

test("clusterMassEvents ordena por oficinas desc, luego tickets desc, y admite categoria null", () => {
  const nowMs = AR_NOON;
  const todaySec = Math.floor(AR_NOON / 1000) - 3600;
  const olderSec = todaySec - 1800;
  const locationToCode = new Map<number, string>(
    Array.from({ length: 8 }, (_, i) => [i + 1, `B000${i + 1}`] as [number, string]),
  );
  const incidents = [
    // Grupo A: 6 oficinas, 7 tickets (incluye el más viejo)
    incident(1, 100, 1, olderSec),
    incident(2, 100, 2, todaySec),
    incident(3, 100, 3, todaySec),
    incident(4, 100, 4, todaySec),
    incident(5, 100, 5, todaySec),
    incident(6, 100, 6, todaySec),
    incident(7, 100, 1, todaySec),
    // Grupo B: 5 oficinas, 6 tickets (una oficina repetida)
    incident(8, 200, 3, todaySec),
    incident(9, 200, 4, todaySec),
    incident(10, 200, 5, todaySec),
    incident(11, 200, 6, todaySec),
    incident(12, 200, 7, todaySec),
    incident(13, 200, 3, todaySec),
    // Grupo null: 5 oficinas, 5 tickets
    incident(14, null, 2, todaySec),
    incident(15, null, 3, todaySec),
    incident(16, null, 4, todaySec),
    incident(17, null, 5, todaySec),
    incident(18, null, 6, todaySec),
  ];
  const events = clusterMassEvents(incidents, locationToCode, nowMs);
  assert.deepEqual(
    events.map((e) => [e.categoriaId, e.oficinas, e.tickets]),
    [
      [100, 6, 7], // más oficinas primero
      [200, 5, 6], // empate en oficinas: desempata por tickets (6 > 5)
      [null, 5, 5], // categoría nula soportada
    ],
  );
  const groupA = events.find((e) => e.categoriaId === 100)!;
  assert.equal(groupA.titulo, "Ticket 1"); // título del ticket más viejo, no del orden de entrada
  assert.equal(groupA.desde, olderSec * 1000);
  assert.deepEqual(groupA.officeCodes, ["B0001", "B0002", "B0003", "B0004", "B0005", "B0006"]);
  const nullGroup = events.find((e) => e.categoriaId === null)!;
  assert.equal(nullGroup.oficinas, 5);
});

test("toEpochMs normaliza segundos y milisegundos", () => {
  assert.equal(toEpochMs(1700000000), 1700000000000); // segundos
  assert.equal(toEpochMs(1700000000000), 1700000000000); // ms
  assert.equal(toEpochMs(null), null);
});
