import { describe, it, expect } from "vitest";
import { existsSync, lstatSync, readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

const SCAN_ROOTS = ["src", "scripts"];
const EXTENSIONS = [".ts", ".mts", ".tsx", ".mjs", ".astro"];
const IDENTIFIER = String.raw`(?:[\w\x60"\[\]]+\.)?[\x60"\[]?mesas[\x60"\]]?(?![A-Za-z0-9_])`;
const PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /\.delete\(\s*mesas\s*\)/, hint: "db.delete(mesas)" },
  {
    pattern: new RegExp(`\\bdelete\\s+from\\s+${IDENTIFIER}`, "i"),
    hint: "DELETE FROM mesas",
  },
  {
    pattern: new RegExp(
      `\\bdrop\\s+table\\s+(?:if\\s+exists\\s+)?${IDENTIFIER}`,
      "i",
    ),
    hint: "DROP TABLE mesas",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (lstatSync(full).isSymbolicLink()) continue;
    if (lstatSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

describe("no borrar mesas desde código de producción", () => {
  it("ningún archivo de src/ o scripts/ borra filas de mesas", () => {
    const offenders = new Set<string>();

    for (const root of SCAN_ROOTS) {
      for (const file of walk(root)) {
        const content = readFileSync(file, "utf8");
        for (const { pattern, hint } of PATTERNS) {
          if (pattern.test(content)) {
            offenders.add(`${relative(process.cwd(), file)} → ${hint}`);
          }
        }
      }
    }

    expect(
      [...offenders],
      `Borrar mesas destruye en cascada kb_articles y kb_categories, que no están en la papelera. Deshabilitá la mesa con active = false / assignable = false en vez de borrarla.\n${[...offenders].join("\n")}`,
    ).toEqual([]);
  });
});
