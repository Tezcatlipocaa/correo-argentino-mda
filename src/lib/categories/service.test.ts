import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getCategoryCatalogReport,
  invalidateCategoryCache,
} from "./service";
import { readPersistedCache } from "../invgate/cache";

describe("Servicio de Categorías con Árbol Real de InvGate y Caché Persistido", () => {
  beforeEach(() => {
    invalidateCategoryCache();
  });

  test("getCategoryCatalogReport(2) returns canonical Mesa de Ayuda TI tree (root id 2, name 'Mesa de Ayuda TI')", async () => {
    const report = await getCategoryCatalogReport(2);

    assert.ok(report);
    assert.ok(report.tree);
    assert.equal(report.tree.id, 2);
    assert.equal(report.tree.name, "Mesa de Ayuda TI");
    assert.ok(Array.isArray(report.tree.children));
    assert.ok(report.tree.children.length > 0);
  });

  test("report.metrics.totalNodes >= 400 validating real scale of 719 nodes", async () => {
    const report = await getCategoryCatalogReport(2);

    assert.ok(
      report.metrics.totalNodes >= 400,
      `Se esperaban >= 400 nodos, se obtuvieron ${report.metrics.totalNodes}`,
    );
    assert.ok(report.metrics.totalNodes >= 700);
    assert.equal(report.metrics.leafNodes, 490);
  });

  test("report.metrics.structuralWastePercent is around 52% (matches direction report)", async () => {
    const report = await getCategoryCatalogReport(2);

    assert.ok(
      report.metrics.structuralWastePercent >= 50 &&
        report.metrics.structuralWastePercent <= 55,
      `structuralWastePercent esperado ~52%, pero fue ${report.metrics.structuralWastePercent}%`,
    );
  });

  test("SWR cache returns cached instance when called repeatedly", async () => {
    const report1 = await getCategoryCatalogReport(2);
    const report2 = await getCategoryCatalogReport(2);

    assert.strictEqual(report1, report2);
    assert.equal(report1.cachedAt, report2.cachedAt);
  });

  test("invalidateCategoryCache() clears in-memory and persisted cache", async () => {
    const report1 = await getCategoryCatalogReport(2);

    invalidateCategoryCache(2);

    const report2 = await getCategoryCatalogReport(2);

    assert.notStrictEqual(report1, report2);
    assert.equal(report1.tree.id, report2.tree.id);
    assert.equal(report1.metrics.totalNodes, report2.metrics.totalNodes);
  });

  test("persisted SQLite cache stores categories.mda_ti_tree", async () => {
    invalidateCategoryCache();
    const report = await getCategoryCatalogReport(2);

    const persisted = readPersistedCache<any>("categories.mda_ti_tree");
    assert.ok(persisted);
    assert.ok(persisted.tree || persisted.id === 2);
  });
});
