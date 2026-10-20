import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALLOWED_MODELS, buildAiEvaluationPayload, validateAiEvaluateParams } from "./ai-evaluate.js";

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

describe("POST /api/calidad/ai-evaluate validación de parámetros de petición (validateAiEvaluateParams)", () => {
  it("rechaza peticiones con canal inválido o ausente", () => {
    const r1 = validateAiEvaluateParams({ channel: null });
    assert.equal(r1.valid, false);
    assert.equal(r1.status, 400);

    const r2 = validateAiEvaluateParams({ channel: "invalid_channel" as any });
    assert.equal(r2.valid, false);
    assert.equal(r2.status, 400);
  });

  it("rechaza tickets con caracteres inválidos (no numéricos)", () => {
    const res = validateAiEvaluateParams({ channel: "invgate_ticket", ticketId: "abc-123" });
    assert.equal(res.valid, false);
    assert.equal(res.status, 400);
    assert.match(res.error || "", /ticket InvGate válido/);
  });

  it("rechaza canales invgate_ticket o wise_email si no se provee ticketId", () => {
    const r1 = validateAiEvaluateParams({ channel: "invgate_ticket" });
    assert.equal(r1.valid, false);
    assert.equal(r1.status, 400);

    const r2 = validateAiEvaluateParams({ channel: "wise_email", wiseCaseId: "544637" });
    assert.equal(r2.valid, false);
    assert.equal(r2.status, 400);
  });

  it("rechaza wise_call sin ticket si tampoco se provee wiseCaseId ni recordingUrl", () => {
    const res = validateAiEvaluateParams({ channel: "wise_call" });
    assert.equal(res.valid, false);
    assert.equal(res.status, 400);
    assert.match(res.error || "", /identificador de caso Wise o la URL de grabación/);
  });

  it("rechaza wiseCaseId con caracteres inválidos o intentos de inyección", () => {
    const res = validateAiEvaluateParams({
      channel: "wise_call",
      wiseCaseId: "544637; DROP TABLE",
    });
    assert.equal(res.valid, false);
    assert.equal(res.status, 400);
    assert.match(res.error || "", /Identificador Wise inválido/);
  });

  it("acepta wise_call con ticketId numérico aunque no tenga wiseCaseId", () => {
    const res = validateAiEvaluateParams({
      channel: "wise_call",
      ticketId: "90688",
    });
    assert.equal(res.valid, true);
    assert.equal(res.cleanTicketId, "90688");
  });

  it("acepta wise_call SIN ticket cuando se provee wiseCaseId", () => {
    const res = validateAiEvaluateParams({
      channel: "wise_call",
      wiseCaseId: "544637",
    });
    assert.equal(res.valid, true);
    assert.equal(res.cleanTicketId, undefined);
    assert.equal(res.cleanWiseCaseId, "544637");
  });

  it("acepta wise_call SIN ticket cuando se provee recordingUrl", () => {
    const res = validateAiEvaluateParams({
      channel: "wise_call",
      recordingUrl: "https://wisecx.telecom.com.ar/recordings/audio123.mp3",
    });
    assert.equal(res.valid, true);
    assert.equal(res.cleanTicketId, undefined);
    assert.equal(res.cleanRecordingUrl, "https://wisecx.telecom.com.ar/recordings/audio123.mp3");
  });

  it("acepta wise_call con formato ticketId con numeral # limpiando el prefijo", () => {
    const res = validateAiEvaluateParams({
      channel: "wise_call",
      ticketId: "#90688",
      wiseCaseId: "544637",
    });
    assert.equal(res.valid, true);
    assert.equal(res.cleanTicketId, "90688");
    assert.equal(res.cleanWiseCaseId, "544637");
  });
});


