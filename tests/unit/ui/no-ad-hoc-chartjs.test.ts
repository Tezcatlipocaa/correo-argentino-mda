import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_ROOT = fileURLToPath(new URL("../../../src", import.meta.url));
const MIDDLEWARE_PATH = join(SRC_ROOT, "middleware.ts");

// El unico lugar donde se permite instanciar Chart.js es el componente que
// centraliza tokens, tabla accesible y re-init tras server islands.
const ALLOWED = new Set(["components/ui/ChartCard.astro".split("/").join(sep)]);

const SCAN_EXTENSIONS = [".astro", ".ts", ".tsx", ".js", ".mjs", ".cjs"];

const CDN_PATTERN = /cdn\.jsdelivr\.net\/npm\/chart\.js/i;
const NEW_CHART_PATTERN = /new\s+Chart\s*\(/;

interface SourceFile {
  path: string;
  content: string;
}

function listSourceFiles(dir: string): SourceFile[] {
  const out: SourceFile[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
      continue;
    }
    if (!SCAN_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;
    out.push({
      path: relative(SRC_ROOT, full),
      content: readFileSync(full, "utf8"),
    });
  }
  return out;
}

function findViolations(files: SourceFile[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    if (CDN_PATTERN.test(file.content)) {
      violations.push(`${file.path}: carga chart.js desde CDN`);
    }
    if (NEW_CHART_PATTERN.test(file.content) && !ALLOWED.has(file.path)) {
      violations.push(`${file.path}: instancia Chart.js fuera de ChartCard`);
    }
  }
  return violations;
}

describe("Chart.js centralizado en ChartCard", () => {
  it("el detector marca CDN y new Chart fuera del allowlist", () => {
    const files: SourceFile[] = [
      { path: join("components", "ui", "ChartCard.astro"), content: "new Chart(ctx, {})" },
      { path: join("components", "foo.astro"), content: "<script src=\"https://cdn.jsdelivr.net/npm/chart.js@4\"></script>" },
      { path: join("lib", "bar.ts"), content: "const c = new Chart(ctx, {});" },
      { path: join("lib", "clean.ts"), content: "export const x = 1;" },
    ];
    expect(findViolations(files)).toEqual([
      `${join("components", "foo.astro")}: carga chart.js desde CDN`,
      `${join("lib", "bar.ts")}: instancia Chart.js fuera de ChartCard`,
    ]);
  });

  it("el arbol de src/ no tiene Chart.js ad-hoc", () => {
    expect(findViolations(listSourceFiles(SRC_ROOT))).toEqual([]);
  });

  it("la CSP no reintroduce cdn.jsdelivr.net", () => {
    const source = readFileSync(MIDDLEWARE_PATH, "utf8");
    expect(source).not.toContain("cdn.jsdelivr.net");
  });
});
