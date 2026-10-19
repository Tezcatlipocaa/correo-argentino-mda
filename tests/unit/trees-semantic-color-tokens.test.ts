import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import * as cheerio from "cheerio";
import fs from "node:fs";
import path from "node:path";

vi.mock("@iconify/react", () => ({
  Icon: (props: any) => React.createElement("span", { "data-icon": props.icon, className: props.className }),
}));

import OfficeTreeCanvas from "@/components/oficinas/estructura/OfficeTreeCanvas";
import OfficeDetailDrawer from "@/components/oficinas/estructura/OfficeDetailDrawer";
import type { OfficeTreeNode } from "@/lib/offices/structure-tree";

const mockOfficeTree: OfficeTreeNode = {
  id: "root",
  type: "root",
  name: "Red Postal Nacional",
  totalOffices: 4,
  totalTickets: 25,
  totalTerminals: 14,
  children: [
    {
      id: "reg-NOA",
      type: "region",
      name: "Noroeste Argentino",
      color: "#8b5cf6",
      totalOffices: 3,
      totalTickets: 20,
      totalTerminals: 10,
      children: [
        {
          id: "prov-salta",
          type: "province",
          name: "Salta",
          provinceCode: "SA",
          totalOffices: 2,
          totalTickets: 15,
          totalTerminals: 8,
          children: [
            {
              id: "off-4400",
              type: "office",
              name: "Sucursal Salta Centro",
              code: "4400",
              officeType: "SUCURSAL",
              isHeadquarter: true,
              totalOffices: 1,
              totalTickets: 12,
              totalTerminals: 6,
              children: [],
            },
          ],
        },
      ],
    },
  ],
};

const mockBuildingNode: OfficeTreeNode = {
  id: "bld-1",
  type: "building",
  name: "Edificio Central Retiro",
  code: "1000",
  totalOffices: 3,
  totalTickets: 30,
  totalTerminals: 15,
  isHeadquarter: true,
  metadata: {
    address: "Av. Antártida Argentina 1100",
    locality: "Retiro",
    province: "Capital Federal",
  },
  children: [
    {
      id: "off-1001",
      type: "office",
      name: "Sucursal Retiro",
      code: "1001",
      officeType: "SUCURSAL",
      isHeadquarter: false,
      totalOffices: 1,
      totalTickets: 18,
      totalTerminals: 10,
      children: [],
    },
  ],
};

describe("Milestone 4 (Feature F10): Semantic Color Tokens & DaisyUI v5 parity", () => {
  describe("OfficeTreeCanvas semantic tokens", () => {
    it("renders search button with hover:text-secondary instead of hover:text-primary", () => {
      const html = renderToString(React.createElement(OfficeTreeCanvas, { rootNode: mockOfficeTree }));
      const $ = cheerio.load(html);

      const searchBtn = $('button[aria-label="Ejecutar búsqueda"]');
      expect(searchBtn.length).toBe(1);
      const classes = searchBtn.attr("class") || "";
      expect(classes).toContain("hover:text-secondary");
      expect(classes).not.toContain("hover:text-primary");
    });

    it("renders Bézier connection lines with stroke=currentColor and semantic classes", () => {
      const html = renderToString(React.createElement(OfficeTreeCanvas, { rootNode: mockOfficeTree }));
      const $ = cheerio.load(html);

      const svgPaths = $("svg[data-tree-canvas] path");
      expect(svgPaths.length).toBeGreaterThan(0);

      svgPaths.each((_, el) => {
        const stroke = $(el).attr("stroke");
        expect(stroke).toBe("currentColor");

        const classes = $(el).attr("class") || "";
        expect(classes).toMatch(/text-secondary|text-base-content\/25/);
        expect(classes).not.toContain("#2563eb");
        expect(classes).not.toContain("#64748b");
      });
    });

    it("renders HUD tickets count with text-base-content font-bold instead of text-warning", () => {
      const html = renderToString(React.createElement(OfficeTreeCanvas, { rootNode: mockOfficeTree }));
      const $ = cheerio.load(html);

      const hud = $(".bottom-4.left-4");
      expect(hud.length).toBe(1);

      const ticketsSpan = hud.find("span").filter((_, el) => $(el).text().includes("tickets"));
      expect(ticketsSpan.length).toBe(1);
      const classes = ticketsSpan.attr("class") || "";
      expect(classes).toContain("text-base-content");
      expect(classes).toContain("font-bold");
      expect(classes).not.toContain("text-warning");
    });

    it("renders node ticket badges with badge-neutral and text-base-content instead of warning tokens", () => {
      const html = renderToString(React.createElement(OfficeTreeCanvas, { rootNode: mockOfficeTree }));
      const $ = cheerio.load(html);

      const ticketBadges = $("span").filter((_, el) => $(el).text().trim().endsWith("tk"));
      expect(ticketBadges.length).toBeGreaterThan(0);

      ticketBadges.each((_, el) => {
        const classes = $(el).attr("class") || "";
        if (classes.includes("badge")) {
          expect(classes).toContain("badge-neutral");
          expect(classes).toContain("text-base-content");
          expect(classes).not.toContain("text-warning");
          expect(classes).not.toContain("bg-warning");
        }
      });
    });
  });

  describe("OfficeDetailDrawer semantic tokens", () => {
    it("renders CABECERA badge with badge-secondary instead of badge-primary", () => {
      const html = renderToString(
        React.createElement(OfficeDetailDrawer, {
          isOpen: true,
          node: mockBuildingNode,
          onClose: () => {},
        })
      );
      const $ = cheerio.load(html);

      const cabecera = $("span.badge").filter((_, el) => $(el).text().trim() === "CABECERA");
      expect(cabecera.length).toBe(1);
      const classes = cabecera.attr("class") || "";
      expect(classes).toContain("badge-secondary");
      expect(classes).not.toContain("badge-primary");
    });

    it("renders stats button with btn-secondary and active tickets with text-base-content", () => {
      const officeNode: OfficeTreeNode = {
        ...mockBuildingNode,
        type: "office",
        isHeadquarter: true,
      };

      const html = renderToString(
        React.createElement(OfficeDetailDrawer, {
          isOpen: true,
          node: officeNode,
          onClose: () => {},
        })
      );
      const $ = cheerio.load(html);

      const statsBtn = $('a[href*="/oficinas/estadisticas/"]');
      expect(statsBtn.length).toBe(1);
      expect(statsBtn.attr("class")).toContain("btn-secondary");
      expect(statsBtn.attr("class")).not.toContain("btn-primary");

      const ticketsCard = $("div.bg-base-200\\/60").filter((_, el) =>
        $(el).text().includes("Tickets Activos")
      );
      expect(ticketsCard.length).toBe(1);
      const ticketsValue = ticketsCard.find("div.font-mono");
      expect(ticketsValue.length).toBe(1);
      const classes = ticketsValue.attr("class") || "";
      expect(classes).toContain("text-base-content");
      expect(classes).toContain("font-bold");
      expect(classes).not.toContain("text-warning");
    });

    it("renders building KPI, location pin, maps link and children with secondary and neutral tokens", () => {
      const html = renderToString(
        React.createElement(OfficeDetailDrawer, {
          isOpen: true,
          node: mockBuildingNode,
          onClose: () => {},
        })
      );
      const $ = cheerio.load(html);

      // Oficinas KPI count
      const officesCard = $("div.bg-base-200\\/60").filter((_, el) =>
        $(el).text().includes("Oficinas")
      );
      expect(officesCard.length).toBe(1);
      const officesValue = officesCard.find("div.font-mono");
      expect(officesValue.length).toBe(1);
      expect(officesValue.attr("class")).toContain("text-secondary");
      expect(officesValue.attr("class")).not.toContain("text-primary");

      // Location pin icon
      const pinIcon = $('span[data-icon="boxicons:location-pin-filled"]');
      expect(pinIcon.length).toBe(1);
      expect(pinIcon.attr("class")).toContain("text-secondary");
      expect(pinIcon.attr("class")).not.toContain("text-primary");

      // Maps link
      const mapsLink = $('a[title="Abrir en Google Maps externo"]');
      expect(mapsLink.length).toBe(1);
      expect(mapsLink.attr("class")).toContain("link-secondary");
      expect(mapsLink.attr("class")).not.toContain("link-primary");

      // Child NIS code
      const childCode = $("span").filter((_, el) => $(el).text().trim() === "1001");
      expect(childCode.length).toBe(1);
      expect(childCode.attr("class")).toContain("text-secondary");
      expect(childCode.attr("class")).not.toContain("text-primary");

      // Child ticket count
      const childTickets = $("span").filter((_, el) => $(el).text().includes("18 tkt"));
      expect(childTickets.length).toBe(1);
      expect(childTickets.attr("class")).toContain("text-base-content/80");
      expect(childTickets.attr("class")).not.toContain("text-warning");
    });
  });

  describe("CategoryTreeExplorer.astro & CategoryExecutiveReport.astro token parity", () => {
    it("CategoryTreeExplorer uses secondary tokens for view button, legend and interactive hovers", () => {
      const explorerContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/reportes/categories/CategoryTreeExplorer.astro"),
        "utf8"
      );

      // vC button
      const hasSecondaryVc =
        explorerContent.includes('class="btn btn-sm join-item btn-secondary btn-active on"') ||
        (explorerContent.includes('id="vC"') && explorerContent.includes('color="btn-secondary"'));
      expect(hasSecondaryVc).toBe(true);
      expect(explorerContent).not.toContain('class="btn btn-sm join-item btn-primary btn-active on"');
      expect(explorerContent).not.toContain('color="btn-primary"');

      // Nivel 1 legend dot
      expect(explorerContent).toContain('rounded-full bg-secondary"></span>');
      expect(explorerContent).not.toContain('rounded-full bg-warning"></span>');

      // CSS rule for c1 nm
      expect(explorerContent).toContain("color: var(--color-secondary);");
      expect(explorerContent).not.toContain("color: var(--color-warning);");

      // Interactive hover classes in JS
      expect(explorerContent).toContain("text-base-content/60 hover:text-secondary");
      expect(explorerContent).not.toContain("text-base-content/60 hover:text-primary");
      expect(explorerContent).toContain('nm.classList.add("clk", "cursor-pointer", "hover:text-secondary")');
      expect(explorerContent).not.toContain('nm.classList.add("clk", "cursor-pointer", "hover:text-primary")');

      // Script active button classes
      expect(explorerContent).toContain('btn.classList.add("btn-secondary", "btn-active", "on")');
      expect(explorerContent).toContain('btn.classList.remove("btn-secondary", "btn-active", "on")');
    });

    it("CategoryExecutiveReport uses text-base-content for resolution median", () => {
      const reportContent = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/reportes/categories/CategoryExecutiveReport.astro"),
        "utf8"
      );

      expect(reportContent).toContain(
        '<td class="text-right font-mono font-semibold py-2.5 px-4 text-base-content" data-label="Mediana de resolución">{leaf.resolutionMedian}</td>'
      );
      expect(reportContent).not.toContain(
        '<td class="text-right font-mono font-semibold py-2.5 px-4 text-warning" data-label="Mediana de resolución">{leaf.resolutionMedian}</td>'
      );
    });
  });
});
