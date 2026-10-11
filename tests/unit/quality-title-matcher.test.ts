import { describe, it, expect } from "vitest";
import {
  normalizeTitle,
  matchApprovedTitle,
  cleanHtmlText,
} from "../../src/lib/qualityTitleMatcher";

describe("Quality Title Matcher", () => {
  const sampleApprovedTitles = [
    "Problema con Token",
    "Reinicio de Contraseña de Red",
    "Sistema SGO - Error de Acceso",
    "Impresora - Falla de Impresión",
    "Llamada de Mesa de Ayuda",
    "Gestión de Correo Electrónico",
  ];

  it("normalizes titles by removing diacritics, lowering case, and collapsing spaces", () => {
    expect(normalizeTitle("  Reinicio de   CONTRASEÑA de Red  ")).toBe("reinicio de contrasena de red");
    expect(normalizeTitle("Sistema SGO - Error de Acceso")).toBe("sistema sgo error de acceso");
    expect(normalizeTitle("")).toBe("");
  });

  it("identifies exact title matches", () => {
    const res = matchApprovedTitle("Problema con Token", sampleApprovedTitles);
    expect(res.matched).toBe(true);
    expect(res.exact).toBe(true);
    expect(res.matchedTitle).toBe("Problema con Token");
  });

  it("identifies normalized title matches (case and accents difference)", () => {
    const res = matchApprovedTitle("reinicio de contrasena de red", sampleApprovedTitles);
    expect(res.matched).toBe(true);
    expect(res.matchedTitle).toBe("Reinicio de Contraseña de Red");
  });

  it("identifies matching when approved titles list contains objects with name property", () => {
    const objectList = sampleApprovedTitles.map((name, id) => ({ id, name }));
    const res = matchApprovedTitle("sistema sgo - error de acceso", objectList);
    expect(res.matched).toBe(true);
    expect(res.matchedTitle).toBe("Sistema SGO - Error de Acceso");
  });

  it("rejects invalid or non-homologated titles", () => {
    const res = matchApprovedTitle("asdasd titulo inventado 123", sampleApprovedTitles);
    expect(res.matched).toBe(false);
    expect(res.matchedTitle).toBeUndefined();
  });

  it("handles empty or whitespace-only inputs gracefully", () => {
    expect(matchApprovedTitle("", sampleApprovedTitles).matched).toBe(false);
    expect(matchApprovedTitle("   ", sampleApprovedTitles).matched).toBe(false);
    expect(matchApprovedTitle("Token", []).matched).toBe(false);
  });

  it("cleans HTML tags and entities from ticket descriptions", () => {
    expect(cleanHtmlText("<p>Falla en equipo aforadora <strong>sucursal</strong>.<br>No imprime.</p>"))
      .toBe("Falla en equipo aforadora sucursal.\nNo imprime.");
    expect(cleanHtmlText("<div>Atenci&oacute;n al cliente &amp; soporte &quot;prioritario&quot;</div>"))
      .toBe('Atención al cliente & soporte "prioritario"');
    expect(cleanHtmlText("")).toBe("");
  });
});
