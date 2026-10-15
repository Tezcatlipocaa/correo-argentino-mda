import test from "node:test";
import assert from "node:assert/strict";
import { getAiProvider } from "./providerFactory.js";
import { OpenCodeProvider } from "./opencodeProvider.js";

test("getAiProvider retorna OpenCodeProvider por defecto o con modelo especificado", () => {
  const p1 = getAiProvider({ model: "opencode/nemotron-3.5-lightning-free" });
  assert.ok(p1 instanceof OpenCodeProvider);
  assert.equal(p1.name, "opencode:opencode/nemotron-3.5-lightning-free");

  const p2 = getAiProvider();
  assert.ok(p2 instanceof OpenCodeProvider);
});
