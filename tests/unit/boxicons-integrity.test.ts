import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Boxicons Iconify Integrity Audit (Tier 1 & Feature F7)", () => {
  function scanFiles(dir: string, extensions: string[]): string[] {
    let results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(scanFiles(fullPath, extensions));
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it(
    "verifies 0 invalid or non-existent boxicons in src/ against official @iconify-json/boxicons",
    () => {
      const boxiconsPath = path.resolve(
        process.cwd(),
        "node_modules/@iconify-json/boxicons/icons.json",
      );

    expect(fs.existsSync(boxiconsPath), "icons.json must exist in node_modules").toBe(true);

    const boxiconsData = JSON.parse(fs.readFileSync(boxiconsPath, "utf-8"));
    const validIcons = new Set([
      ...Object.keys(boxiconsData.icons || {}),
      ...Object.keys(boxiconsData.aliases || {}),
    ]);

    const srcDir = path.resolve(process.cwd(), "src");
    const sourceFiles = scanFiles(srcDir, [".astro", ".tsx", ".ts", ".jsx", ".js"]);
    expect(sourceFiles.length).toBeGreaterThan(0);

    const iconRegex = /boxicons:([a-z0-9-]+)/g;
    const invalidOccurrences: Array<{ file: string; line: number; icon: string }> = [];

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((lineText, lineIdx) => {
        let match: RegExpExecArray | null;
        // reset regex per line
        const lineRegex = /boxicons:([a-z0-9-]+)/g;
        while ((match = lineRegex.exec(lineText)) !== null) {
          const iconName = match[1];
          if (!validIcons.has(iconName)) {
            const relPath = path.relative(process.cwd(), filePath);
            invalidOccurrences.push({
              file: relPath,
              line: lineIdx + 1,
              icon: iconName,
            });
          }
        }
      });
    }

    if (invalidOccurrences.length > 0) {
      const report = invalidOccurrences
        .map((inv) => `  - ${inv.file}:${inv.line} -> "boxicons:${inv.icon}"`)
        .join("\n");
      // Expect 0 invalid icons
      expect(
        invalidOccurrences,
        `Found ${invalidOccurrences.length} invalid Boxicons in src/:\n${report}`,
      ).toHaveLength(0);
    } else {
      expect(invalidOccurrences).toHaveLength(0);
    }
  }, 30000);
});

