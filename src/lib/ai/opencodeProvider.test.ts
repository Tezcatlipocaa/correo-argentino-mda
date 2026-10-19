import test from "node:test";
import assert from "node:assert/strict";
import { extractModelText } from "./opencodeProvider.js";

test("extractModelText extrae texto concatenado de los eventos JSON de opencode", () => {
  const stdout = [
    '{"type":"step_start","timestamp":100}',
    '{"type":"text","part":{"type":"text","text":"{\\"resumen\\":\\"Caso resuelto\\","}}',
    '{"type":"text","part":{"type":"text","text":"\\"resultados\\":[]}"}}',
    '{"type":"step_finish","timestamp":200}',
  ].join("\n");

  const extracted = extractModelText(stdout);
  assert.equal(extracted, '{"resumen":"Caso resuelto","resultados":[]}');
});

test("extractModelText ignora líneas no-json y eventos sin texto", () => {
  const stdout = "Linea de log ordinaria\n{\"type\":\"ping\"}\n{\"type\":\"text\",\"part\":{\"text\":\"OK\"}}";
  assert.equal(extractModelText(stdout), "OK");
});

test("getFallbackModels no incluye el modelo activo en los fallbacks", async () => {
  const { getFallbackModels } = await import("./opencodeProvider.js");
  const list = getFallbackModels("opencode/deepseek-v4.1-flash-free");
  assert.equal(list.includes("opencode/deepseek-v4.1-flash-free"), false);
  assert.ok(list.length > 0);
  assert.ok(list.includes("opencode/mimo-v2.6-flash-free"));
});

test("extractModelError extrae el mensaje de error del payload JSON en stdout", async () => {
  const { extractModelError } = await import("./opencodeProvider.js");
  const stdout = JSON.stringify({
    type: "error",
    error: {
      type: "provider.auth",
      message: "This API key has expired.",
    },
  });
  const err = extractModelError(stdout, "");
  assert.equal(err, "This API key has expired.");
});

test("extractModelError fallback a stderr o stdout si no hay evento JSON error", async () => {
  const { extractModelError } = await import("./opencodeProvider.js");
  assert.equal(extractModelError("", "Fatal error: segmentation fault"), "Fatal error: segmentation fault");
  assert.equal(extractModelError("Some random stdout error", ""), "Some random stdout error");
  assert.equal(extractModelError("", ""), "Error desconocido de OpenCode");
});

test("resolveOpenCodeBin devuelve shell false y comando ejecutable", async () => {
  const { resolveOpenCodeBin } = await import("./opencodeProvider.js");
  const binInfo = resolveOpenCodeBin();
  assert.equal(typeof binInfo.command, "string");
  assert.ok(binInfo.command.length > 0);
  assert.equal(binInfo.shell, false);
});

