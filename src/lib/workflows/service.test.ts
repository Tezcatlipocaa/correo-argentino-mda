import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getWorkflowReport,
  invalidateWorkflowCache,
  CACHE_TTL_MS,
} from "./service";
import { IMPLEMENTACION_FIXTURE } from "./fixtures/implementacion";

describe("Servicio de Métricas de Workflows (getWorkflowReport y Cache)", () => {
  beforeEach(() => {
    invalidateWorkflowCache();
  });

  test("CACHE_TTL_MS está configurado a 30 minutos", () => {
    assert.equal(CACHE_TTL_MS, 30 * 60 * 1000);
  });

  test("retorna estructura WorkflowReportData completa para 'implementacion'", async () => {
    const report = await getWorkflowReport("implementacion");

    assert.ok(report);
    assert.equal(report.config.slug, "implementacion");
    assert.equal(report.config.name, "Implementación, Cambio y Release");
    assert.ok(report.overview);
    assert.equal(report.overview.totalInstances, IMPLEMENTACION_FIXTURE.length);
    assert.ok(Array.isArray(report.instances));
    assert.equal(report.instances.length, IMPLEMENTACION_FIXTURE.length);
    assert.ok(typeof report.cachedAt === "string");
    assert.ok(!Number.isNaN(Date.parse(report.cachedAt)));
  });

  test("lanza error si el workflow no existe en el catálogo", async () => {
    await assert.rejects(
      async () => {
        await getWorkflowReport("workflow-inexistente");
      },
      {
        message: /no encontrado/i,
      },
    );
  });

  test("retorna la misma instancia cacheada si no expiró el TTL", async () => {
    const report1 = await getWorkflowReport("implementacion");
    const report2 = await getWorkflowReport("implementacion");

    assert.strictEqual(report1, report2);
    assert.equal(report1.cachedAt, report2.cachedAt);
  });

  test("invalidateWorkflowCache(slug) invalida selectivamente solo el slug especificado", async () => {
    const report1 = await getWorkflowReport("implementacion");
    invalidateWorkflowCache("otro-slug");
    const reportCached = await getWorkflowReport("implementacion");
    assert.strictEqual(report1, reportCached);

    invalidateWorkflowCache("implementacion");
    const report2 = await getWorkflowReport("implementacion");
    assert.notStrictEqual(report1, report2);
    assert.deepEqual(report1.overview, report2.overview);
  });

  test("invalidateWorkflowCache() sin argumentos limpia todo el cache", async () => {
    const report1 = await getWorkflowReport("implementacion");
    invalidateWorkflowCache();
    const report2 = await getWorkflowReport("implementacion");

    assert.notStrictEqual(report1, report2);
  });
});
