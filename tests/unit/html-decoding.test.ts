import { describe, it, expect } from "vitest";
import { cleanHtmlText } from "../../src/lib/titleNormalizer";

describe("cleanHtmlText - Universal HTML Entity Decoding & Formatting", () => {
  it("decodes hexadecimal HTML entities correctly (e.g., &#xED;, &#xE9;, &#xF3;)", () => {
    const input = "No Caracter&#xED;sticas de Punto de Inter&#xE9;s - Distribuci&#xF3;n.";
    const result = cleanHtmlText(input);
    expect(result).toBe("No Características de Punto de Interés - Distribución.");
  });

  it("decodes decimal HTML entities correctly (e.g., &#237;, &#233;, &#243;, &#241;)", () => {
    const input = "Atenci&#243;n al cliente en la sucursal de Espa&#241;a, env&#237;o express.";
    const result = cleanHtmlText(input);
    expect(result).toBe("Atención al cliente en la sucursal de España, envío express.");
  });

  it("decodes uppercase and lowercase hex entities", () => {
    const input = "Operaci&#xf3;n y verificaci&#XF3;n con &#xc1;rbol";
    const result = cleanHtmlText(input);
    expect(result).toBe("Operación y verificación con Árbol");
  });

  it("handles HTML tags, br breaks, and basic entities together", () => {
    const html = "<p>Primer p&aacute;rrafo con <strong>negrita</strong> y &#xFA;ltimo aviso.</p><br><div>Segunda l&iacute;nea con &amp; y &quot;comillas&quot;.</div>";
    const result = cleanHtmlText(html);
    expect(result).toContain("Primer párrafo con negrita y último aviso.");
    expect(result).toContain('Segunda línea con & y "comillas".');
  });

  it("handles empty and blank strings gracefully", () => {
    expect(cleanHtmlText("")).toBe("");
    expect(cleanHtmlText("   ")).toBe("");
  });
});
