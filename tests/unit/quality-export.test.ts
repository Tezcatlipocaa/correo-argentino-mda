import { describe, it, expect } from "vitest";
import {
  getTicketModeLabel,
  escapeCsvCell,
  getAuditExportHeaders,
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
});
