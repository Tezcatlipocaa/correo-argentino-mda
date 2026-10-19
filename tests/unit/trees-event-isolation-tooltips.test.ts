import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import * as cheerio from "cheerio";

vi.mock("@iconify/react", () => ({
  Icon: (props: any) => React.createElement("span", { "data-icon": props.icon }),
}));

import OfficeTreeCanvas from "@/components/oficinas/estructura/OfficeTreeCanvas";
import CategoryTreeCanvas from "@/components/reportes/categories/CategoryTreeCanvas";
import type { OfficeTreeNode } from "@/lib/offices/structure-tree";
import type { CategoryNode } from "@/lib/categories/types";

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

const mockCategoryTree: CategoryNode = {
  id: 2,
  name: "Mesa de Ayuda TI",
  depth: 0,
  path: "Mesa de Ayuda TI",
  tickets: 500,
  children: [
    {
      id: 10,
      name: "Hardware y Periféricos",
      depth: 1,
      path: "Mesa de Ayuda TI > Hardware y Periféricos",
      tickets: 200,
      children: [
        {
          id: 101,
          name: "Impresoras Térmicas Zebra",
          depth: 2,
          path: "Mesa de Ayuda TI > Hardware y Periféricos > Impresoras Térmicas Zebra",
          tickets: 80,
          children: [],
        },
      ],
    },
  ],
};

describe("Tree Canvases: Event Isolation (Feature F5) and Tooltip Removal (Feature F6)", () => {
  describe("OfficeTreeCanvas", () => {
    it("renders floating controls with data-floating-control attribute", () => {
      const html = renderToString(React.createElement(OfficeTreeCanvas, { rootNode: mockOfficeTree }));
      const $ = cheerio.load(html);

      const floatingControls = $("[data-floating-control]");
      expect(floatingControls.length).toBeGreaterThanOrEqual(3);

      // Top Toolbar has data-floating-control
      const toolbar = floatingControls.filter((_, el) => $(el).hasClass("border-b"));
      expect(toolbar.length).toBe(1);

      // HUD has data-floating-control
      const hud = floatingControls.filter((_, el) => $(el).hasClass("bottom-4") && $(el).hasClass("left-4"));
      expect(hud.length).toBe(1);

      // FAB has data-floating-control
      const fab = floatingControls.filter((_, el) => $(el).hasClass("bottom-4") && $(el).hasClass("right-4"));
      expect(fab.length).toBe(1);
    });

    it("does not render tooltip class, tooltip-top, or data-tip on node card titles", () => {
      const html = renderToString(React.createElement(OfficeTreeCanvas, { rootNode: mockOfficeTree }));
      const $ = cheerio.load(html);

      // No DaisyUI tooltip classes on cards
      expect($(".tooltip").length).toBe(0);
      expect($(".tooltip-top").length).toBe(0);

      // No data-tip attribute on node title elements
      expect($("[data-tip]").length).toBe(0);

      // Node titles are rendered cleanly with line-clamp-2
      const nodeTitle = $("div.line-clamp-2").first();
      expect(nodeTitle.length).toBeGreaterThan(0);
      expect(nodeTitle.text().trim()).toBe("Salta");
    });
  });

  describe("CategoryTreeCanvas", () => {
    it("moves drag classes and handlers away from root to inner canvas viewport", () => {
      const html = renderToString(
        React.createElement(CategoryTreeCanvas, {
          rootNode: mockCategoryTree,
          propuestaCNode: mockCategoryTree,
        })
      );
      const $ = cheerio.load(html);

      const root = $("#tree-canvas-container");
      expect(root.length).toBe(1);
      const rootClasses = root.attr("class") || "";
      expect(rootClasses).not.toContain("cursor-grab");
      expect(rootClasses).not.toContain("active:cursor-grabbing");

      // Inner canvas viewport element contains cursor-grab
      const innerViewport = root.find(".cursor-grab");
      expect(innerViewport.length).toBe(1);
      const innerClasses = innerViewport.attr("class") || "";
      expect(innerClasses).toContain("absolute");
      expect(innerClasses).toContain("inset-0");
      expect(innerClasses).toContain("overflow-hidden");
      expect(innerClasses).toContain("active:cursor-grabbing");
    });

    it("renders floating controls with data-floating-control attribute", () => {
      const html = renderToString(
        React.createElement(CategoryTreeCanvas, {
          rootNode: mockCategoryTree,
          propuestaCNode: mockCategoryTree,
        })
      );
      const $ = cheerio.load(html);

      const floatingControls = $("[data-floating-control]");
      expect(floatingControls.length).toBeGreaterThanOrEqual(3);

      // Top Toolbar has data-floating-control
      const toolbar = floatingControls.filter((_, el) => $(el).hasClass("top-3"));
      expect(toolbar.length).toBeGreaterThanOrEqual(1);

      // HUD has data-floating-control
      const hud = floatingControls.filter((_, el) => $(el).hasClass("bottom-3") && $(el).hasClass("left-3"));
      expect(hud.length).toBe(1);

      // FAB has data-floating-control
      const fab = floatingControls.filter((_, el) => $(el).hasClass("bottom-4") && $(el).hasClass("right-4"));
      expect(fab.length).toBe(1);
    });

    it("does not render tooltip class, tooltip-bottom, or data-tip on node card titles", () => {
      const html = renderToString(
        React.createElement(CategoryTreeCanvas, {
          rootNode: mockCategoryTree,
          propuestaCNode: mockCategoryTree,
        })
      );
      const $ = cheerio.load(html);

      // No DaisyUI tooltip classes on cards
      expect($(".tooltip").length).toBe(0);
      expect($(".tooltip-bottom").length).toBe(0);

      // No data-tip attribute on node title elements
      expect($("[data-tip]").length).toBe(0);

      // Node titles are rendered cleanly with line-clamp-2
      const nodeTitle = $("h4.line-clamp-2").first();
      expect(nodeTitle.length).toBeGreaterThan(0);
      expect(nodeTitle.text().trim()).toBe("Hardware y Periféricos");
    });
  });
});
