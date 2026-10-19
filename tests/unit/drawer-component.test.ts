import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import * as cheerio from "cheerio";

vi.mock("@iconify/react", () => ({
  Icon: (props: any) => React.createElement("span", { "data-icon": props.icon }),
}));

import Drawer from "@/components/ui/Drawer";

const internals =
  (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ||
  (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

describe("Drawer reusable component (Tiers 1 & 2)", () => {
  // Helper to execute Drawer with a mocked DOM and executed useEffect
  function renderDrawerWithDOM(props: React.ComponentProps<typeof Drawer>) {
    const originalWindow = global.window;
    const originalDocument = global.document;

    const mockMain = { style: { overflow: "auto" } };
    const mockBody = { style: { overflow: "" } };
    const windowListeners: Record<string, ((e: any) => void)[]> = {};

    const mockWindow = {
      addEventListener: vi.fn((type: string, cb: any) => {
        windowListeners[type] = windowListeners[type] || [];
        windowListeners[type].push(cb);
      }),
      removeEventListener: vi.fn((type: string, cb: any) => {
        windowListeners[type] = (windowListeners[type] || []).filter((fn) => fn !== cb);
      }),
    };

    const mockDocument = {
      querySelector: vi.fn((sel: string) => (sel === "main" ? mockMain : null)),
      body: mockBody,
      fullscreenElement: null,
    };

    global.window = mockWindow as any;
    global.document = mockDocument as any;

    const cleanups: (() => void)[] = [];
    let capturedTree: any = null;

    function TestHost() {
      if (internals?.H) {
        internals.H.useEffect = (effect: () => any) => {
          const cleanup = effect();
          if (typeof cleanup === "function") cleanups.push(cleanup);
        };
      }
      const tree = (Drawer as any)(props);
      capturedTree = tree;
      return tree;
    }

    const html = renderToString(React.createElement(TestHost));
    const $ = cheerio.load(html);

    return {
      $,
      html,
      capturedTree,
      mockMain,
      mockBody,
      mockWindow,
      windowListeners,
      cleanups,
      cleanup: () => {
        cleanups.forEach((fn) => fn());
        global.window = originalWindow;
        global.document = originalDocument;
      },
    };
  }

  describe("Tier 1: Feature Coverage", () => {
    it("renders normal view classes: top-20 h-[calc(100dvh-5rem)] on aside and top-20 on backdrop", () => {
      const { $, cleanup } = renderDrawerWithDOM({
        open: true,
        onClose: () => {},
        title: "Normal Drawer",
        isFullscreen: false,
        children: React.createElement("p", null, "Normal content"),
      });

      const aside = $("aside[role='dialog']");
      expect(aside.length).toBe(1);
      expect(aside.attr("class")).toContain("top-20");
      expect(aside.attr("class")).toContain("h-[calc(100dvh-5rem)]");
      expect(aside.attr("class")).toContain("translate-x-0");
      expect(aside.attr("data-drawer-root")).toBeDefined();

      const backdrop = $("div[aria-hidden='true']");
      expect(backdrop.length).toBe(1);
      expect(backdrop.attr("class")).toContain("top-20");
      expect(backdrop.attr("class")).toContain("visible");

      cleanup();
    });

    it("renders fullscreen view classes: top-0 h-dvh on aside and top-0 on backdrop when isFullscreen={true}", () => {
      const { $, cleanup } = renderDrawerWithDOM({
        open: true,
        onClose: () => {},
        title: "Fullscreen Drawer",
        isFullscreen: true,
        children: React.createElement("p", null, "Fullscreen content"),
      });

      const aside = $("aside[role='dialog']");
      expect(aside.length).toBe(1);
      expect(aside.attr("class")).toContain("top-0");
      expect(aside.attr("class")).toContain("h-dvh");
      expect(aside.attr("data-drawer-root")).toBeDefined();

      const backdrop = $("div[aria-hidden='true']");
      expect(backdrop.length).toBe(1);
      expect(backdrop.attr("class")).toContain("top-0");

      cleanup();
    });

    it("hides aside (translate-x-full) and backdrop when open={false}", () => {
      const { $, cleanup } = renderDrawerWithDOM({
        open: false,
        onClose: () => {},
        title: "Closed Drawer",
        children: "Closed content",
      });

      const aside = $("aside[role='dialog']");
      expect(aside.length).toBe(1);
      expect(aside.attr("class")).toContain("translate-x-full");
      expect(aside.attr("class")).toContain("pointer-events-none");

      const backdrop = $("div[aria-hidden='true']");
      expect(backdrop.attr("class")).toContain("invisible");
      expect(backdrop.attr("class")).toContain("opacity-0");

      cleanup();
    });

    it("scroll lock: sets overflow: hidden on <main> and document.body when open={true} and restores when closed", () => {
      const harness = renderDrawerWithDOM({
        open: true,
        onClose: () => {},
        title: "Scroll Lock Test",
        children: "Lock content",
      });

      // Assert locked
      expect(harness.mockMain.style.overflow).toBe("hidden");
      expect(harness.mockBody.style.overflow).toBe("hidden");

      // Trigger cleanup (simulating unmount/close)
      harness.cleanup();

      // Assert restored to initial values
      expect(harness.mockMain.style.overflow).toBe("auto");
      expect(harness.mockBody.style.overflow).toBe("");
    });
  });

  describe("Tier 2: Boundary & Corner Cases", () => {
    it("dynamically switches classes between normal and fullscreen modes", () => {
      // 1. Normal mode
      const normal = renderDrawerWithDOM({
        open: true,
        onClose: () => {},
        isFullscreen: false,
        children: "Content",
      });
      expect(normal.$("aside[role='dialog']").attr("class")).toContain("top-20");
      expect(normal.$("aside[role='dialog']").attr("class")).toContain("h-[calc(100dvh-5rem)]");
      expect(normal.$("div[aria-hidden='true']").attr("class")).toContain("top-20");
      normal.cleanup();

      // 2. Switch to Fullscreen
      const fullscreen = renderDrawerWithDOM({
        open: true,
        onClose: () => {},
        isFullscreen: true,
        children: "Content",
      });
      expect(fullscreen.$("aside[role='dialog']").attr("class")).toContain("top-0");
      expect(fullscreen.$("aside[role='dialog']").attr("class")).toContain("h-dvh");
      expect(fullscreen.$("div[aria-hidden='true']").attr("class")).toContain("top-0");
      fullscreen.cleanup();

      // 3. Switch back to Normal
      const backToNormal = renderDrawerWithDOM({
        open: true,
        onClose: () => {},
        isFullscreen: false,
        children: "Content",
      });
      expect(backToNormal.$("aside[role='dialog']").attr("class")).toContain("top-20");
      expect(backToNormal.$("aside[role='dialog']").attr("class")).toContain("h-[calc(100dvh-5rem)]");
      backToNormal.cleanup();
    });

    it("closes via Escape keydown event when open={true}", () => {
      const onCloseSpy = vi.fn();
      const harness = renderDrawerWithDOM({
        open: true,
        onClose: onCloseSpy,
        children: "Content",
      });

      expect(harness.windowListeners["keydown"]).toBeDefined();
      expect(harness.windowListeners["keydown"].length).toBeGreaterThan(0);

      const handler = harness.windowListeners["keydown"][0];

      // Non-escape key should do nothing
      handler({ key: "Enter" });
      expect(onCloseSpy).not.toHaveBeenCalled();

      // Escape key should call onClose
      handler({ key: "Escape" });
      expect(onCloseSpy).toHaveBeenCalledTimes(1);

      harness.cleanup();
    });

    it("does not trigger onClose on Escape when open={false}", () => {
      const onCloseSpy = vi.fn();
      const harness = renderDrawerWithDOM({
        open: false,
        onClose: onCloseSpy,
        children: "Content",
      });

      // When closed, window listener for Escape shouldn't be added or triggered
      const handler = harness.windowListeners["keydown"]?.[0];
      if (handler) {
        handler({ key: "Escape" });
      }
      expect(onCloseSpy).not.toHaveBeenCalled();

      harness.cleanup();
    });

    it("backdrop element is wired to trigger onClose on click", () => {
      const onCloseSpy = vi.fn();
      const harness = renderDrawerWithDOM({
        open: true,
        onClose: onCloseSpy,
        children: "Backdrop click content",
      });

      const children = React.Children.toArray(harness.capturedTree.props.children);
      const backdropElement = children.find(
        (child: any) => child?.props?.["aria-hidden"] === "true",
      ) as React.ReactElement<any>;

      expect(backdropElement).toBeDefined();
      expect(typeof backdropElement.props.onClick).toBe("function");

      // Execute backdrop click
      backdropElement.props.onClick();
      expect(onCloseSpy).toHaveBeenCalledTimes(1);

      harness.cleanup();
    });

    it("stops propagation on wheel, pointerdown, mousedown, and touchstart to isolate canvas events", () => {
      const harness = renderDrawerWithDOM({
        open: true,
        onClose: () => {},
        children: "Event Isolation",
      });

      const children = React.Children.toArray(harness.capturedTree.props.children);
      const asideElement = children.find(
        (child: any) => child?.type === "aside",
      ) as React.ReactElement<any>;

      expect(asideElement).toBeDefined();

      expect(
        typeof asideElement.props.onWheel,
        "Drawer aside must provide onWheel handler to stop propagation (F4)",
      ).toBe("function");
      expect(
        typeof asideElement.props.onPointerDown,
        "Drawer aside must provide onPointerDown handler (F4)",
      ).toBe("function");
      expect(
        typeof asideElement.props.onMouseDown,
        "Drawer aside must provide onMouseDown handler (F4)",
      ).toBe("function");
      expect(
        typeof asideElement.props.onTouchStart,
        "Drawer aside must provide onTouchStart handler (F4)",
      ).toBe("function");

      const stopPropagationMock = vi.fn();
      const fakeEvent = { stopPropagation: stopPropagationMock };

      asideElement.props.onWheel?.(fakeEvent);
      expect(stopPropagationMock).toHaveBeenCalledTimes(1);

      asideElement.props.onPointerDown?.(fakeEvent);
      expect(stopPropagationMock).toHaveBeenCalledTimes(2);

      asideElement.props.onMouseDown?.(fakeEvent);
      expect(stopPropagationMock).toHaveBeenCalledTimes(3);

      asideElement.props.onTouchStart?.(fakeEvent);
      expect(stopPropagationMock).toHaveBeenCalledTimes(4);

      harness.cleanup();
    });

    it("supports maxWidth prop and size prop with correct classes and precedence", () => {
      // 1. Default size is md (max-w-md)
      const defaultDrawer = renderDrawerWithDOM({
        open: true,
        onClose: () => {},
        children: "Default size",
      });
      expect(defaultDrawer.$("aside[role='dialog']").attr("class")).toContain("max-w-md");
      defaultDrawer.cleanup();

      // 2. size prop mapping
      const sizeMappings = [
        { size: "sm" as const, expected: "max-w-xs" },
        { size: "md" as const, expected: "max-w-md" },
        { size: "lg" as const, expected: "max-w-xl" },
        { size: "xl" as const, expected: "max-w-2xl" },
      ];
      for (const { size, expected } of sizeMappings) {
        const d = renderDrawerWithDOM({
          open: true,
          onClose: () => {},
          size,
          children: "Content",
        });
        expect(d.$("aside[role='dialog']").attr("class")).toContain(expected);
        d.cleanup();
      }

      // 3. maxWidth prop mapping
      const maxWidthMappings = [
        { maxWidth: "sm" as const, expected: "max-w-xs" },
        { maxWidth: "md" as const, expected: "max-w-md" },
        { maxWidth: "lg" as const, expected: "max-w-xl" },
        { maxWidth: "xl" as const, expected: "max-w-2xl" },
        { maxWidth: "2xl" as const, expected: "max-w-2xl" },
      ];
      for (const { maxWidth, expected } of maxWidthMappings) {
        const d = renderDrawerWithDOM({
          open: true,
          onClose: () => {},
          maxWidth,
          children: "Content",
        });
        expect(d.$("aside[role='dialog']").attr("class")).toContain(expected);
        d.cleanup();
      }

      // 4. maxWidth precedence over size
      const precedenceDrawer = renderDrawerWithDOM({
        open: true,
        onClose: () => {},
        size: "sm",
        maxWidth: "2xl",
        children: "Precedence",
      });
      expect(precedenceDrawer.$("aside[role='dialog']").attr("class")).toContain("max-w-2xl");
      expect(precedenceDrawer.$("aside[role='dialog']").attr("class")).not.toContain("max-w-xs");
      precedenceDrawer.cleanup();
    });
  });
});
