import { describe, it, expect } from "vitest";
import { classifyWiseCxStatus } from "@/lib/wise-cx-presence";

describe("Wise CX Presence - elegibilidad para autogestiones", () => {
  // El override que forceaba canReceiveAgs en "Devolución Supervisión" se
  // retiró al desplegar las automatizaciones a producción (issue #290): en prod
  // asignaba tickets a supervisores en devolución.
  it("Devolución Supervisión no es elegible para autogestiones", () => {
    const result = classifyWiseCxStatus("Devolución Supervisión", false);
    expect(result.canReceiveAgs).toBe(false);
    expect(result.motivoBloqueo).toBe("Devolución Supervisión");
  });

  it("Invisible y Desconectado siguen bloqueando la asignación", () => {
    expect(classifyWiseCxStatus("Invisible", false).canReceiveAgs).toBe(false);
    expect(classifyWiseCxStatus("Desconectado", false).canReceiveAgs).toBe(false);
  });
});