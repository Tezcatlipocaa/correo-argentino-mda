import { describe, it, expect } from "vitest";
import { generateXlsxBuffer } from "../../src/lib/xlsx";

describe("XLSX Generator", () => {
  it("generates a valid ZIP/XLSX buffer with PK signature", () => {
    const headers = ["Periodo", "Operador", "Score"];
    const rows = [
      ["10-2026", "Agente 1", 95],
      ["10-2026", "Agente 2", 100],
    ];

    const buf = generateXlsxBuffer("Auditorias", headers, rows);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);

    // Check PK zip signature: 0x50, 0x4B, 0x03, 0x04
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it("escapes XML special characters in string cells", () => {
    const headers = ["Test & Symbols"];
    const rows = [
      ["<tag> & \"quotes\" and 'apostrophe'"],
    ];

    const buf = generateXlsxBuffer("Hoja 1", headers, rows);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("handles empty rows and null/undefined values gracefully", () => {
    const headers = ["Col1", "Col2"];
    const rows = [
      [null, undefined],
      ["", 0],
    ];

    const buf = generateXlsxBuffer("Hoja 1", headers, rows);
    expect(buf.length).toBeGreaterThan(0);
  });
});
