import { describe, it, expect } from "vitest";
import { db } from "@db/index";
import { assignmentHistory } from "@db/schema";
import { eq, desc } from "drizzle-orm";

describe("Assignment History Table & Persistence", () => {
  it("debe permitir insertar y consultar un registro de historial de asignación automática en SQLite", async () => {
    const testNow = Date.now();
    const testTicket = `#TEST-${testNow}`;

    const inserted = await db
      .insert(assignmentHistory)
      .values({
        agentId: 99999,
        agentName: "Operador Test",
        ticketNumber: testTicket,
        assignedBy: "Test Suite (automatica)",
        assignedAt: testNow,
        type: "automatica",
      })
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted.length).toBeGreaterThan(0);
    expect(inserted[0].ticketNumber).toBe(testTicket);

    // Consulta de verificación
    const rows = await db
      .select()
      .from(assignmentHistory)
      .where(eq(assignmentHistory.ticketNumber, testTicket));

    expect(rows.length).toBe(1);
    expect(rows[0].agentName).toBe("Operador Test");
    expect(rows[0].type).toBe("automatica");

    // Limpieza de datos de prueba
    await db
      .delete(assignmentHistory)
      .where(eq(assignmentHistory.ticketNumber, testTicket));
  });
});
