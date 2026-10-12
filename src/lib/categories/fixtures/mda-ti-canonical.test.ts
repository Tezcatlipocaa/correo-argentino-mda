import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MDA_TI_ARBOL_ACTUAL,
  MDA_TI_PROPUESTA_A,
  MDA_TI_PROPUESTA_B,
  MDA_TI_PROPUESTA_C,
  MDA_TI_COMPARATIVA,
  countTreeLeaves,
  countTreeNodes,
  getTreeMaxDepth,
} from "./mda-ti-canonical";
import { MDA_TI_REPORT_DATA } from "./mda-ti-report-data";

test("MDA_TI_ARBOL_ACTUAL has id 2, name 'Mesa de Ayuda TI', and children", () => {
  assert.equal(MDA_TI_ARBOL_ACTUAL.id, 2);
  assert.equal(MDA_TI_ARBOL_ACTUAL.name, "Mesa de Ayuda TI");
  assert.ok(Array.isArray(MDA_TI_ARBOL_ACTUAL.children));
  assert.ok(MDA_TI_ARBOL_ACTUAL.children.length > 0);
  assert.equal(MDA_TI_ARBOL_ACTUAL.children.length, 11);
});

test("MDA_TI_PROPUESTA_C has 10 families, and at least 340 total leaves", () => {
  assert.equal(MDA_TI_PROPUESTA_C.families.length, 10);
  const totalLeaves = countTreeLeaves(MDA_TI_PROPUESTA_C);
  assert.equal(totalLeaves, 340);
  assert.equal(MDA_TI_PROPUESTA_C.totalLeaves, 340);
});

test("MDA_TI_COMPARATIVA has actual (totalNodes: 719, deadNodes: 377) and propuestaC (totalNodes: 402, maxDepth: 3)", () => {
  assert.equal(countTreeNodes(MDA_TI_ARBOL_ACTUAL.children), MDA_TI_COMPARATIVA.actual.totalNodes);
  assert.equal(getTreeMaxDepth(MDA_TI_ARBOL_ACTUAL.children), MDA_TI_COMPARATIVA.actual.maxDepth);
  assert.equal(countTreeLeaves(MDA_TI_ARBOL_ACTUAL), MDA_TI_COMPARATIVA.actual.leaves);
  assert.equal(MDA_TI_PROPUESTA_C.totalNodes, MDA_TI_COMPARATIVA.propuestaC.totalNodes);
  assert.equal(MDA_TI_PROPUESTA_C.maxDepth, MDA_TI_COMPARATIVA.propuestaC.maxDepth);
  assert.equal(MDA_TI_COMPARATIVA.actual.totalNodes, 719);
  assert.equal(MDA_TI_COMPARATIVA.actual.deadNodes, 377);
  assert.equal(MDA_TI_COMPARATIVA.propuestaC.totalNodes, 402);
  assert.equal(MDA_TI_COMPARATIVA.propuestaC.maxDepth, 3);
});

test("MDA_TI_PROPUESTA_A and MDA_TI_PROPUESTA_B are defined with expected nodes", () => {
  assert.ok(Array.isArray(MDA_TI_PROPUESTA_A));
  assert.ok(Array.isArray(MDA_TI_PROPUESTA_B));
  assert.ok(MDA_TI_PROPUESTA_A.length > 0);
  assert.ok(MDA_TI_PROPUESTA_B.length > 0);
  assert.equal(countTreeLeaves(MDA_TI_PROPUESTA_A), 490);
  assert.equal(countTreeLeaves(MDA_TI_PROPUESTA_B), 490);
});

test("MDA_TI_REPORT_DATA exports hero with 4 KPIs and sections 1 to 6", () => {
  assert.equal(MDA_TI_REPORT_DATA.hero.title, "Rediseño del árbol de categorías");
  assert.equal(MDA_TI_REPORT_DATA.hero.kpis.length, 4);
  assert.equal(MDA_TI_REPORT_DATA.hero.kpis[0].value, "52%");
  assert.equal(MDA_TI_REPORT_DATA.hero.kpis[1].value, "4,71 → 3");
  assert.equal(MDA_TI_REPORT_DATA.hero.kpis[2].value, "46%");
  assert.equal(MDA_TI_REPORT_DATA.hero.kpis[3].value, "0");

  assert.equal(MDA_TI_REPORT_DATA.section1.weakPoints.length, 10);
  assert.equal(MDA_TI_REPORT_DATA.section2.pareto.length, 5);
  assert.equal(MDA_TI_REPORT_DATA.section2.monthlyVolume.length, 11);
  assert.equal(MDA_TI_REPORT_DATA.section3.closureTimes.length, 6);
  assert.equal(MDA_TI_REPORT_DATA.section3.immediateLeaves.length, 10);
  assert.equal(MDA_TI_REPORT_DATA.section4.indicators.length, 15);
  assert.equal(MDA_TI_REPORT_DATA.section5.actions.length, 4);
  assert.equal(MDA_TI_REPORT_DATA.section6.hypotheses.length, 2);
  assert.equal(MDA_TI_REPORT_DATA.section7.balance.length, 8);
});

test("canonical fixtures and report data are protected against runtime mutation", () => {
  assert.ok(Object.isFrozen(MDA_TI_ARBOL_ACTUAL));
  assert.ok(Object.isFrozen(MDA_TI_PROPUESTA_A));
  assert.ok(Object.isFrozen(MDA_TI_PROPUESTA_B));
  assert.ok(Object.isFrozen(MDA_TI_PROPUESTA_C));
  assert.ok(Object.isFrozen(MDA_TI_COMPARATIVA));
  assert.ok(Object.isFrozen(MDA_TI_REPORT_DATA));
});

