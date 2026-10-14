import { describe, expect, it } from "vitest";
import { groupByAgentId } from "../../src/lib/cronograma/payload";

describe("groupByAgentId", () => {
  it("agrupa filas por agentId y descarta agentes nulos", () => {
    const rows = [
      { id: 1, agentId: 7, date: "2026-10-01" },
      { id: 2, agentId: 7, date: "2026-10-02" },
      { id: 3, agentId: 9, date: "2026-10-01" },
      { id: 4, agentId: null, date: "2026-10-03" },
    ];
    const map = groupByAgentId(rows);
    expect(map.get(7)?.map((r) => r.id)).toEqual([1, 2]);
    expect(map.get(9)?.map((r) => r.id)).toEqual([3]);
    expect(map.size).toBe(2);
  });

  it("devuelve Map vacío para entrada vacía", () => {
    expect(groupByAgentId([]).size).toBe(0);
  });
});
