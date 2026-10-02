import { describe, expect, it } from "vitest";
import {
  buildCronogramaSvg,
  CELL_W,
  LEGEND_H,
  NAME_W,
  PAD,
  ROW_H,
  TITLE_H,
  HEADER_H,
} from "../../src/components/cronograma/lib/exportSvg";
import { OperatorStatus } from "../../src/components/cronograma/lib/types";

function op(nombre: string, asistencia: Record<string, OperatorStatus>, comentarios: Record<string, string> = {}) {
  return { nombre, location: "Monte Grande", asistencia, comentarios };
}

describe("buildCronogramaSvg", () => {
  it("genera una columna por fecha y una fila por operador con el tamaño exacto", () => {
    const dates = ["2026-09-01", "2026-09-02", "2026-09-03"];
    const operators = [
      op("Ana", { "2026-09-01": OperatorStatus.HomeOffice }),
      op("Beto", { "2026-09-02": OperatorStatus.Licencia }),
    ];
    const result = buildCronogramaSvg({ monthLabel: "septiembre de 2026", dates, operators });
    const expectedWidth = PAD * 2 + NAME_W + dates.length * CELL_W;
    const expectedHeight = PAD * 2 + TITLE_H + HEADER_H + operators.length * ROW_H + LEGEND_H;
    expect(result.width).toBe(expectedWidth);
    expect(result.height).toBe(expectedHeight);
    expect(result.svg).toContain(`width="${expectedWidth}"`);
    expect(result.svg).toContain(`height="${expectedHeight}"`);
  });

  it("usa el color de fondo definido para cada estado presente", () => {
    const dates = ["2026-09-01", "2026-09-02", "2026-09-03"];
    const operators = [
      op("Ana", {
        "2026-09-01": OperatorStatus.PresencialMonteGrande,
        "2026-09-02": OperatorStatus.HomeOffice,
        "2026-09-03": OperatorStatus.Vacaciones,
      }),
    ];
    const { svg } = buildCronogramaSvg({ monthLabel: "septiembre de 2026", dates, operators });
    expect(svg).toContain('fill="#fff8e6"');
    expect(svg).toContain('fill="#e8effe"');
    expect(svg).toContain('fill="#def7ec"');
  });

  it("escapa caracteres XML en nombres y notas", () => {
    const dates = ["2026-09-01"];
    const operators = [op('Ana & <b>"x"', { "2026-09-01": OperatorStatus.Franco }, { "2026-09-01": "<nota>" })];
    const { svg } = buildCronogramaSvg({ monthLabel: "septiembre de 2026", dates, operators });
    expect(svg).toContain("Ana &amp; &lt;b&gt;");
    expect(svg).not.toContain("<b>");
  });

  it("marca con un punto las celdas con comentario", () => {
    const dates = ["2026-09-01", "2026-09-02"];
    const operators = [op("Ana", { "2026-09-01": OperatorStatus.HomeOffice }, { "2026-09-02": "nota" })];
    const { svg } = buildCronogramaSvg({ monthLabel: "septiembre de 2026", dates, operators });
    expect(svg.match(/class="note-dot"/g)?.length).toBe(1);
  });

  it("mantiene el SVG por debajo de 400 KB para un mes completo (guarda del bug de 101 MB)", () => {
    const dates = Array.from({ length: 31 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
    const statuses = [
      OperatorStatus.PresencialMonteGrande,
      OperatorStatus.PresencialParquePatricios,
      OperatorStatus.HomeOffice,
      OperatorStatus.Licencia,
      OperatorStatus.Vacaciones,
      OperatorStatus.Franco,
    ];
    const operators = Array.from({ length: 40 }, (_, o) =>
      op(`Operador ${o}`, Object.fromEntries(dates.map((d, i) => [d, statuses[(i + o) % statuses.length]])), {}),
    );
    const { svg } = buildCronogramaSvg({ monthLabel: "septiembre de 2026", dates, operators });
    expect(svg.length).toBeLessThan(400_000);
  });

  it("soporta lista de operadores vacía sin marcadores de nota", () => {
    const dates = ["2026-09-01", "2026-09-02"];
    const result = buildCronogramaSvg({ monthLabel: "septiembre de 2026", dates, operators: [] });
    const expectedWidth = PAD * 2 + NAME_W + dates.length * CELL_W;
    expect(result.width).toBe(expectedWidth);
    expect(result.svg).not.toContain('class="note-dot"');
  });

  it("soporta lista de fechas vacía", () => {
    const operators = [op("Ana", {})];
    const result = buildCronogramaSvg({ monthLabel: "septiembre de 2026", dates: [], operators });
    expect(result.width).toBe(PAD * 2 + NAME_W);
  });

  it("usa Franco como fallback cuando falta la entrada de una fecha", () => {
    const dates = ["2026-09-01"];
    const operators = [op("Ana", {})];
    const { svg } = buildCronogramaSvg({ monthLabel: "septiembre de 2026", dates, operators });
    expect(svg.match(/fill="#f8f9fa"/g)?.length).toBe(2);
  });

  it("usa Franco como fallback ante un estado desconocido", () => {
    const dates = ["2026-09-01"];
    const operators = [op("Ana", { "2026-09-01": "Inexistente" as unknown as OperatorStatus })];
    const { svg } = buildCronogramaSvg({ monthLabel: "septiembre de 2026", dates, operators });
    expect(svg.match(/fill="#f8f9fa"/g)?.length).toBe(2);
  });

  it("trunca nombres largos con elipsis", () => {
    const dates = ["2026-09-01"];
    const longName = "A".repeat(40);
    const operators = [op(longName, { "2026-09-01": OperatorStatus.HomeOffice })];
    const { svg } = buildCronogramaSvg({ monthLabel: "septiembre de 2026", dates, operators });
    expect(svg).toContain("…");
    expect(svg).not.toContain(longName);
  });

  it("escapa todos los caracteres XML especiales", () => {
    const dates = ["2026-09-01"];
    const operators = [op(`A > B "c" 'd'`, { "2026-09-01": OperatorStatus.HomeOffice })];
    const { svg } = buildCronogramaSvg({ monthLabel: "septiembre de 2026", dates, operators });
    expect(svg).toContain("A &gt; B &quot;c&quot; &apos;d&apos;");
    expect(svg).not.toContain(`A > B "c" 'd'`);
  });
});
