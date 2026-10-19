import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import * as cheerio from "cheerio";

vi.mock("@iconify/react", () => ({
  Icon: (props: any) => React.createElement("span", { "data-icon": props.icon }),
}));

import ActionButton from "@/components/ui/ActionButton";

describe("ActionButton Stress & Adversarial Test Suite", () => {
  function render(props: any) {
    const html = renderToString(React.createElement(ActionButton, props));
    const $ = cheerio.load(html);
    const element = $("button, a").first();
    const classList = (element.attr("class") || "").split(/\s+/).filter(Boolean);
    return { $, html, element, classList };
  }

  describe("Variant & Color Matrix", () => {
    const variants = ["solid", "soft", "outline", "ghost"] as const;
    const colors = [
      "btn-primary",
      "btn-secondary",
      "btn-accent",
      "btn-neutral",
      "btn-info",
      "btn-success",
      "btn-warning",
      "btn-error",
    ];

    for (const v of variants) {
      for (const c of colors) {
        it(`evaluates variant='${v}' with color='${c}'`, () => {
          const { classList } = render({
            label: "Test",
            variant: v,
            color: c,
          });

          expect(classList).toContain("btn");

          if (v === "solid") {
            expect(classList).toContain(c);
            expect(classList).not.toContain("btn-soft");
            expect(classList).not.toContain("btn-outline");
            expect(classList).not.toContain("btn-ghost");
          } else if (v === "soft") {
            expect(classList).toContain("btn-soft");
            expect(classList).toContain(c);
            expect(classList).not.toContain("btn-outline");
            expect(classList).not.toContain("btn-ghost");
          } else if (v === "outline") {
            expect(classList).toContain("btn-outline");
            expect(classList).toContain(c);
            expect(classList).not.toContain("btn-soft");
            expect(classList).not.toContain("btn-ghost");
          } else if (v === "ghost") {
            expect(classList).toContain("btn-ghost");
            expect(classList).not.toContain("btn-soft");
            expect(classList).not.toContain("btn-outline");
            // In ghost variant, color should NOT be attached
            expect(classList).not.toContain(c);
          }
        });
      }
    }
  });

  describe("Precedence & Flag Conflicts (Adversarial inputs)", () => {
    it("ghost={true} unconditionally overrides variant='solid'", () => {
      const { classList } = render({
        label: "Conflicted",
        variant: "solid",
        color: "btn-primary",
        ghost: true,
      });
      expect(classList).toContain("btn-ghost");
      expect(classList).not.toContain("btn-primary");
      expect(classList).not.toContain("btn-soft");
      expect(classList).not.toContain("btn-outline");
    });

    it("ghost={true} unconditionally overrides variant='soft'", () => {
      const { classList } = render({
        label: "Conflicted",
        variant: "soft",
        color: "btn-accent",
        ghost: true,
      });
      expect(classList).toContain("btn-ghost");
      expect(classList).not.toContain("btn-accent");
      expect(classList).not.toContain("btn-soft");
    });

    it("ghost={true} unconditionally overrides variant='outline'", () => {
      const { classList } = render({
        label: "Conflicted",
        variant: "outline",
        color: "btn-info",
        ghost: true,
      });
      expect(classList).toContain("btn-ghost");
      expect(classList).not.toContain("btn-info");
      expect(classList).not.toContain("btn-outline");
    });

    it("ghost={true} unconditionally overrides outline={true}", () => {
      const { classList } = render({
        label: "Double legacy flags",
        ghost: true,
        outline: true,
        color: "btn-warning",
      });
      expect(classList).toContain("btn-ghost");
      expect(classList).not.toContain("btn-outline");
      expect(classList).not.toContain("btn-warning");
    });

    it("variant takes precedence over outline={true} when variant is explicitly set", () => {
      const { classList } = render({
        label: "Explicit variant vs outline",
        variant: "soft",
        outline: true,
        color: "btn-secondary",
      });
      expect(classList).toContain("btn-soft");
      expect(classList).toContain("btn-secondary");
      expect(classList).not.toContain("btn-outline");
    });

    it("variant='solid' takes precedence over outline={true}", () => {
      const { classList } = render({
        label: "Solid vs outline",
        variant: "solid",
        outline: true,
        color: "btn-secondary",
      });
      expect(classList).toContain("btn-secondary");
      expect(classList).not.toContain("btn-outline");
    });

    it("outline={true} acts as fallback when variant is undefined", () => {
      const { classList } = render({
        label: "Outline fallback",
        outline: true,
        color: "btn-error",
      });
      expect(classList).toContain("btn-outline");
      expect(classList).toContain("btn-error");
    });

    it("defaults to solid with btn-secondary when no variant or color specified", () => {
      const { classList } = render({
        label: "Default button",
      });
      expect(classList).toContain("btn");
      expect(classList).toContain("btn-secondary");
      expect(classList).not.toContain("btn-soft");
      expect(classList).not.toContain("btn-outline");
      expect(classList).not.toContain("btn-ghost");
    });
  });

  describe("Sizes, States, and Attributes", () => {
    it("handles all sizes correctly", () => {
      const xs = render({ label: "xs", size: "xs" });
      expect(xs.classList).toContain("btn-xs");

      const sm = render({ label: "sm", size: "sm" });
      expect(sm.classList).toContain("btn-sm");

      const md = render({ label: "md", size: "md" });
      expect(md.element.attr("class")).toContain("btn-sm md:btn-md");

      const def = render({ label: "default" });
      expect(def.element.attr("class")).toContain("btn-sm md:btn-md");
    });

    it("applies active state correctly", () => {
      const active = render({ label: "Active", active: true });
      expect(active.classList).toContain("btn-active");

      const inactive = render({ label: "Inactive", active: false });
      expect(inactive.classList).not.toContain("btn-active");
    });

    it("preserves custom className and handles classes cleanly", () => {
      const btn = render({
        label: "Custom",
        className: "my-custom-btn shadow-lg",
      });
      expect(btn.classList).toContain("my-custom-btn");
      expect(btn.classList).toContain("shadow-lg");
      // Note: when active is false, template literal produces consecutive spaces ('btn-secondary  gap-2')
      // Browsers normalize class lists, but classList parsed cleanly:
      expect(btn.classList).toContain("gap-2");
      expect(btn.classList).toContain("btn-secondary");
    });

    it("handles empty or whitespace-only color token gracefully", () => {
      const btn = render({
        label: "Empty Color",
        color: "",
        variant: "soft",
      });
      expect(btn.classList).toContain("btn-soft");
    });

    it("handles responsive labels (shortLabel vs label)", () => {
      const { element } = render({
        label: "Full Label Text",
        shortLabel: "Short",
        labelId: "btn-test-id",
      });

      const shortSpan = element.find(".inline.xl\\:hidden");
      expect(shortSpan.text()).toBe("Short");

      const fullSpan = element.find("#btn-test-id");
      expect(fullSpan.text()).toBe("Full Label Text");
      expect(fullSpan.hasClass("hidden")).toBe(true);
      expect(fullSpan.hasClass("xl:inline")).toBe(true);
    });
  });
});
