import { describe, it, expect } from "vitest";

describe("Quality Parameter Comments Mapping & Rendering", () => {
  it("maps comments correctly from audit scores list", () => {
    const mockParameters = [
      { id: 1, code: "saludo", name: "Saludo cordial", section: "items", weight: 10 },
      { id: 2, code: "despedida", name: "Despedida institucional", section: "items", weight: 10 },
      { id: 3, code: "tipificacion", name: "Tipificación correcta", section: "ticket", weight: 20 },
    ];

    const mockScores = [
      { parameterId: 1, score: true, comment: "Excelente tono de voz" },
      { parameterId: 2, score: false, comment: "No mencionó el nombre" },
      { parameterId: 3, score: true, comment: null },
    ];

    const commentsMap: Record<string, string> = {};
    mockScores.forEach((scoreObj) => {
      const param = mockParameters.find((p) => p.id === scoreObj.parameterId);
      if (param && scoreObj.comment && scoreObj.comment.trim()) {
        commentsMap[param.code] = scoreObj.comment.trim();
      }
    });

    expect(commentsMap["saludo"]).toBe("Excelente tono de voz");
    expect(commentsMap["despedida"]).toBe("No mencionó el nombre");
    expect(commentsMap["tipificacion"]).toBeUndefined();
  });
});
