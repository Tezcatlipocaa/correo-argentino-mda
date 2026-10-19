import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCoachingText, cleanModelName } from "./coachingFormatter.js";
import { AiResponseSchema, type CoachingFeedback } from "../ai/types.js";

describe("cleanModelName", () => {
  it("elimina prefijos opencode/ y opencode:opencode/ y sufijos free dejando solo el nombre del modelo", () => {
    assert.equal(cleanModelName("opencode:opencode/deepseek-v4.1-flash-free"), "deepseek-v4.1-flash");
    assert.equal(cleanModelName("opencode/deepseek-v4.1-flash (free)"), "deepseek-v4.1-flash");
    assert.equal(cleanModelName("opencode/glm-4-9b-chat"), "glm-4-9b-chat");
    assert.equal(cleanModelName("opencode:nemotron-3.5-lightning-free"), "nemotron-3.5-lightning");
    assert.equal(cleanModelName("council"), "council");
    assert.equal(cleanModelName(""), "");
    assert.equal(cleanModelName(undefined), "");
  });
});

describe("formatCoachingText", () => {
  it("formatea correctamente el feedback completo con nombre de modelo limpio (sin opencode/)", () => {
    const feedback: CoachingFeedback = {
      fortalezas: ["Excelente cordialidad y empatía", "Correcta identificación del cliente"],
      oportunidades: ["En procedimientos: no se vinculó el ticket previo", "En claridad: mensaje técnico complejo"],
      respuestaModelo: "Estimado usuario, registramos su consulta vinculada al caso anterior #12345.",
    };

    const formatted = formatCoachingText(feedback, "opencode:opencode/glm-4-9b-chat");

    assert.ok(formatted.startsWith("[Asistente IA - glm-4-9b-chat]:"));
    assert.ok(formatted.includes("• Fortalezas:\n  - Excelente cordialidad y empatía\n  - Correcta identificación del cliente"));
    assert.ok(formatted.includes("• Oportunidades de mejora:\n  - En procedimientos: no se vinculó el ticket previo\n  - En claridad: mensaje técnico complejo"));
    assert.ok(formatted.includes('• Sugerencia modelo de redacción/atención:\n  "Estimado usuario, registramos su consulta vinculada al caso anterior #12345."'));
    // No debe contener códigos técnicos crudos de DB
    assert.ok(!formatted.includes("call_procedimiento"));
    assert.ok(!formatted.includes("email_redaccion"));
  });

  it("utiliza fallback '[Asistente IA]:' si no se proporciona modelName", () => {
    const feedback: CoachingFeedback = {
      fortalezas: ["Buena modulación de voz"],
      oportunidades: [],
      respuestaModelo: "",
    };

    const formatted = formatCoachingText(feedback);
    assert.ok(formatted.startsWith("[Asistente IA]:"));
    assert.ok(formatted.includes("• Fortalezas:\n  - Buena modulación de voz"));
    assert.ok(!formatted.includes("• Oportunidades de mejora"));
    assert.ok(!formatted.includes("• Sugerencia modelo de redacción/atención"));
  });

  it("maneja listas vacías y respuesta modelo ausente limpiamente", () => {
    const feedback: CoachingFeedback = {
      fortalezas: [],
      oportunidades: ["En procedimientos: justificar derivación"],
      respuestaModelo: "",
    };

    const formatted = formatCoachingText(feedback, "Alpha");
    assert.ok(formatted.includes("[Asistente IA - Alpha]:"));
    assert.ok(!formatted.includes("• Fortalezas"));
    assert.ok(formatted.includes("• Oportunidades de mejora:\n  - En procedimientos: justificar derivación"));
    assert.ok(!formatted.includes("• Sugerencia modelo"));
  });

  it("retorna cadena vacía si el objeto de feedback no tiene contenido", () => {
    const feedback: CoachingFeedback = {
      fortalezas: [],
      oportunidades: [],
      respuestaModelo: "",
    };

    const formatted = formatCoachingText(feedback, "Alpha");
    assert.equal(formatted, "");
  });
});

describe("AiResponseSchema - Resiliencia de CoachingSchema", () => {
  it("tolera coaching ausente y lo asigna a null", () => {
    const raw = {
      resumen: "Resumen ok",
      resultados: [
        { codigo: "c1", cumple: true, confianza: 0.9, evidencia: "ev" }
      ],
    };

    const parsed = AiResponseSchema.parse(raw);
    assert.equal(parsed.coaching, null);
  });

  it("tolera coaching malformado (ej. string o tipo inválido) convirtiéndolo en null sin lanzar excepción", () => {
    const rawInvalid = {
      resumen: "Resumen ok",
      resultados: [
        { codigo: "c1", cumple: true, confianza: 0.9, evidencia: "ev" }
      ],
      coaching: {
        fortalezas: "Esto no es un array",
      },
    };

    const parsed = AiResponseSchema.parse(rawInvalid);
    assert.equal(parsed.coaching, null);
  });

  it("parsea correctamente un bloque de coaching válido", () => {
    const rawValid = {
      resumen: "Resumen ok",
      resultados: [],
      coaching: {
        fortalezas: ["F1", "F2"],
        oportunidades: ["O1"],
        respuestaModelo: "Respuesta de ejemplo",
      },
    };

    const parsed = AiResponseSchema.parse(rawValid);
    assert.ok(parsed.coaching);
    assert.deepEqual(parsed.coaching.fortalezas, ["F1", "F2"]);
    assert.deepEqual(parsed.coaching.oportunidades, ["O1"]);
    assert.equal(parsed.coaching.respuestaModelo, "Respuesta de ejemplo");
  });
});
