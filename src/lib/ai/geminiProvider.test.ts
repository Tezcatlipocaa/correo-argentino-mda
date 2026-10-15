import test from "node:test";
import assert from "node:assert/strict";
import { GeminiProvider } from "./geminiProvider.js";

test("GeminiProvider construye la URL correcta según el modelo y api key", () => {
  const provider = new GeminiProvider("test-key", "gemini-2.5-flash-lite");
  assert.equal(provider.name, "gemini:gemini-2.5-flash-lite");
  assert.equal(provider.endpointUrl, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=test-key");
});

test("GeminiProvider falla limpiamente si falta la API key", async () => {
  const provider = new GeminiProvider("", "gemini-2.5-flash-lite");
  await assert.rejects(async () => {
    await provider.evaluate("prompt");
  }, /GEMINI_API_KEY no configurada/);
});
