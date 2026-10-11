import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("AddEntityButton Component Contract", () => {
  const componentPath = resolve(
    process.cwd(),
    "src/components/ui/AddEntityButton.astro",
  );
  const source = readFileSync(componentPath, "utf-8");

  it("expone prop size opcional con soporte para sm, md y responsive", () => {
    expect(source).toMatch(/size\?:/);
    expect(source).toMatch(/["']sm["']\s*\|\s*["']md["']\s*\|\s*["']responsive["']/);
  });

  it("mantiene size default en sm para preservar los botones existentes", () => {
    expect(source).toMatch(/size\s*=\s*["']sm["']/);
  });

  it("define mapeo de clases que incluye btn-sm md:btn-md para responsive", () => {
    expect(source).toMatch(/btn-sm\s+md:btn-md/);
  });
});
