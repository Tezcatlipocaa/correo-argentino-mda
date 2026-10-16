import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALLOWED_MODELS } from "./ai-evaluate.js";

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
});

