import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guard estático: un componente `<Icon>` usado sin importar
 * `astro-icon/components` compila igual y explota recién en el render con
 * `ReferenceError: Icon is not defined`. TypeScript no lo detecta porque el
 * tag se resuelve en runtime, así que ningún build falla.
 *
 * Caso real (2026-10-18): el refactor `cd0c8eb0` (botones crudos →
 * ActionButton) reemplazó la línea del import por la de ActionButton y dejó un
 * `<Icon>` sin migrar en MetricsContent.astro: el 500 de
 * /automatizaciones/metricas pasó el build y el deploy.
 */
describe("Integridad de imports de <Icon> en .astro", () => {
  const USAGE = /<Icon(?=[\s/>])/;
  const IMPORT = /from\s+["']astro-icon\/components["']/;

  function scanAstroFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanAstroFiles(fullPath));
      } else if (entry.name.endsWith(".astro")) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it("todo .astro que usa <Icon> lo importa de astro-icon/components", () => {
    const srcDir = path.resolve(process.cwd(), "src");
    const files = scanAstroFiles(srcDir);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      if (!USAGE.test(content) || IMPORT.test(content)) continue;

      content.split("\n").forEach((line, index) => {
        if (USAGE.test(line)) {
          offenders.push(
            `${path.relative(process.cwd(), filePath).replace(/\\/g, "/")}:${index + 1}`,
          );
        }
      });
    }

    expect(
      offenders,
      `usan <Icon> pero no importan { Icon } de "astro-icon/components"`,
    ).toEqual([]);
  });
});
