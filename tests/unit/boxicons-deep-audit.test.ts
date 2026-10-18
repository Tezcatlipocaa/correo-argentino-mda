import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Boxicons Deep Audit & Adversarial Verification", () => {
  const boxiconsJsonPath = path.resolve(
    process.cwd(),
    "node_modules/@iconify-json/boxicons/icons.json",
  );
  const boxiconsData = JSON.parse(fs.readFileSync(boxiconsJsonPath, "utf-8"));
  const validIcons = new Set([
    ...Object.keys(boxiconsData.icons || {}),
    ...Object.keys(boxiconsData.aliases || {}),
  ]);

  function scanAllFiles(dir: string): string[] {
    let results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(scanAllFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }

  it("confirms specific eliminated invalid icons no longer exist anywhere in src/", () => {
    const forbiddenIcons = [
      "boxicons:filter-alt",
      "boxicons:target-lock",
      "boxicons:link-external",
    ];

    const srcDir = path.resolve(process.cwd(), "src");
    const allFiles = scanAllFiles(srcDir);

    const matches: Array<{ file: string; line: number; forbidden: string }> = [];

    for (const file of allFiles) {
      if (file.endsWith(".ico") || file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".woff2")) {
        continue;
      }
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        for (const forbidden of forbiddenIcons) {
          if (line.includes(forbidden)) {
            matches.push({
              file: path.relative(process.cwd(), file),
              line: idx + 1,
              forbidden,
            });
          }
        }
      });
    }

    expect(matches).toEqual([]);
  });

  it("verifies canonical replacements are actually present in the canvas components", () => {
    const officeCanvasPath = path.resolve(
      process.cwd(),
      "src/components/oficinas/estructura/OfficeTreeCanvas.tsx",
    );
    const categoryCanvasPath = path.resolve(
      process.cwd(),
      "src/components/reportes/categories/CategoryTreeCanvas.tsx",
    );

    const officeContent = fs.readFileSync(officeCanvasPath, "utf-8");
    const categoryContent = fs.readFileSync(categoryCanvasPath, "utf-8");

    // Check canonical replacements in OfficeTreeCanvas:
    expect(officeContent).toContain('icon="boxicons:filter"');

    // Check canonical replacements in CategoryTreeCanvas:
    expect(categoryContent).toContain('icon="boxicons:filter"');
    expect(categoryContent).toContain('icon="boxicons:scan"');
    expect(categoryContent).toContain('icon="boxicons:link-alt"');
  });

  it("checks ALL boxicons: occurrences in src/ against icons.json without extension restrictions", () => {
    const srcDir = path.resolve(process.cwd(), "src");
    const allFiles = scanAllFiles(srcDir);
    const iconRegex = /boxicons:([a-z0-9-]+)/gi;

    const invalidList: Array<{ file: string; line: number; icon: string }> = [];
    let totalChecked = 0;

    for (const file of allFiles) {
      if (file.endsWith(".ico") || file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".woff2")) {
        continue;
      }
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, idx) => {
        let match: RegExpExecArray | null;
        const lineRegex = /boxicons:([a-z0-9-]+)/gi;
        while ((match = lineRegex.exec(line)) !== null) {
          totalChecked++;
          const iconName = match[1].toLowerCase();
          if (!validIcons.has(iconName)) {
            invalidList.push({
              file: path.relative(process.cwd(), file),
              line: idx + 1,
              icon: iconName,
            });
          }
        }
      });
    }

    expect(totalChecked).toBeGreaterThan(100);
    expect(invalidList).toHaveLength(0);
  });
});
