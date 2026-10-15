import test from "node:test";
import assert from "node:assert/strict";
import { getAiProvider } from "./providerFactory.js";
import { OpenCodeProvider } from "./opencodeProvider.js";
import { GeminiProvider } from "./geminiProvider.js";

test("getAiProvider retorna OpenCodeProvider por defecto o cuando se especifica opencode", () => {
  const p1 = getAiProvider({ provider: "opencode", model: "opencode/nemotron-3.5-lightning-free" });
  assert.ok(p1 instanceof OpenCodeProvider);
  assert.equal(p1.name, "opencode:opencode/nemotron-3.5-lightning-free");
});

test("getAiProvider retorna GeminiProvider cuando se especifica gemini", () => {
  const p2 = getAiProvider({ provider: "gemini", model: "gemini-2.5-flash-lite" });
  assert.ok(p2 instanceof GeminiProvider);
  assert.equal(p2.name, "gemini:gemini-2.5-flash-lite");
});
