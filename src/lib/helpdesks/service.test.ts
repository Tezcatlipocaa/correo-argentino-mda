import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getHelpdesksReport,
  invalidateHelpdesksCache,
  CACHE_TTL_MS,
} from "./service";

describe("Servicio de Métricas de Mesas (Integración con Base de Datos)", () => {
  beforeEach(() => {
    invalidateHelpdesksCache();
  });

  test("retorna items derivados de la base de datos real con nombres auténticos de InvGate", async () => {
    const report = await getHelpdesksReport();

    assert.ok(report, "El reporte debe existir");
    assert.ok(report.overview, "El overview debe existir");
    assert.ok(Array.isArray(report.items), "Items debe ser un array");

    assert.ok(
      report.items.length > 10,
      `Se esperaban más de 10 mesas reales de DB, pero se obtuvieron ${report.items.length}`,
    );

    const hasAuthenticNames = report.items.some(
      (item) =>
        item.name.includes("TI_") ||
        item.name.includes("SAP") ||
        item.name.includes("REPde_") ||
        item.name.includes("Mesa"),
    );
    assert.ok(
      hasAuthenticNames,
      "Las mesas deben contener nombres auténticos de InvGate (TI_, SAP, REPde_, o Mesa)",
    );

    const mainMda = report.items.find((item) => item.isMainMda);
    assert.ok(mainMda, "Debe existir al menos una mesa marcada como isMainMda");

    for (const item of report.items.slice(0, 10)) {
      assert.ok(typeof item.id === "number", "id debe ser numérico");
      assert.ok(typeof item.name === "string" && item.name.length > 0, "name no debe estar vacío");
      assert.ok(typeof item.displayName === "string", "displayName debe ser string");
      assert.ok(typeof item.totalMembers === "number" && item.totalMembers >= 0);
      assert.ok(typeof item.incomingTicketsMonth === "number" && item.incomingTicketsMonth >= 0);
      assert.ok(typeof item.resolvedTicketsMonth === "number" && item.resolvedTicketsMonth >= 0);
      assert.ok(typeof item.inOutRatio === "number");
      assert.ok(item.backlog && typeof item.backlog.active === "number");
      assert.ok(item.serviceTimes && typeof item.serviceTimes.slaResolutionCompliancePercent === "number");
      assert.ok(item.csat && typeof item.csat.averageRating === "number");
    }

    assert.equal(report.overview.totalHelpdesks, report.items.length);
    assert.ok(report.overview.totalActiveTickets > 0);
    assert.ok(report.overview.globalAvgCsat > 0);
  });

  test("retorna la misma instancia cacheada si no expiró el TTL (SWR Cache)", async () => {
    const report1 = await getHelpdesksReport();
    const report2 = await getHelpdesksReport();

    assert.strictEqual(report1, report2);
    assert.equal(report1.cachedAt, report2.cachedAt);
  });

  test("invalidateHelpdesksCache limpia el cache y fuerza nueva generación", async () => {
    const report1 = await getHelpdesksReport();

    invalidateHelpdesksCache();

    const report2 = await getHelpdesksReport();

    assert.notStrictEqual(report1, report2);
    assert.equal(report1.items.length, report2.items.length);
    assert.deepEqual(report1.overview, report2.overview);
  });

  test("CACHE_TTL_MS está configurado a 30 minutos", () => {
    assert.equal(CACHE_TTL_MS, 30 * 60 * 1000);
  });
});
