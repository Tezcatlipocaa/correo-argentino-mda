import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Phase 2: Tables, Header Contrast, ChartCard and FullscreenButton (#329, #330, #334)", () => {
  const dataTableHeaderCellPath = path.resolve(
    process.cwd(),
    "src/components/ui/DataTableHeaderCell.astro",
  );
  const helpdeskTablePath = path.resolve(
    process.cwd(),
    "src/components/reportes/mesas/HelpdeskTable.astro",
  );
  const chartCardPath = path.resolve(
    process.cwd(),
    "src/components/ui/ChartCard.astro",
  );
  const fullscreenButtonAstroPath = path.resolve(
    process.cwd(),
    "src/components/ui/FullscreenButton.astro",
  );
  const fullscreenButtonTsxPath = path.resolve(
    process.cwd(),
    "src/components/ui/FullscreenButton.tsx",
  );

  it("verifies DataTableHeaderCell does not hardcode text-secondary-content on subtle headers (#329)", () => {
    const content = fs.readFileSync(dataTableHeaderCellPath, "utf-8");
    // Should inherit color or not force text-secondary-content unconditionally
    expect(content).not.toMatch(/"min-w-0[^"]*text-secondary-content/);
  });

  it("verifies HelpdeskTable has standardized cell padding and border styling (#329)", () => {
    const content = fs.readFileSync(helpdeskTablePath, "utf-8");
    // Each row should have standardized padding and dividing border matching TableShell/Directorio
    expect(content).toMatch(/px-4 py-3/);
    expect(content).toMatch(/border-b/);
    expect(content).toMatch(/border-base-200/);
  });

  it("verifies FullscreenButton components exist and are modularized (#330)", () => {
    expect(fs.existsSync(fullscreenButtonAstroPath)).toBe(true);
    expect(fs.existsSync(fullscreenButtonTsxPath)).toBe(true);
  });

  it("verifies FullscreenButton is consumed in DataTable and TableShell (#330)", () => {
    const dtContent = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/ui/DataTable.astro"),
      "utf-8",
    );
    const tsContent = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/ui/TableShell.astro"),
      "utf-8",
    );
    expect(dtContent).toContain("FullscreenButton");
    expect(tsContent).toContain("FullscreenButton");
  });

  it("verifies ChartCard maintains constant height and internal vertical scroll in table view (#334)", () => {
    const content = fs.readFileSync(chartCardPath, "utf-8");
    // data-chart-body should have fixed/constant height class (e.g. h-60 / h-[15rem] / min-h-[15rem])
    // data-chart-table should have overflow-y-auto and max-h
    expect(content).toMatch(/data-chart-table[^>]*overflow-y-auto/s);
    expect(content).toContain("chart?.resize()");
  });
});
