import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@lib/invgateClient", () => ({
  invgatePost: vi.fn(),
  invgateGet: vi.fn(),
}));

vi.mock("@db/index", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
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
  evaluateRejectedRequestRule,
  executeAutoAssignment,
  evaluateAllAutogestionRules,
  AUTOGESTION_AUTOMATION_RULES,
} from "@/lib/autogestion/rulesEngine";
import { reassignTicketToAgent, addTicketComment, invalidateUnassignedTicketsCache } from "@/lib/invgate/agsTickets";
import { getDisponibilidadHoy } from "@lib/disponibilidad";
import { db } from "@db/index";

describe("Autogestión Automation Rules - Solicitud rechazada en revisión", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTicketRejected = {
    id: 9001,
    pretty_id: "#9001",
    title: "Solicitud de prueba",
    category_id: 10,
    category_name: "Solicitud rechazada en revisión",
    category_last_name: "Solicitud rechazada en revisión",
    creator_id: 501,
    creator_username: "op.mda",
    creator_name: "Operador Mesa",
  };

  const mockAvailableOperator = {
    agentId: 42,
    invgateId: 501,
    nombre: "Operador Mesa",
    username: "op.mda",
    disponible: true,
    asignableAgs: true,
    lastAutogestionAssignedAt: 1700000000,
  };

  it("debe coincidir con la categoría de forma insensible a mayúsculas y acentos", () => {
    const ticketVariations = [
      "Solicitud rechazada en revisión",
      "solicitud rechazada en revision",
      "SOLICITUD RECHAZADA EN REVISIÓN",
      "  Solicitud rechazada en revisión  ",
    ];

    for (const cat of ticketVariations) {
      const ticket = { ...mockTicketRejected, category_name: cat };
      const result = evaluateRejectedRequestRule(ticket as any, [mockAvailableOperator as any]);
      expect(result.matchesCategory).toBe(true);
    }

    const wrongCatTicket = {
      ...mockTicketRejected,
      category_name: "Consulta general",
      category_last_name: "Consulta general",
    };
    const wrongResult = evaluateRejectedRequestRule(wrongCatTicket as any, [mockAvailableOperator as any]);
    expect(wrongResult.matchesCategory).toBe(false);
    expect(wrongResult.canAssign).toBe(false);
  });

  it("debe verificar que el creador pertenezca a la nómina de operadores de MDA", () => {
    // Ticket creado por alguien que NO está en la nómina de operadores
    const ticketExternal = {
      ...mockTicketRejected,
      creator_username: "usuario.externo",
      creator_name: "Usuario Externo",
      creator_id: 9999,
    };

    const result = evaluateRejectedRequestRule(ticketExternal as any, [mockAvailableOperator as any]);
    expect(result.matchesCategory).toBe(true);
    expect(result.isMdaOperator).toBe(false);
    expect(result.canAssign).toBe(false);
    expect(result.reason).toContain("creador");
  });

  it("debe rechazar la autoasignación si el operador de MDA no está disponible o asignable para AGS", () => {
    // Caso 1: En break / no disponible
    const operatorInBreak = {
      ...mockAvailableOperator,
      disponible: false,
      motivo: "En break",
    };

    const res1 = evaluateRejectedRequestRule(mockTicketRejected as any, [operatorInBreak as any]);
    expect(res1.matchesCategory).toBe(true);
    expect(res1.isMdaOperator).toBe(true);
    expect(res1.isOperatorAvailable).toBe(false);
    expect(res1.canAssign).toBe(false);
    expect(res1.reason).toContain("no está disponible");

    // Caso 2: No asignable a AGS (ej. supervisor o mesa no participativa)
    const operatorNotAssignable = {
      ...mockAvailableOperator,
      disponible: true,
      asignableAgs: false,
    };

    const res2 = evaluateRejectedRequestRule(mockTicketRejected as any, [operatorNotAssignable as any]);
    expect(res2.canAssign).toBe(false);
    expect(res2.reason).toContain("asignable");
  });

  it("debe aprobar la asignación cuando cumple categoría, es operador MDA y está disponible", () => {
    const result = evaluateRejectedRequestRule(mockTicketRejected as any, [mockAvailableOperator as any]);
    expect(result.matchesCategory).toBe(true);
    expect(result.isMdaOperator).toBe(true);
    expect(result.isOperatorAvailable).toBe(true);
    expect(result.canAssign).toBe(true);
    expect(result.targetOperator?.agentId).toBe(42);
  });

  it("executeAutoAssignment debe reasignar en InvGate, comentar, registrar en historial y preservar turno cíclico (skipQueueUpdate)", async () => {
    (reassignTicketToAgent as any).mockResolvedValueOnce({ ok: true });
    (addTicketComment as any).mockResolvedValueOnce({ ok: true });

    const evalResult = {
      ruleId: "solicitud_rechazada",
      ticketId: 9001,
      ticketNumber: "#9001",
      matchesCategory: true,
      isMdaOperator: true,
      isOperatorAvailable: true,
      canAssign: true,
      targetOperator: mockAvailableOperator,
    };

    const execRes = await executeAutoAssignment(evalResult as any, "Sistema de Automatizaciones");

    expect(execRes.success).toBe(true);
    // 1. Reasignación en InvGate
    expect(reassignTicketToAgent).toHaveBeenCalledWith(9001, 501, 3950, expect.any(Number));
    // 2. Comentario explicativo
    expect(addTicketComment).toHaveBeenCalledWith(
      9001,
      expect.stringContaining("Asignado automáticamente"),
      expect.any(Number),
      expect.any(Number)
    );
    // 3. Invalida caché
    expect(invalidateUnassignedTicketsCache).toHaveBeenCalled();
    // 4. Historial insertado con tipo 'automatica'
    expect(db.insert).toHaveBeenCalled();
    // 5. Preserva cola cíclica (no debe actualizar lastAutogestionAssignedAt en agents)
    expect(db.update).not.toHaveBeenCalled();
  });

  it("AUTOGESTION_AUTOMATION_RULES debe contener la documentación descriptiva para el tab de supervisión", () => {
    expect(AUTOGESTION_AUTOMATION_RULES).toBeDefined();
    expect(AUTOGESTION_AUTOMATION_RULES.length).toBeGreaterThan(0);

    const ruleDoc = AUTOGESTION_AUTOMATION_RULES.find((r) => r.id === "solicitud_rechazada");
    expect(ruleDoc).toBeDefined();
    expect(ruleDoc?.name).toContain("Rechazada");
    expect(ruleDoc?.intervalMinutes).toBe(10);
    expect(ruleDoc?.status).toBe("active");
    expect(ruleDoc?.conditions.length).toBeGreaterThanOrEqual(3);
  });

  it("evaluateAllAutogestionRules debe filtrar y retornar solo tickets asignables", () => {
    const ticketList = [
      // 1. Cumple regla
      mockTicketRejected,
      // 2. Otra categoría
      {
        id: 9002,
        category_name: "Hardware > Impresoras",
        creator_id: 501,
      },
      // 3. Misma categoría pero creador externo
      {
        id: 9003,
        category_name: "Solicitud rechazada en revisión",
        creator_id: 9999,
      },
    ];

    const results = evaluateAllAutogestionRules(ticketList as any, [mockAvailableOperator as any]);
    expect(results.length).toBe(1);
    expect(results[0].ticketId).toBe(9001);
    expect(results[0].canAssign).toBe(true);
    expect(results[0].targetOperator?.agentId).toBe(42);
  });
});
