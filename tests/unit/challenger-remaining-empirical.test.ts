import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import * as cheerio from "cheerio";
import fs from "node:fs";
import path from "node:path";

vi.mock("@iconify/react", () => ({
  Icon: (props: any) =>
    React.createElement("span", {
      "data-icon": props.icon,
      className: props.className,
      style: { width: props.width, height: props.height },
    }),
}));

import CategoryTreeCanvas from "@/components/reportes/categories/CategoryTreeCanvas";
import type { CategoryNode } from "@/types/categories";

const dummyCategoryTree: CategoryNode = {
  id: 1,
  parentId: null,
  name: "Raíz Corporativa",
  totalTickets: 250,
  path: "Raíz Corporativa",
  depth: 0,
  isLeaf: false,
  status: "normal",
  anomalies: [],
  children: [
    {
      id: 2,
      parentId: 1,
      name: "Sistemas & Infraestructura",
      totalTickets: 180,
      path: "Raíz Corporativa > Sistemas & Infraestructura",
      depth: 1,
      isLeaf: false,
      status: "normal",
      anomalies: [],
      children: [
        {
          id: 3,
          parentId: 2,
          name: "Redes y Enlaces",
          totalTickets: 120,
          path: "Raíz Corporativa > Sistemas & Infraestructura > Redes y Enlaces",
          depth: 2,
          isLeaf: true,
          status: "normal",
          anomalies: [],
          children: [],
        },
      ],
    },
    {
      id: 4,
      parentId: 1,
      name: "Atención al Cliente",
      totalTickets: 70,
      path: "Raíz Corporativa > Atención al Cliente",
      depth: 1,
      isLeaf: true,
      status: "normal",
      anomalies: [],
      children: [],
    },
  ],
};

describe("Challenger Remaining 1 Empirical Test Suite", () => {
  const targetFiles = [
    "src/components/reportes/categories/CategoryTreeCanvas.tsx",
    "src/pages/oficinas/estadisticas.astro",
    "src/components/offices/stats/OficinasEstadisticasContent.astro",
    "src/components/offices/stats/OficinaDetalleContent.astro",
    "src/components/inventario/EstadisticasTerminalesContent.astro",
  ];

  describe("1. Raw Button and Link Elimination", () => {
    it("verifies 0 leftover raw buttons (<button class*='btn'>) across all target files", () => {
      const regex = /<button[^>]*class(?:Name)?=["'][^"']*btn/i;
      const findings: Array<{ file: string; line: number; match: string }> = [];

      for (const relPath of targetFiles) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        lines.forEach((line, index) => {
          if (regex.test(line)) {
            findings.push({ file: relPath, line: index + 1, match: line.trim() });
          }
        });
      }

      expect(findings).toEqual([]);
    });

    it("verifies 0 leftover raw links (<a class*='btn'>) across all target files", () => {
      const regex = /<a[^>]*class(?:Name)?=["'][^"']*btn/i;
      const findings: Array<{ file: string; line: number; match: string }> = [];

      for (const relPath of targetFiles) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        lines.forEach((line, index) => {
          if (regex.test(line)) {
            findings.push({ file: relPath, line: index + 1, match: line.trim() });
          }
        });
      }

      expect(findings).toEqual([]);
    });

    it("verifies ActionButton is used for the Estructura link in estadisticas.astro", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "src/pages/oficinas/estadisticas.astro"),
        "utf-8"
      );
      expect(content).toContain("<ActionButton");
      expect(content).toContain("oficinas/estructura");
      expect(content).not.toContain('<a class="btn');
    });

    it("verifies ActionButton is used for the Inventario link in EstadisticasTerminalesContent.astro", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/inventario/EstadisticasTerminalesContent.astro"),
        "utf-8"
      );
      expect(content).toContain("<ActionButton");
      expect(content).toContain("href={inventarioHref}");
      expect(content).not.toContain('<a class="btn btn-secondary');
    });
  });

  describe("2. Pagination Buttons in OficinasEstadisticasContent and ActionButton.astro", () => {
    it("verifies data-page-prev and data-page-next attributes are cleanly forwarded without [object Object]", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/offices/stats/OficinasEstadisticasContent.astro"),
        "utf-8"
      );
      expect(content).toContain('buttonProps={{ "data-page-prev": "" }}');
      expect(content).toContain('buttonProps={{ "data-page-next": "" }}');
      expect(content).toContain("data-page-prev");
      expect(content).toContain("data-page-next");
    });

    it("verifies ActionButton.astro destructures buttonProps out of attrs and spreads onto <button>", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/ui/ActionButton.astro"),
        "utf-8"
      );
      // Destructured from Astro.props so it does not pollute ...attrs
      expect(content).toMatch(/buttonProps,\s*\.\.\.attrs\s*\}\s*=\s*Astro\.props/);
      // Spread onto button element
      expect(content).toContain("{...buttonProps}");
      // Spread attrs
      expect(content).toContain("{...attrs}");
    });

    it("verifies compiled chunk does not stringify buttonProps as [object Object]", () => {
      const chunksDir = path.resolve(process.cwd(), "dist/server/chunks");
      if (fs.existsSync(chunksDir)) {
        const files = fs.readdirSync(chunksDir);
        let allChunksContent = "";
        for (const file of files) {
          if (file.startsWith("OficinasEstadisticasContent_") && file.endsWith(".mjs")) {
            const chunkContent = fs.readFileSync(path.join(chunksDir, file), "utf-8");
            expect(chunkContent).not.toContain("[object Object]");
            allChunksContent += chunkContent;
          }
        }
        expect(allChunksContent).toContain('"buttonProps": { "data-page-prev": "" }');
        expect(allChunksContent).toContain('"buttonProps": { "data-page-next": "" }');
      }
    });

    it("empirically proves Astro spreadAttributes formats buttonProps as valid HTML and avoids [object Object]", () => {
      const chunksDir = path.resolve(process.cwd(), "dist/server/chunks");
      if (fs.existsSync(chunksDir)) {
          // ActionButton chunk specifically imports the core server chunk that contains spreadAttributes
          const actionButtonChunk = fs.readdirSync(chunksDir).find((f) => f.startsWith("ActionButton_") && f.endsWith(".mjs"));
          if (!actionButtonChunk) return;
          const abContent = fs.readFileSync(path.join(chunksDir, actionButtonChunk), "utf-8");
          const importMatch = abContent.match(/from\s*["']\.\/([^"']+)["']/);
          if (!importMatch) return;
          const targetServerChunk = importMatch[1];
          const { pathToFileURL } = require("node:url");
          const chunkUrl = pathToFileURL(path.join(chunksDir, targetServerChunk)).href;
          const { execFileSync } = require("node:child_process");
          
          const script = `
            import("${chunkUrl}").then(m => {
              const valid = String(m.t({ "data-page-prev": "" }));
              const invalid = String(m.t({ buttonProps: { "data-page-prev": "" } }));
              console.log(JSON.stringify({ valid, invalid }));
            });
          `;
          const output = JSON.parse(execFileSync("node", ["--input-type=module", "-e", script]).toString());
          expect(output.valid).toBe(" data-page-prev");
          expect(output.valid).not.toContain("[object Object]");
          expect(output.invalid).toContain("[object Object]");
      }
    });

    it("verifies client script queries [data-page-prev] and [data-page-next] for pagination", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/offices/stats/OficinasEstadisticasContent.astro"),
        "utf-8"
      );
      expect(content).toContain('document.querySelector<HTMLButtonElement>("[data-page-prev]")');
      expect(content).toContain('document.querySelector<HTMLButtonElement>("[data-page-next]")');
      expect(content).toContain('document.querySelector("[data-page-prev]")?.addEventListener');
      expect(content).toContain('document.querySelector("[data-page-next]")?.addEventListener');
    });
  });

  describe("3. CategoryTreeCanvas Event Isolation, Controls and Drawer", () => {
    it("renders CategoryTreeCanvas with ActionButton zoom controls and correct icons", () => {
      const html = renderToString(
        React.createElement(CategoryTreeCanvas, {
          rootNode: dummyCategoryTree,
        })
      );
      const $ = cheerio.load(html);

      // Zoom join controls
      const zoomMinus = $("button[title='Alejar zoom (-)']");
      const zoomPlus = $("button[title='Acercar zoom (+)']");
      expect(zoomMinus.length).toBe(1);
      expect(zoomPlus.length).toBe(1);
      expect(zoomMinus.find("[data-icon='boxicons:minus']").length).toBe(1);
      expect(zoomPlus.find("[data-icon='boxicons:plus']").length).toBe(1);
    });

    it("renders FAB and Filter Popover with ActionButton and boxicons:filter", () => {
      const html = renderToString(
        React.createElement(CategoryTreeCanvas, {
          rootNode: dummyCategoryTree,
        })
      );
      const $ = cheerio.load(html);

      // FAB filter toggle button
      const fab = $("button[title='Abrir filtros de taxonomía']");
      expect(fab.length).toBe(1);
      expect(fab.find("[data-icon='boxicons:filter']").length).toBe(1);
      expect(fab.attr("class")).toContain("btn-circle");
    });

    it("verifies event isolation containers have data-floating-control", () => {
      const html = renderToString(
        React.createElement(CategoryTreeCanvas, {
          rootNode: dummyCategoryTree,
        })
      );
      const $ = cheerio.load(html);

      const floatingControls = $("[data-floating-control]");
      // Top toolbar, FAB container, bottom HUD should all have data-floating-control
      expect(floatingControls.length).toBeGreaterThanOrEqual(3);
    });

    it("verifies category node cards do NOT render tooltips or title attributes on node name", () => {
      const html = renderToString(
        React.createElement(CategoryTreeCanvas, {
          rootNode: dummyCategoryTree,
        })
      );
      const $ = cheerio.load(html);

      // All node card titles
      const titles = $("h4.line-clamp-2");
      expect(titles.length).toBeGreaterThan(0);
      titles.each((_, el) => {
        const titleEl = $(el);
        expect(titleEl.attr("title")).toBeUndefined();
        expect(titleEl.attr("data-tip")).toBeUndefined();
        expect(titleEl.hasClass("tooltip")).toBe(false);
      });
    });

    it("verifies CategoryTreeCanvas source code implements onWheel and onMouseDown stopPropagation on floating controls", () => {
      const content = fs
        .readFileSync(
          path.resolve(process.cwd(), "src/components/reportes/categories/CategoryTreeCanvas.tsx"),
          "utf-8"
        )
        .replace(/\r\n/g, "\n");
      // Top toolbar
      expect(content).toContain('data-floating-control\n        onWheel={(e) => e.stopPropagation()}\n        onMouseDown={(e) => e.stopPropagation()}');
      // FAB
      expect(content).toMatch(/data-floating-control[\s\S]*?onWheel=\{\(e\) => e\.stopPropagation\(\)\}[\s\S]*?onMouseDown=\{\(e\) => e\.stopPropagation\(\)\}/);
      // Bottom HUD
      expect(content).toMatch(/data-floating-control[\s\S]*?onWheel=\{\(e\) => e\.stopPropagation\(\)\}[\s\S]*?onMouseDown=\{\(e\) => e\.stopPropagation\(\)\}[\s\S]*?bottom-3 left-3/);
    });

    it("verifies Drawer in CategoryTreeCanvas uses ActionButton for closing and DaisyUI 5 stats", () => {
      const content = fs
        .readFileSync(
          path.resolve(process.cwd(), "src/components/reportes/categories/CategoryTreeCanvas.tsx"),
          "utf-8"
        )
        .replace(/\r\n/g, "\n");
      expect(content).toContain("<ActionButton\n            size=\"sm\"\n            color=\"btn-secondary\"\n            block\n            onClick={() => setInspectedNode(null)}\n          >\n            Cerrar Inspector\n          </ActionButton>");
      expect(content).toContain('<div className="stats stats-horizontal w-full bg-base-200/50 border border-base-200 rounded-box shadow-xs">');
      expect(content).toContain('<div className="stat-title text-xs text-base-content/60">Tickets Nivel</div>');
      expect(content).toContain('<div className="stat-title text-xs text-base-content/60">Profundidad</div>');
    });
  });

  describe("4. StatsGrid Support and OficinaDetalleContent Integration", () => {
    it("verifies StatsGrid.astro defines sm breakpoint support", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/ui/StatsGrid.astro"),
        "utf-8"
      );
      expect(content).toContain("sm?: 1 | 2 | 3 | 4 | 5 | 6;");
      expect(content).toContain('1: "sm:grid-cols-1"');
      expect(content).toContain('2: "sm:grid-cols-2"');
      expect(content).toContain("sm && SM[sm]");
    });

    it("verifies OficinaDetalleContent.astro uses StatsGrid with responsive breakpoints", () => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/offices/stats/OficinaDetalleContent.astro"),
        "utf-8"
      );
      expect(content).toContain('<StatsGrid base={1} sm={2} lg={4} class="w-full">');
      expect(content).not.toContain('<div class="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">');
    });
  });

  describe("5. Orphan CategoryInspector.astro Deletion", () => {
    it("confirms CategoryInspector.astro does not exist on disk", () => {
      const orphanPath = path.resolve(
        process.cwd(),
        "src/components/reportes/categories/CategoryInspector.astro"
      );
      expect(fs.existsSync(orphanPath)).toBe(false);
    });

    it("confirms no imports or references to CategoryInspector exist in src/", () => {
      function scan(dir: string): string[] {
        let results: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) results.push(...scan(full));
          else if (/\.(astro|tsx|ts|jsx|js)$/.test(entry.name)) results.push(full);
        }
        return results;
      }
      const files = scan(path.resolve(process.cwd(), "src"));
      const references: string[] = [];
      for (const file of files) {
        const text = fs.readFileSync(file, "utf-8");
        if (text.includes("CategoryInspector")) {
          references.push(path.relative(process.cwd(), file));
        }
      }
      expect(references).toEqual([]);
    });
  });
});
