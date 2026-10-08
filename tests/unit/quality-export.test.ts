import { describe, it, expect } from "vitest";
import {
  getTicketModeLabel,
  escapeCsvCell,
  getAuditExportHeaders,
  buildOperatorFullEvaluationSheet,
} from "../../src/lib/qualityExport";

describe("Quality Export Helpers", () => {
  describe("getTicketModeLabel", () => {
    it("returns 'Reclamo / Novedad (100%)' when isReclamoNovedad is true", () => {
      expect(
        getTicketModeLabel({
          isReclamoNovedad: true,
          channelType: "wise_call",
          appliesMda: true,
        }),
      ).toBe("Reclamo / Novedad (100%)");

      expect(
        getTicketModeLabel({
          isReclamoNovedad: true,
          channelType: "wise_email",
        }),
      ).toBe("Reclamo / Novedad (100%)");
    });

    it("returns 'Sin Ticket' when wise_call and appliesMda is false", () => {
      expect(
        getTicketModeLabel({
          isReclamoNovedad: false,
          channelType: "wise_call",
          appliesMda: false,
        }),
      ).toBe("Sin Ticket");
    });

    it("returns 'Sin Ticket MDA' when wise_email and appliesMda is false", () => {
      expect(
        getTicketModeLabel({
          isReclamoNovedad: false,
          channelType: "wise_email",
          appliesMda: false,
        }),
      ).toBe("Sin Ticket MDA");
    });

    it("returns 'Derivado fuera de MDA' when invgate_ticket and staysInMda is false", () => {
      expect(
        getTicketModeLabel({
          isReclamoNovedad: false,
          channelType: "invgate_ticket",
          staysInMda: false,
        }),
      ).toBe("Derivado fuera de MDA");
    });

    it("returns 'Ticket Nuevo' by default", () => {
      expect(
        getTicketModeLabel({
          isReclamoNovedad: false,
          channelType: "wise_call",
          appliesMda: true,
        }),
      ).toBe("Ticket Nuevo");

      expect(
        getTicketModeLabel({
          channelType: "invgate_ticket",
          staysInMda: true,
        }),
      ).toBe("Ticket Nuevo");
    });
  });

  describe("escapeCsvCell", () => {
    it("handles null and undefined", () => {
      expect(escapeCsvCell(null)).toBe("");
      expect(escapeCsvCell(undefined)).toBe("");
    });

    it("returns plain string when no special characters", () => {
      expect(escapeCsvCell("Hola mundo")).toBe("Hola mundo");
      expect(escapeCsvCell(100)).toBe("100");
    });

    it("escapes semicolons and newlines with double quotes", () => {
      expect(escapeCsvCell("A;B")).toBe('"A;B"');
      expect(escapeCsvCell("Linea 1\nLinea 2")).toBe('"Linea 1\nLinea 2"');
    });

    it("escapes quotes inside strings by doubling them", () => {
      expect(escapeCsvCell('Texto con "comillas"')).toBe('"Texto con ""comillas"""');
    });
  });

  describe("getAuditExportHeaders", () => {
    it("includes base headers and dynamically appends parameter codes and Observaciones", () => {
      const params = [
        { code: "saludo", name: "Saludo inicial" },
        { code: "resolucion", name: "Resolución del caso" },
      ];
      const headers = getAuditExportHeaders(params);

      expect(headers).toContain("Periodo");
      expect(headers).toContain("Modo Ticket");
      expect(headers).toContain("[saludo] Saludo inicial");
      expect(headers).toContain("[resolucion] Resolución del caso");
      expect(headers[headers.length - 1]).toBe("Observaciones");
    });
  });

  describe("buildOperatorFullEvaluationSheet", () => {
    it("builds a full multi-channel matrix sheet matching the operator layout", () => {
      const sheet = buildOperatorFullEvaluationSheet("Bruno Gutiérrez", [
        {
          id: 1,
          channelType: "wise_call",
          date: "2026-09-01",
          callId: "533568",
          ticketId: "#77096",
          duration: "00:06:58",
          ringTime: "00:00:14",
          appliesMda: true,
          totalScore: 91,
          scores: [
            { parameterCode: "call_cordialidad", score: true },
            { parameterCode: "call_saludo_estandar", score: true },
          ],
        },
        {
          id: 2,
          channelType: "wise_email",
          date: "2026-09-01",
          callId: "533613",
          ticketId: "#77199",
          takeTime: "00:43:00",
          appliesMda: true,
          totalScore: 92,
          scores: [
            { parameterCode: "email_interpretacion", score: true },
          ],
        },
        {
          id: 3,
          channelType: "invgate_ticket",
          date: "2026-09-03",
          ticketId: "#78124",
          takeTime: "01:51:00",
          staysInMda: true,
          totalScore: 100,
          scores: [
            { parameterCode: "ag_titulo", score: true },
          ],
        },
      ]);

      expect(sheet.name).toBe("Bruno Gutiérrez");
      expect(sheet.rawRows.length).toBeGreaterThan(10);

      // Verify row 1 has headers for all 3 channels
      const r1 = sheet.rawRows.find((r) => r.rowNum === 1);
      expect(r1).toBeDefined();
      const c1Cols = r1!.cells.map((c) => c.colIdx);
      expect(c1Cols).toContain(0); // A1: Operador Call
      expect(c1Cols).toContain(15); // P1: Operador Email
      expect(c1Cols).toContain(30); // AE1: Operador AG

      // Verify row 2 has operator name and sample data
      const r2 = sheet.rawRows.find((r) => r.rowNum === 2);
      expect(r2).toBeDefined();
      const r2Vals = r2!.cells.map((c) => c.value);
      expect(r2Vals).toContain("Bruno Gutiérrez");
      expect(r2Vals).toContain("533568");

      // Verify CUMPLE is used instead of True/False
      const allValues = sheet.rawRows.flatMap((r) => r.cells.map((c) => c.value));
      expect(allValues).toContain("CUMPLE");
      expect(allValues).not.toContain("True");
      expect(allValues).not.toContain("False");

      // Verify RESULTADOS and Promedio total blocks exist in sheet
      const r62 = sheet.rawRows.find((r) => r.rowNum === 62);
      expect(r62).toBeDefined();
      expect(r62!.cells.map((c) => c.value)).toContain("RESULTADOS");

      const r67 = sheet.rawRows.find((r) => r.rowNum === 67);
      expect(r67).toBeDefined();
      expect(r67!.cells.map((c) => c.value)).toContain("Promedio total");

      const r68 = sheet.rawRows.find((r) => r.rowNum === 68);
      expect(r68).toBeDefined();
      expect(r68!.cells.map((c) => c.value)).toContain("RESULTADOS");

      const r73 = sheet.rawRows.find((r) => r.rowNum === 73);
      expect(r73).toBeDefined();
      expect(r73!.cells.map((c) => c.value)).toContain("Promedio total");
    });
  });

  describe("buildGeneralSummarySheet", () => {
    it("builds general summary sheet with operator averages and total MDA", async () => {
      const { buildGeneralSummarySheet } = await import("../../src/lib/qualityExport");
      const summarySheet = buildGeneralSummarySheet("2026-09", [
        {
          name: "Bruno Gutiérrez",
          callAvg: 70.25,
          emailAvg: 95.38,
          agAvg: 93.75,
          overallAvg: 86.46,
        },
        {
          name: "Johanna Martinez",
          callAvg: 91.75,
          emailAvg: 100,
          agAvg: 90,
          overallAvg: 93.92,
        },
      ]);

      expect(summarySheet.name).toBe("MDA - Promedio General");
      expect(summarySheet.rawRows.length).toBeGreaterThanOrEqual(4);

      const r1 = summarySheet.rawRows.find((r) => r.rowNum === 1);
      expect(r1!.cells[0].value).toContain("MDA - Gestión de Desempeño - 2026-09");

      const r3 = summarySheet.rawRows.find((r) => r.rowNum === 3);
      expect(r3!.cells[0].value).toBe("Bruno Gutiérrez");
      expect(r3!.cells.map((c) => c.value)).toContain("APROBADO");

      const totalRow = summarySheet.rawRows[summarySheet.rawRows.length - 1];
      expect(totalRow.cells[0].value).toBe("Promedio MDA");
    });
  });
});

