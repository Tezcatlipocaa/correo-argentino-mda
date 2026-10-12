import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks (misma base que general-cyclic-rule.test.ts / autogestion-rules.test.ts)
vi.mock("@lib/invgateClient", () => ({
  invgatePost: vi.fn(),
  invgateGet: vi.fn(),
}));

vi.mock("@db/index", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("@/lib/invgate/agsTickets", () => ({
  reassignTicketToAgent: vi.fn(),
  addTicketComment: vi.fn(),
  invalidateUnassignedTicketsCache: vi.fn(),
}));

vi.mock("@lib/disponibilidad", () => ({
  getDisponibilidadHoy: vi.fn(),
}));

import {
  evaluateAllAutogestionRules,
  RULE_IDS,
} from "@/lib/autogestion/rulesEngine";

describe("Toggle de automatizaciones AGS - reglas deshabilitadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const opC = {
    agentId: 3,
    invgateId: 103,
    nombre: "Operador C",
    username: "op.c",
    disponible: true,
    asignableAgs: true,
    lastAutogestionAssignedAt: 5000,
  };

  const opD = {
    agentId: 4,
    invgateId: 104,
    nombre: "Operador D",
    username: "op.d",
    disponible: true,
    asignableAgs: true,
    lastAutogestionAssignedAt: 6000,
  };

  const rejectedTicket = {
    id: 8101,
    pretty_id: "#8101",
    title: "Solicitud rechazada previa",
    category_name: "Solicitud rechazada en revisión",
    category_last_name: "Solicitud rechazada en revisión",
    creator_id: 103,
    creator_username: "op.c",
    creator_name: "Operador C",
  };

  const generalTicket = {
    id: 8102,
    pretty_id: "#8102",
    title: "Nueva solicitud de acceso",
    category_name: "Nueva solicitud",
    category_last_name: "Nueva solicitud",
    creator_id: 9901,
    creator_username: "cliente.externo",
    creator_name: "Cliente Externo",
  };

  it("con P1 deshabilitada los tickets generales siguen yendo a la cíclica (sin inanición)", () => {
    const actionable = evaluateAllAutogestionRules(
      [rejectedTicket, generalTicket] as any,
      [opC, opD] as any,
      new Set([RULE_IDS.rejected])
    );

    // El ticket rechazado queda intacto: la cíclica lo descarta por categoría.
    expect(actionable.some((r) => r.ticketId === rejectedTicket.id)).toBe(false);
    // El ticket general sí se asigna por la regla cíclica.
    const cyclic = actionable.find((r) => r.ruleId === RULE_IDS.cyclic);
    expect(cyclic?.ticketId).toBe(generalTicket.id);
    expect(cyclic?.canAssign).toBe(true);
  });

  it("con P2 deshabilitada solo se asignan las solicitudes rechazadas", () => {
    const actionable = evaluateAllAutogestionRules(
      [rejectedTicket, generalTicket] as any,
      [opC, opD] as any,
      new Set([RULE_IDS.cyclic])
    );

    expect(actionable.length).toBe(1);
    expect(actionable[0].ruleId).toBe(RULE_IDS.rejected);
    expect(actionable[0].ticketId).toBe(rejectedTicket.id);
  });

  it("con ambas reglas deshabilitadas no hay nada asignable", () => {
    const actionable = evaluateAllAutogestionRules(
      [rejectedTicket, generalTicket] as any,
      [opC, opD] as any,
      new Set([RULE_IDS.rejected, RULE_IDS.cyclic])
    );

    expect(actionable).toEqual([]);
  });

  it("sin deshabilitar nada se mantienen las dos reglas activas", () => {
    const actionable = evaluateAllAutogestionRules(
      [rejectedTicket, generalTicket] as any,
      [opC, opD] as any
    );

    expect(actionable.length).toBe(2);
    expect(actionable.some((r) => r.ruleId === RULE_IDS.rejected)).toBe(true);
    expect(actionable.some((r) => r.ruleId === RULE_IDS.cyclic)).toBe(true);
  });
});
