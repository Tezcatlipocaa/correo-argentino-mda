import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

describe("Header Controls Standardization & Duplicate Elimination (Feature F9)", () => {
  const categoriasPagePath = path.resolve(
    process.cwd(),
    "src/pages/reportes/categorias.astro",
  );
  const categoryCanvasPath = path.resolve(
    process.cwd(),
    "src/components/reportes/categories/CategoryTreeCanvas.tsx",
  );
  const officeCanvasPath = path.resolve(
    process.cwd(),
    "src/components/oficinas/estructura/OfficeTreeCanvas.tsx",
  );

  it("verifies duplicate header controls are eliminated from reportes/categorias.astro", () => {
    const astroContent = fs.readFileSync(categoriasPagePath, "utf-8");

    // The astro markup outside CategoryTreeCanvas should NOT contain duplicate model buttons or branch selector
    expect(astroContent).not.toContain('id="branch-selector"');
    expect(astroContent).not.toContain('id="btn-view-actual"');
    expect(astroContent).not.toContain('id="btn-view-propuesta"');

    // And should not contain window dispatchers for category-tree-branch or category-tree-model
    expect(astroContent).not.toContain('"category-tree-branch"');
    expect(astroContent).not.toContain('"category-tree-model"');
  });

  it("verifies CategoryTreeCanvas.tsx embeds the standardized toolbar controls with contract IDs", () => {
    const canvasContent = fs.readFileSync(categoryCanvasPath, "utf-8");

    expect(canvasContent).toContain('id="branch-selector"');
    expect(canvasContent).toContain('id="btn-view-actual"');
    expect(canvasContent).toContain('id="btn-view-propuesta"');

    // Verifies ActionButton usage in CategoryTreeCanvas
    expect(canvasContent).toContain("<ActionButton");
    expect(canvasContent).toContain('variant="ghost"');
  });

  it("verifies DaisyUI legacy bordered classes are eradicated from both interactive tree canvases", () => {
    const categoryContent = fs.readFileSync(categoryCanvasPath, "utf-8");
    const officeContent = fs.readFileSync(officeCanvasPath, "utf-8");

    // In DaisyUI v5, inputs and selects have borders natively; input-bordered and select-bordered are legacy
    expect(categoryContent).not.toContain("input-bordered");
    expect(categoryContent).not.toContain("select-bordered");

    expect(officeContent).not.toContain("input-bordered");
    expect(officeContent).not.toContain("select-bordered");
  });
});
