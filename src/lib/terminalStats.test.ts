import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeTerminalStats,
  marcaBucket,
  osBucket,
  type TerminalStatsRow,
} from "./terminalStats";

const row = (
  overrides: Partial<TerminalStatsRow> = {},
): TerminalStatsRow => ({
  manufacturer: "Dell Inc.",
  operatingSystem: "Windows 11 Pro",
  nis: "OF001",
  officeName: "Sucursal Uno",
  provinceCode: "BA",
  provinceName: "Buenos Aires",
  regionId: "PBA-LP",
  regionName: "Buenos Aires y La Pampa",
  ...overrides,
});

test("osBucket mapea variantes y vacíos", () => {
  assert.equal(osBucket("Windows 10 Pro"), "Windows 10");
  assert.equal(osBucket("Windows Server 2019"), "Windows Server");
  assert.equal(osBucket("Debian GNU/Linux 12"), "Debian");
  assert.equal(osBucket(""), "Sin datos");
  assert.equal(osBucket(null), "Sin datos");
});

test("marcaBucket normaliza marcas conocidas y manda el resto a otras", () => {
  assert.equal(marcaBucket("Dell Inc."), "dell");
  assert.equal(marcaBucket("Hewlett-Packard"), "hp");
  assert.equal(marcaBucket("HP"), "hp");
  assert.equal(marcaBucket("LENOVO"), "lenovo");
  assert.equal(marcaBucket("Gigabyte Technology Co., Ltd."), "otras");
  assert.equal(marcaBucket(null), "otras");
});

test("KPIs: total, sucursales con oficina y porcentajes redondeados", () => {
  const rows = [
    row(),
    row({ operatingSystem: "Windows 10 Pro" }),
    row({
      manufacturer: "HP",
      operatingSystem: "Windows 10 Pro",
      nis: "OF002",
      officeName: "Sucursal Dos",
    }),
    row({
      manufacturer: null,
      operatingSystem: null,
      nis: "HUERFANO",
      officeName: null,
      provinceCode: null,
      provinceName: null,
      regionId: null,
      regionName: null,
    }),
  ];
  const stats = computeTerminalStats(rows);
  assert.deepEqual(stats.kpis, {
    total: 4,
    sucursales: 2,
    pctWin11: 25,
    pctWin10: 50,
  });
});

test("las series de todos los charts suman el total", () => {
  // Sin huérfanos: topSucursales excluye nis sin oficina, así que el cuadre
  // se prueba con filas todas asignadas a una sucursal.
  const rows = [
    row(),
    row({ operatingSystem: "Windows 10 Pro" }),
    row({
      manufacturer: "HP",
      operatingSystem: "Windows 10 Pro",
      nis: "OF002",
      officeName: "Sucursal Dos",
    }),
  ];
  const { kpis, charts } = computeTerminalStats(rows);
  for (const chart of Object.values(charts)) {
    const sum = chart.series[0].data.reduce((a, b) => a + b, 0);
    assert.equal(sum, kpis.total);
  }
});

test("los filtros combinan con AND", () => {
  const rows = [
    row(),
    row({ operatingSystem: "Windows 10 Pro" }),
    row({ manufacturer: "HP" }),
    row({ manufacturer: "HP", operatingSystem: "Windows 10 Pro" }),
  ];
  assert.equal(computeTerminalStats(rows, { marca: "dell" }).kpis.total, 2);
  assert.equal(
    computeTerminalStats(rows, { marca: "dell", os: "win10" }).kpis.total,
    1,
  );
  assert.equal(
    computeTerminalStats(rows, { marca: "hp", os: "win11" }).kpis.total,
    1,
  );
});

test("filtros de geografía y sin-dato", () => {
  const rows = [
    row(),
    row({
      nis: "OF003",
      officeName: "Sucursal Tres",
      provinceCode: "CF",
      provinceName: "Capital Federal",
      regionId: "CABA",
      regionName: "CABA",
    }),
    row({
      operatingSystem: null,
      nis: "HUERFANO",
      officeName: null,
      provinceCode: null,
      provinceName: null,
      regionId: null,
      regionName: null,
    }),
  ];
  assert.equal(computeTerminalStats(rows, { region: "CABA" }).kpis.total, 1);
  assert.equal(computeTerminalStats(rows, { provincia: "BA" }).kpis.total, 1);
  assert.equal(computeTerminalStats(rows, { os: "sin-dato" }).kpis.total, 1);
  const orphanOnly = computeTerminalStats(rows, { region: "CABA" });
  assert.deepEqual(orphanOnly.charts.porRegion.labels, ["CABA"]);
});

test("provincia: top-12 + Sin ubicación + Resto", () => {
  const named = Array.from({ length: 14 }, (_, i) =>
    row({
      nis: `OF${i + 10}`,
      officeName: `Sucursal ${i + 10}`,
      provinceName: `Provincia ${String(i + 1).padStart(2, "0")}`,
      provinceCode: `P${i + 1}`,
    }),
  );
  const rows = [
    ...named,
    row({
      nis: "HUERFANO",
      officeName: null,
      provinceCode: null,
      provinceName: null,
      regionId: null,
      regionName: null,
    }),
  ];
  const { labels, series } = computeTerminalStats(rows).charts.porProvincia;
  assert.equal(labels.length, 14);
  assert.equal(labels[12], "Sin ubicación");
  assert.equal(labels[13], "Resto");
  assert.equal(series[0].data[12], 1);
  assert.equal(series[0].data[13], 2);
});

test("top sucursales: orden desc y corte en 10", () => {
  const rows = Array.from({ length: 11 }, (_, i) =>
    Array.from({ length: i + 1 }, () =>
      row({ nis: `OF${i}`, officeName: `Sucursal ${i}` }),
    ),
  ).flat();
  const { labels, series } = computeTerminalStats(rows).charts.topSucursales;
  assert.equal(labels.length, 10);
  assert.equal(labels[0], "Sucursal 10");
  assert.equal(series[0].data[0], 11);
  assert.ok(!labels.includes("Sucursal 0"));
});
