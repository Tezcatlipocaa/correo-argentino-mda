import { describe, expect, test } from "vitest";
import { readChartTokens } from "@lib/chartTokens";

describe("readChartTokens", () => {
  test("mapea los tokens semánticos de DaisyUI en orden y recorta espacios", () => {
    const vars: Record<string, string> = {
      "--color-primary": " #4f46e5 ",
      "--color-secondary": "#0d9488",
      "--color-accent": "#d97706",
      "--color-info": "#0284c7",
      "--color-success": "#16a34a",
      "--color-warning": "#ca8a04",
      "--color-error": "#dc2626",
      "--color-neutral": "#475569",
      "--color-base-content": "#1e293b",
      "--color-base-300": "#cbd5e1",
    };
    const tokens = readChartTokens((name) => vars[name] ?? "");
    expect(tokens.palette).toEqual([
      "#4f46e5",
      "#0d9488",
      "#d97706",
      "#0284c7",
      "#16a34a",
      "#ca8a04",
      "#dc2626",
      "#475569",
    ]);
    expect(tokens.text).toBe("#1e293b");
    expect(tokens.grid).toBe("#cbd5e1");
  });

  test("usa fallback cuando la variable falta o viene vacía", () => {
    const tokens = readChartTokens(() => "");
    expect(tokens.palette).toHaveLength(8);
    expect(tokens.palette.every((c) => c === "#6b7280")).toBe(true);
    expect(tokens.text).toBe("#6b7280");
    expect(tokens.grid).toBe("#6b7280");
  });
});
