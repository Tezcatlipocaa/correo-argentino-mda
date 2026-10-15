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
