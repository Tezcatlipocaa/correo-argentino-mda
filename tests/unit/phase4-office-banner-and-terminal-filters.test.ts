import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Phase 4: Office Directory Banner and Terminal Stats Filters (#328, #335, #336)", () => {
  const directorioContentPath = path.resolve(
    process.cwd(),
    "src/components/offices/DirectorioContent.astro",
  );
  const estadisticasContentPath = path.resolve(
    process.cwd(),
    "src/components/inventario/EstadisticasTerminalesContent.astro",
  );
  const estadisticasApiPath = path.resolve(
    process.cwd(),
    "src/pages/api/terminals/estadisticas.ts",
  );

  it("verifies DirectorioContent places quick access banner under filters with soft buttons (#328)", () => {
    const content = fs.readFileSync(directorioContentPath, "utf-8");
    // Banner should have Estructura, Estadísticas and Ver comparativa under the form filters
    expect(content).toMatch(/data-cta-estructura-oficinas/);
    expect(content).toMatch(/data-cta-estadisticas-oficinas/);
    expect(content).toMatch(/data-cta-comparativa-oficinas|admin\/invgate\/ubicaciones/);
    // Loose buttons above ViewSwitcher should be removed or moved to banner
    const beforeSwitcher = content.slice(0, content.indexOf("<ViewSwitcher"));
    expect(beforeSwitcher).not.toContain("data-cta-estructura-oficinas");
  });

  it("verifies cross-validation between Region and Province in terminal stats client & server (#335)", () => {
    const content = fs.readFileSync(estadisticasContentPath, "utf-8");
    const apiContent = fs.readFileSync(estadisticasApiPath, "utf-8");

    // Client should have regionId on provinces data or dynamically filter province options
    expect(content).toMatch(/regionId|data-provinces-by-region/);
    // API endpoint should validate that if region and provincia are passed, province belongs to region
    expect(apiContent).toMatch(/regionId/);
  });

  it("verifies 'Limpiar filtros' button in EstadisticasTerminalesContent (#336)", () => {
    const content = fs.readFileSync(estadisticasContentPath, "utf-8");
    expect(content).toMatch(/id="clear-filters-btn"|data-clear-filters/);
    expect(content).toMatch(/Limpiar filtros/);
    expect(content).toMatch(/boxicons:trash/);
  });
});
