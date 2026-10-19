import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Phase 3: Interactive Trees and Category Explorer Tabs (#347, #348, #349)", () => {
  const categoryTreeCanvasPath = path.resolve(
    process.cwd(),
    "src/components/reportes/categories/CategoryTreeCanvas.tsx",
  );
  const officeTreeCanvasPath = path.resolve(
    process.cwd(),
    "src/components/oficinas/estructura/OfficeTreeCanvas.tsx",
  );
  const categoriasPagePath = path.resolve(
    process.cwd(),
    "src/pages/reportes/categorias.astro",
  );

  it("verifies CategoryCanvasNodeCard does not render N{depth} or status badges on node card (#347)", () => {
    const content = fs.readFileSync(categoryTreeCanvasPath, "utf-8");
    expect(content).not.toMatch(/N\{node\.depth\}/);
    // Node card component should not render status badges, but inspector drawer preserves it
    const nodeCardBlock = content.slice(content.indexOf("function CategoryCanvasNodeCard"), content.indexOf("export default function CategoryTreeCanvas"));
    expect(nodeCardBlock).not.toContain("getAnomalyBadgeClass");
    expect(nodeCardBlock).not.toContain("node.status");
    // Tickets badge should be preserved
    expect(nodeCardBlock).toMatch(/getTicketBadgeClass\(tickets\)/);
  });

  it("verifies tree canvases do not stop wheel propagation on node cards (#348)", () => {
    const catContent = fs.readFileSync(categoryTreeCanvasPath, "utf-8");
    const offContent = fs.readFileSync(officeTreeCanvasPath, "utf-8");

    // The canvas should attach native wheel listeners and nodes should not block wheel events
    expect(catContent).toContain('container.addEventListener("wheel"');
    expect(offContent).toContain('container.addEventListener("wheel"');

    // Neither node card should have onWheel stopPropagation
    expect(catContent).not.toMatch(/CategoryNodeCard[^>]*onWheel/);
  });

  it("verifies Category Explorer is separated into 2 sub-tabs (Listado y detalle / Mapa del árbol) (#349)", () => {
    const pageContent = fs.readFileSync(categoriasPagePath, "utf-8");

    // Inside panel-explorer there should be a ViewSwitcher or tab switcher separating:
    // 1. "Listado y detalle" (CategoryTreeExplorer - active by default)
    // 2. "Mapa del árbol" (CategoryTreeCanvas)
    expect(pageContent).toMatch(/Listado y detalle/);
    expect(pageContent).toMatch(/Mapa del árbol/);
    expect(pageContent).toContain("CategoryTreeExplorer");
    expect(pageContent).toContain("CategoryTreeCanvas");
  });
});
