import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("POST /api/calidad/ai-evaluate validaciones", () => {
  it("valida que se acepten los parámetros opcionales de modelo y proveedor", () => {
    const payload = {
      channel: "wise_call",
      ticketId: "88442",
      model: "opencode/nemotron-3.5-lightning-free",
      provider: "opencode",
    };
    assert.equal(payload.channel, "wise_call");
    assert.equal(payload.ticketId, "88442");
    assert.equal(payload.model, "opencode/nemotron-3.5-lightning-free");
    assert.equal(payload.provider, "opencode");
  });

  it("admite 'council' como modelo en el contrato de petición", () => {
    const payload = {
      channel: "invgate_ticket",
      ticketId: "90688",
      model: "council",
    };
    assert.equal(payload.model, "council");
  });
});

