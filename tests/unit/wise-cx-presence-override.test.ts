import { describe, it, expect } from "vitest";
import { classifyWiseCxStatus } from "@/lib/wise-cx-presence";

describe("Wise CX Presence Override - Testing Autogestiones", () => {
  it("debe permitir que 'Devolución Supervisión' reciba autogestiones temporalmente para testing", () => {
    const result = classifyWiseCxStatus("Devolución Supervisión", false);
    // Actualmente canReceiveAgs es false. Con el override temporal debe ser true.
    expect(result.canReceiveAgs).toBe(true);
  });
});
