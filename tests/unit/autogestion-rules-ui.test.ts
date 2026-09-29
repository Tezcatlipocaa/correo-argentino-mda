import { describe, it, expect } from "vitest";
import { AUTOGESTION_AUTOMATION_RULES } from "@/lib/autogestion/rulesEngine";

describe("Autogestión UI Documentation - Catálogo documental", () => {
  it("debe contener la lista de reglas activas para el supervisor", () => {
    expect(AUTOGESTION_AUTOMATION_RULES.length).toBeGreaterThan(0);
    const rejectedRule = AUTOGESTION_AUTOMATION_RULES.find((r) => r.id === "solicitud_rechazada");
    expect(rejectedRule).toBeDefined();
    expect(rejectedRule?.status).toBe("active");
  });

  it("la regla de solicitudes rechazadas debe documentar la cadencia de 10 minutos y sus condiciones", () => {
    const rejectedRule = AUTOGESTION_AUTOMATION_RULES.find((r) => r.id === "solicitud_rechazada")!;
    expect(rejectedRule.intervalMinutes).toBe(10);
    expect(rejectedRule.triggerEvent).toContain("10 minutos");

    // Verificar que todas las condiciones requeridas estén presentes
    const conditionLabels = rejectedRule.conditions.map((c) => c.label.toLowerCase());
    expect(conditionLabels.some((l) => l.includes("categoría"))).toBe(true);
    expect(conditionLabels.some((l) => l.includes("creador"))).toBe(true);
    expect(conditionLabels.some((l) => l.includes("disponibilidad"))).toBe(true);
    expect(conditionLabels.some((l) => l.includes("asignable"))).toBe(true);
  });

  it("debe documentar explícitamente la no alteración del turno cíclico (skipQueueUpdate)", () => {
    const rejectedRule = AUTOGESTION_AUTOMATION_RULES.find((r) => r.id === "solicitud_rechazada")!;
    expect(rejectedRule.effect.toLowerCase()).toContain("skipqueueupdate");
  });
});
