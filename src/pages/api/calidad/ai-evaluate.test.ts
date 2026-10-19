import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALLOWED_MODELS, buildAiEvaluationPayload } from "./ai-evaluate.js";

describe("POST /api/calidad/ai-evaluate validaciones de modelos permitidos", () => {
  it("incluye 'council' como modelo válido de orquestación", () => {
    assert.ok(ALLOWED_MODELS.has("council"), "ALLOWED_MODELS debe incluir 'council'");
  });

  it("incluye únicamente modelos autorizados con sandbox y descarta modelos arbitrarios", () => {
    const requiredModels = [
      "council",
      "opencode/nemotron-3.5-lightning-free",
      "opencode/deepseek-v4.1-flash-free",
      "opencode/mimo-v2.6-flash-free",
      "opencode/glm-5.3-flash-free",
    ];
    for (const m of requiredModels) {
      assert.ok(ALLOWED_MODELS.has(m), `Debe contener ${m}`);
    }

    assert.equal(ALLOWED_MODELS.has("arbitrary-cmd"), false);
    assert.equal(ALLOWED_MODELS.has("opencode/unauthorized-model"), false);
  });

  it("valida formato de wiseCaseId aceptando alfanuméricos con guion y guion bajo", () => {
    const valid = ["544637", "CASE-1234", "case_abc_9", "ABC-def_123"];
    const invalid = ["544637; DROP TABLE", "../../etc", "case 123", "id$#@", "case\n123"];

    const regex = /^[A-Za-z0-9_-]+$/;
    for (const id of valid) {
      assert.ok(regex.test(id), `${id} debe ser válido`);
    }
    for (const id of invalid) {
      assert.ok(!regex.test(id), `${id} debe ser inválido`);
    }
  });

  it("buildAiEvaluationPayload estructura correctamente el payload con reclamoSignal y detectedTickets", () => {
    const payload = buildAiEvaluationPayload({
      model: "opencode/deepseek-v4.1-flash-free",
      hasAudioTranscript: true,
      hasEmailThread: false,
      resumen: "Resumen de prueba",
      verdicts: [{ codigo: "call_sondeo", cumple: true, confianza: 0.9, evidencia: "test", razonamiento: "ok" }],
      reclamoSignal: {
        detected: true,
        type: "reiteracion",
        confidence: 0.85,
        evidence: "Es la segunda vez que llamo",
        suggestedMode: "reclamo",
        rationale: "El usuario reitera caso previo",
      },
      detectedTickets: [{ ticketId: "90688", context: "ticket 90688", type: "previo", confidence: 0.9 }],
    });

    assert.equal(payload.ok, true);
    assert.equal(payload.model, "opencode/deepseek-v4.1-flash-free");
    assert.equal(payload.hasAudioTranscript, true);
    assert.equal(payload.hasEmailThread, false);
    assert.equal(payload.reclamoSignal?.detected, true);
    assert.equal(payload.reclamoSignal?.suggestedMode, "reclamo");
    assert.equal(payload.detectedTickets?.length, 1);
    assert.equal(payload.detectedTickets?.[0].ticketId, "90688");
  });
});

