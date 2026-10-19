import test from "node:test";
import assert from "node:assert/strict";
import { AiResponseSchema, type AiProvider } from "./types.js";

test("AiResponseSchema valida correctamente una respuesta con veredictos y resumen", () => {
  const sample = {
    resumen: "El operador atendió un incidente de impresora y guió al usuario a destrabar la bandeja.",
    resultados: [
      {
        codigo: "call_ticket_tipo",
        cumple: true,
        confianza: 0.9,
        evidencia: "Descripción describe falla de hardware (incidente)",
        razonamiento: "Coincide con un mal funcionamiento que interrumpe la tarea.",
      },
      {
        codigo: "call_ticket_prioridad",
        cumple: false,
        confianza: 0.8,
        evidencia: "Prioridad fijada en Alta para 1 sola impresora secundaria",
        razonamiento: "Debió ser Media según el procedimiento estándar.",
      },
    ],
  };

  const parsed = AiResponseSchema.parse(sample);
  assert.equal(parsed.resumen, sample.resumen);
  assert.equal(parsed.resultados.length, 2);
  assert.equal(parsed.resultados[0].cumple, true);
  assert.equal(parsed.resultados[1].cumple, false);
});

test("AiResponseSchema rechaza estructuras corruptas o sin resultados", () => {
  assert.throws(() => {
    AiResponseSchema.parse({ resumen: "Incompleto" });
  });
});
