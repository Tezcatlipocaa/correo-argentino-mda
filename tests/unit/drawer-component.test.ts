import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import * as cheerio from "cheerio";
import Drawer from "@/components/ui/Drawer";

describe("Drawer reusable component", () => {
  it("renders when open={true} with accessible dialog attributes, title, and body", () => {
    const html = renderToString(
      React.createElement(
        Drawer,
        {
          open: true,
          onClose: () => {},
          title: "Detalle de Oficina",
          subtitle: "Información física y operativa",
        },
        React.createElement("div", { id: "drawer-test-body" }, "Contenido de prueba"),
      ),
    );

    const $ = cheerio.load(html);

    // Dialog accessibility
    const aside = $("aside[role='dialog']");
    expect(aside.length).toBe(1);
    expect(aside.attr("aria-modal")).toBe("true");

    // Title & subtitle
    expect($("h3").text()).toContain("Detalle de Oficina");
    expect(aside.text()).toContain("Información física y operativa");
    expect($("#drawer-test-body").text()).toBe("Contenido de prueba");

    // Open classes: translate-x-0
    expect(aside.attr("class")).toContain("translate-x-0");
  });

  it("applies translate-x-full and hides backdrop when open={false}", () => {
    const html = renderToString(
      React.createElement(
        Drawer,
        {
          open: false,
          onClose: () => {},
          title: "Cerrado",
        },
        "Texto oculto",
      ),
    );

    const $ = cheerio.load(html);
    const aside = $("aside[role='dialog']");
    expect(aside.length).toBe(1);
    expect(aside.attr("class")).toContain("translate-x-full");
    expect(aside.attr("class")).toContain("pointer-events-none");
  });
});
