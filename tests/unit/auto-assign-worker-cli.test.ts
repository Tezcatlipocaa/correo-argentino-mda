import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock runner
vi.mock("../../src/lib/autogestion/autoAssignRunner", () => ({
  runAutoAssignCycle: vi.fn().mockResolvedValue({
    evaluatedCount: 5,
    assignedCount: 2,
    assignedTickets: [
      { ticketId: 101, ticketNumber: "#101", assignedTo: "Operador A", ruleId: "regla_1" }
    ],
    errors: [],
  }),
}));

import { main, runSingleIteration } from "../../scripts/auto-assign-worker";
import { runAutoAssignCycle } from "../../src/lib/autogestion/autoAssignRunner";

describe("Auto-Assign Worker CLI & Single Iteration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe ejecutar una única iteración con el flag --once sin entrar en bucle", async () => {
    const res = await main(["node", "auto-assign-worker.ts", "--once"]);

    expect(runAutoAssignCycle).toHaveBeenCalledWith("Manual CLI (--once)");
    expect(res).toBeDefined();
    expect(res?.assignedCount).toBe(2);
    expect(res?.evaluatedCount).toBe(5);
  });

  it("runSingleIteration debe invocar runAutoAssignCycle y devolver el resultado", async () => {
    const res = await runSingleIteration("Test Unitario");

    expect(runAutoAssignCycle).toHaveBeenCalledWith("Test Unitario");
    expect(res.assignedCount).toBe(2);
  });
});
