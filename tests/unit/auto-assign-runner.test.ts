import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@/lib/invgate/agsTickets", () => ({
  getUnassignedTicketsByHelpdesk: vi.fn(),
  reassignTicketToAgent: vi.fn(),
  addTicketComment: vi.fn(),
  invalidateUnassignedTicketsCache: vi.fn(),
}));

vi.mock("@lib/disponibilidad", () => ({
  getDisponibilidadHoy: vi.fn(),
}));

vi.mock("@db/index", () => ({
  db: {
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

import { runAutoAssignCycle, isAutoAssignCycleRunning } from "@/lib/autogestion/autoAssignRunner";
import { getUnassignedTicketsByHelpdesk, reassignTicketToAgent, addTicketComment } from "@/lib/invgate/agsTickets";
import { getDisponibilidadHoy } from "@lib/disponibilidad";

describe("Auto Assign Runner - Ciclo recurrente de asignación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe procesar tickets coincidentes y reportar estadísticas de asignación", async () => {
    (getUnassignedTicketsByHelpdesk as any).mockResolvedValueOnce({
      ok: true,
      helpdeskId: 3950,
      tickets: [
        {
          id: 7001,
          pretty_id: "#7001",
          category_name: "Solicitud rechazada en revisión",
          creator_id: 101,
          creator_username: "op1",
        },
      ],
    });

    (getDisponibilidadHoy as any).mockResolvedValueOnce([
      {
        agentId: 10,
        invgateId: 101,
        nombre: "Operador Uno",
        username: "op1",
        disponible: true,
        asignableAgs: true,
      },
    ]);

    (reassignTicketToAgent as any).mockResolvedValueOnce({ ok: true });
    (addTicketComment as any).mockResolvedValueOnce({ ok: true });

    const result = await runAutoAssignCycle();

    expect(result.evaluatedCount).toBe(1);
    expect(result.assignedCount).toBe(1);
    expect(result.assignedTickets[0].ticketId).toBe(7001);
    expect(result.assignedTickets[0].assignedTo).toBe("Operador Uno");
  });

  it("debe procesar un lote mixto respetando la precedencia de reglas en el mismo ciclo", async () => {
    (getUnassignedTicketsByHelpdesk as any).mockResolvedValueOnce({
      ok: true,
      helpdeskId: 3950,
      tickets: [
        {
          id: 7002,
          pretty_id: "#7002",
          category_name: "Nueva solicitud",
          creator_id: 9999,
          creator_username: "cliente.externo",
        },
        {
          id: 7003,
          pretty_id: "#7003",
          category_name: "Solicitud rechazada en revisión",
          creator_id: 101,
          creator_username: "op1",
        },
      ],
    });

    (getDisponibilidadHoy as any).mockResolvedValueOnce([
      {
        agentId: 10,
        invgateId: 101,
        nombre: "Operador Uno",
        username: "op1",
        disponible: true,
        asignableAgs: true,
        lastAutogestionAssignedAt: 1000,
      },
      {
        agentId: 20,
        invgateId: 102,
        nombre: "Operador Dos",
        username: "op2",
        disponible: true,
        asignableAgs: true,
        lastAutogestionAssignedAt: null,
      },
    ]);

    (reassignTicketToAgent as any).mockResolvedValue({ ok: true });
    (addTicketComment as any).mockResolvedValue({ ok: true });

    const result = await runAutoAssignCycle();

    expect(result.evaluatedCount).toBe(2);
    expect(result.assignedCount).toBe(2);

    // Debe contener el ticket rechazado asignado a op1
    const rejectedAssigned = result.assignedTickets.find((t) => t.ticketId === 7003);
    expect(rejectedAssigned).toBeDefined();
    expect(rejectedAssigned?.assignedTo).toBe("Operador Uno");
    expect(rejectedAssigned?.ruleId).toBe("solicitud_rechazada");

    // Debe contener el ticket general asignado a op2 (turno cíclico prioritario por null)
    const cyclicAssigned = result.assignedTickets.find((t) => t.ticketId === 7002);
    expect(cyclicAssigned).toBeDefined();
    expect(cyclicAssigned?.assignedTo).toBe("Operador Dos");
    expect(cyclicAssigned?.ruleId).toBe("asignacion_ciclica_general");
  });

  it("debe manejar errores de InvGate sin lanzar excepciones no controladas", async () => {
    (getUnassignedTicketsByHelpdesk as any).mockResolvedValueOnce({
      ok: false,
      helpdeskId: 3950,
      error: "Error de red con InvGate API",
      tickets: [],
    });

    const result = await runAutoAssignCycle();

    expect(result.assignedCount).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("InvGate");
  });

  it("debe evitar ejecuciones concurrentes simultáneas mediante lock en memoria", async () => {
    let resolveFirstPromise: (val: any) => void;
    const longRunningPromise = new Promise((resolve) => {
      resolveFirstPromise = resolve;
    });

    (getUnassignedTicketsByHelpdesk as any).mockImplementationOnce(() => longRunningPromise);

    // Iniciar primer ciclo
    const firstCyclePromise = runAutoAssignCycle();
    expect(isAutoAssignCycleRunning()).toBe(true);

    // Intentar segundo ciclo concurrente
    const secondResult = await runAutoAssignCycle();
    expect(secondResult.skippedDueToLock).toBe(true);
    expect(secondResult.assignedCount).toBe(0);

    // Finalizar el primero
    resolveFirstPromise!({ ok: true, tickets: [] });
    await firstCyclePromise;

    expect(isAutoAssignCycleRunning()).toBe(false);
  });
});
