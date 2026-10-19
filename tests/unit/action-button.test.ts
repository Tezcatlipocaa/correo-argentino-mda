import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import * as cheerio from "cheerio";

vi.mock("@iconify/react", () => ({
  Icon: (props: any) => React.createElement("span", { "data-icon": props.icon }),
}));

import ActionButton from "@/components/ui/ActionButton";

describe("ActionButton React component (Tier 1 & Feature F8)", () => {
  function renderButton(props: any) {
    const html = renderToString(React.createElement(ActionButton, props));
    const $ = cheerio.load(html);
    const element = $("button, a").first();
    return { $, html, element };
  }

  it("renders with variant='solid' using color token without soft/outline/ghost classes", () => {
    const { element } = renderButton({
      label: "Solid Action",
      variant: "solid",
      color: "btn-secondary",
    });

    const classes = element.attr("class") || "";
    expect(classes).toContain("btn");
    expect(classes).toContain("btn-secondary");
    expect(classes).not.toContain("btn-soft");
    expect(classes).not.toContain("btn-outline");
    expect(classes).not.toContain("btn-ghost");
  });

  it("renders with variant='soft' applying btn-soft with color token", () => {
    const { element } = renderButton({
      label: "Soft Action",
      variant: "soft",
      color: "btn-secondary",
    });

    const classes = element.attr("class") || "";
    expect(classes).toContain("btn-soft");
    expect(classes).toContain("btn-secondary");
    expect(classes).not.toContain("btn-outline");
    expect(classes).not.toContain("btn-ghost");
  });

  it("renders with variant='outline' applying btn-outline with color token", () => {
    const { element } = renderButton({
      label: "Outline Action",
      variant: "outline",
      color: "btn-secondary",
    });

    const classes = element.attr("class") || "";
    expect(classes).toContain("btn-outline");
    expect(classes).toContain("btn-secondary");
    expect(classes).not.toContain("btn-soft");
    expect(classes).not.toContain("btn-ghost");
  });

  it("renders with variant='ghost' applying btn-ghost", () => {
    const { element } = renderButton({
      label: "Ghost Action",
      variant: "ghost",
    });

    const classes = element.attr("class") || "";
    expect(classes).toContain("btn-ghost");
    expect(classes).not.toContain("btn-soft");
    expect(classes).not.toContain("btn-outline");
  });

  it("maintains backward compatibility with ghost={true} prop overriding variant", () => {
    const { element } = renderButton({
      label: "Forced Ghost",
      variant: "solid",
      ghost: true,
    });

    const classes = element.attr("class") || "";
    expect(classes).toContain("btn-ghost");
    expect(classes).not.toContain("btn-soft");
    expect(classes).not.toContain("btn-outline");
  });

  it("supports custom semantic color tokens across variants", () => {
    const primary = renderButton({
      label: "Primary Solid",
      variant: "solid",
      color: "btn-primary",
    });
    expect(primary.element.attr("class")).toContain("btn-primary");

    const infoOutline = renderButton({
      label: "Info Outline",
      variant: "outline",
      color: "btn-info",
    });
    expect(infoOutline.element.attr("class")).toContain("btn-outline");
    expect(infoOutline.element.attr("class")).toContain("btn-info");
  });

  it("renders an anchor tag when href is provided, and button otherwise", () => {
    const link = renderButton({
      label: "Link Action",
      href: "/oficinas",
    });
    expect(link.element.is("a")).toBe(true);
    expect(link.element.attr("href")).toBe("/oficinas");

    const button = renderButton({
      label: "Standard Button",
    });
    expect(button.element.is("button")).toBe(true);
  });

  it("passes disabled state and attributes correctly", () => {
    const disabledBtn = renderButton({
      label: "Disabled Button",
      disabled: true,
    });

    expect(disabledBtn.element.attr("disabled")).toBeDefined();
  });
});
