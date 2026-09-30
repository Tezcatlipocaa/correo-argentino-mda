import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
vi.mock("@db/index", () => {
  return {
    db: {
      select: vi.fn(),
    },
  };
});

vi.mock("@/lib/invgate/helpdeskMembersCache", () => ({
  getHelpdeskMembers: vi.fn().mockResolvedValue([
    { id: 101, username: "irevainera", fullName: "Ignacio Revainera" },
    { id: 102, username: "daltamirano", fullName: "Altamirano Dario" },
    { id: 103, username: "fgonzalez", fullName: "Franco Gonzalez" },
  ]),
}));

vi.mock("@/lib/wise-cx-presence", async () => {
  const actual = await vi.importActual<any>("@/lib/wise-cx-presence");
  return {
    ...actual,
    getWiseCxPresenceMap: vi.fn().mockResolvedValue([
      {
        fullName: "Ignacio Revainera",
        status: "Devolución Supervisión",
        statusCategory: "disponible", // categorizado por el override
        badgeVariant: "info",
        inCall: false,
      },
      {
        fullName: "Altamirano Dario",
        status: "Devolución Supervisión",
        statusCategory: "disponible",
        badgeVariant: "info",
        inCall: false,
      },
      {
        fullName: "Franco Gonzalez",
        status: "Devolución Supervisión",
        statusCategory: "disponible",
        badgeVariant: "info",
        inCall: false,
      },
    ]),
  };
});

import { db } from "@db/index";
import { getDisponibilidadHoy } from "@lib/disponibilidad";

describe("Disponibilidad Override - Testing Autogestiones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe evaluar a los operadores en Devolución Supervisión (y a los 3 asignados) con disponible = true", async () => {
    const mockAgents = [
      {
        id: 1,
        name: "Ignacio Revainera",
        username: "irevainera@correo.com",
        location: "Monte Grande",
        enCronograma: true,
        asignableAgs: true,
        horarioDefault: "08:00 - 17:00",
        lastAutogestionAssignedAt: null,
      },
      {
        id: 2,
        name: "Altamirano Dario",
        username: "daltamirano@correo.com",
        location: "Monte Grande",
        enCronograma: true,
        asignableAgs: true,
        horarioDefault: "08:00 - 17:00",
        lastAutogestionAssignedAt: null,
      },
      {
        id: 3,
        name: "Franco Gonzalez",
        username: "fgonzalez@correo.com",
        location: "Monte Grande",
        enCronograma: true,
        asignableAgs: true,
        horarioDefault: "08:00 - 17:00",
        lastAutogestionAssignedAt: null,
      },
    ];

    // Mock db.select chained queries
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(mockAgents),
      }),
    });
    // Mock schedules select
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([]),
      }),
    });

    const result = await getDisponibilidadHoy(true);

    expect(result.length).toBe(3);
    for (const op of result) {
      expect(op.disponible).toBe(true);
    }
  });
});
