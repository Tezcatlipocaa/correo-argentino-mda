import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import * as cheerio from "cheerio";
import fs from "node:fs";
import path from "node:path";

vi.mock("@iconify/react", () => ({
  Icon: (props: any) => React.createElement("span", { "data-icon": props.icon, className: props.className }),
}));

import Drawer from "@/components/ui/Drawer";
import ActionButton from "@/components/ui/ActionButton";
import OfficeDetailDrawer from "@/components/oficinas/estructura/OfficeDetailDrawer";
import OfficeTreeCanvas from "@/components/oficinas/estructura/OfficeTreeCanvas";
import type { OfficeTreeNode } from "@/lib/offices/structure-tree";

const dummyTree: OfficeTreeNode = {
  id: "root",
  type: "root",
  name: "Red Postal Nacional",
  totalOffices: 5,
  totalTickets: 30,
  totalTerminals: 20,
  children: [
    {
      id: "reg-CABA",
      type: "region",
      name: "CABA",
      color: "#2563eb",
      totalOffices: 2,
      totalTickets: 10,
      totalTerminals: 5,
      children: [],
    },
    {
      id: "reg-SUR",
      type: "region",
      name: "Región Sur",
      color: "#10b981",
      totalOffices: 3,
      totalTickets: 20,
      totalTerminals: 15,
      children: [],
    },
  ],
};

describe("Challenger M5 Empirical Stress Test Suite", () => {
  describe("Drawer Component Edge Cases & Rendering Matrix", () => {
    it("renders closed Drawer with translate-x-full and proper layout classes", () => {
      const html = renderToString(
        React.createElement(
          Drawer,
          { open: false, onClose: () => {}, title: "Test Closed" },
          React.createElement("p", null, "Child Content"),
        ),
      );
      const $ = cheerio.load(html);
      const aside = $("aside[role='dialog']");
      expect(aside.length).toBe(1);
      expect(aside.attr("class")).toContain("translate-x-full");
      expect(aside.attr("class")).toContain("top-20");
      expect(aside.attr("class")).toContain("h-[calc(100dvh-5rem)]");
    });

    it("renders open Drawer in normal view with translate-x-0 and top-20", () => {
      const html = renderToString(
        React.createElement(
          Drawer,
          { open: true, onClose: () => {}, title: "Test Open Normal", isFullscreen: false },
          React.createElement("p", null, "Child Content"),
        ),
      );
      const $ = cheerio.load(html);
      const aside = $("aside[role='dialog']");
      expect(aside.length).toBe(1);
      expect(aside.attr("class")).toContain("translate-x-0");
      expect(aside.attr("class")).toContain("top-20");
      expect(aside.attr("class")).toContain("h-[calc(100dvh-5rem)]");
    });

    it("renders open Drawer in fullscreen with top-0 h-dvh", () => {
      const html = renderToString(
        React.createElement(
          Drawer,
          { open: true, onClose: () => {}, title: "Test Fullscreen", isFullscreen: true },
          React.createElement("p", null, "Child Content"),
        ),
      );
      const $ = cheerio.load(html);
      const aside = $("aside[role='dialog']");
      expect(aside.length).toBe(1);
      expect(aside.attr("class")).toContain("translate-x-0");
      expect(aside.attr("class")).toContain("top-0");
      expect(aside.attr("class")).toContain("h-dvh");
      expect(aside.attr("class")).not.toContain("top-20");
    });

    it("verifies size prop mapping (sm -> max-w-xs, md -> max-w-md, lg -> max-w-xl, xl -> max-w-2xl)", () => {
      const sizes = {
        sm: "max-w-xs",
        md: "max-w-md",
        lg: "max-w-xl",
        xl: "max-w-2xl",
      } as const;

      for (const [sizeKey, expectedClass] of Object.entries(sizes)) {
        const html = renderToString(
          React.createElement(
            Drawer,
            { open: true, onClose: () => {}, size: sizeKey as any },
            "Content",
          ),
        );
        const $ = cheerio.load(html);
        const aside = $("aside[role='dialog']");
        expect(aside.attr("class")).toContain(expectedClass);
      }
    });

    it("verifies PROJECT.md contract compliance: maxWidth prop is supported on Drawer", () => {
      const html = renderToString(
        React.createElement(
          Drawer,
          { open: true, onClose: () => {}, maxWidth: "xl" },
          "Content",
        ),
      );
      const $ = cheerio.load(html);
      const aside = $("aside[role='dialog']");
      expect(aside.attr("class")).toContain("max-w-2xl");
    });
  });

  describe("OfficeDetailDrawer Lifecycle Disparity Analysis", () => {
    it("empirically reproduces the unmounted drawer when node=null", () => {
      // When node is null, OfficeDetailDrawer returns null
      const htmlNull = renderToString(
        React.createElement(OfficeDetailDrawer, {
          node: null,
          open: false,
          onClose: () => {},
        }),
      );
      expect(htmlNull).toBe(""); // Proves that aside[role='dialog'] is absent in DOM!

      // When node is provided, aside is present
      const htmlWithNode = renderToString(
        React.createElement(OfficeDetailDrawer, {
          node: dummyTree.children![0],
          open: false,
          onClose: () => {},
        }),
      );
      const $ = cheerio.load(htmlWithNode);
      expect($("aside[role='dialog']").length).toBe(1);
    });
  });

  describe("Absence of Tooltips & Title Attributes in Node Cards", () => {
    it("verifies OfficeTreeCanvas renders node names without tooltip, data-tip, or title", () => {
      const html = renderToString(
        React.createElement(OfficeTreeCanvas, {
          rootNode: dummyTree,
        }),
      );
      const $ = cheerio.load(html);

      // Check all rendered node cards
      const nodeCards = $("[data-node-id]");
      expect(nodeCards.length).toBeGreaterThan(0);

      nodeCards.each((_, el) => {
        const card = $(el);
        expect(card.find(".tooltip").length).toBe(0);
        expect(card.find("[data-tip]").length).toBe(0);
        // Verify node title container does not have title attribute
        const titleDiv = card.find(".line-clamp-2");
        expect(titleDiv.attr("title")).toBeUndefined();
      });
    });
  });

  describe("Boxicons Static Verification against icons.json", () => {
    it("ensures zero invalid Boxicons exist anywhere in src/", () => {
      const iconsJsonPath = path.resolve(process.cwd(), "node_modules/@iconify-json/boxicons/icons.json");
      const iconsData = JSON.parse(fs.readFileSync(iconsJsonPath, "utf-8"));
      const valid = new Set([...Object.keys(iconsData.icons || {}), ...Object.keys(iconsData.aliases || {})]);

      function scan(dir: string): string[] {
        let res: string[] = [];
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) res.push(...scan(p));
          else if (/\.(astro|tsx|ts|jsx|js)$/.test(e.name)) res.push(p);
        }
        return res;
      }

      const files = scan(path.resolve(process.cwd(), "src"));
      const invalid: Array<{ file: string; line: number; icon: string }> = [];

      for (const f of files) {
        const content = fs.readFileSync(f, "utf-8");
        content.split("\n").forEach((line, idx) => {
          const re = /boxicons:([a-z0-9-]+)/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(line)) !== null) {
            if (!valid.has(m[1])) {
              invalid.push({ file: path.relative(process.cwd(), f), line: idx + 1, icon: m[1] });
            }
          }
        });
      }

      expect(invalid).toEqual([]);
    });
  });
});
