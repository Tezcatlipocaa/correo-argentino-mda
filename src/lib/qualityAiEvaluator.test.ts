import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, getAiCriteria } from "./qualityAiEvaluator";

test("buildPrompt incluye las rúbricas detalladas del Markdown para los criterios evaluados", () => {
  const criteria = [
    {
      code: "call_ticket_tipo",
      name: "Tipo de solicitud",
      weight: 10,
      hint: "Incidente vs solicitud",
    },
    {
      code: "call_ticket_prioridad",
      name: "Prioridad",
      weight: 5,
      hint: "Prioridad adecuada",
    },
  ];

  const ticketContext = "Ticket #1234\nTítulo: Falla de red en Lanús";
  const prompt = buildPrompt(criteria, ticketContext);

  // Debe contener la orden explícita de seguir las rúbricas
  assert.match(prompt, /RÚBRICAS OFICIALES Y EJEMPLOS DE EVALUACIÓN/i);
  // Debe contener los bloques específicos de los criterios solicitados
  assert.match(prompt, /## criterio: call_ticket_tipo/);
  assert.match(prompt, /## criterio: call_ticket_prioridad/);
  // No debe contener criterios de otros canales que no fueron solicitados
  assert.doesNotMatch(prompt, /## criterio: email_mda_tipo/);
  assert.doesNotMatch(prompt, /## criterio: ag_analisis/);
  // Debe contener el contexto del ticket
  assert.match(prompt, /Ticket #1234/);
  assert.match(prompt, /Falla de red en Lanús/);
});

test("buildPrompt funciona aún si se le pasa una cadena personalizada de rúbricas", () => {
  const criteria = [
    {
      code: "custom_code",
      name: "Custom",
      weight: null,
      hint: "Custom hint",
    },
  ];
  const customRubrics = "## criterio: custom_code\n- Regla: siempre cumple";
  const prompt = buildPrompt(criteria, "Contexto", customRubrics);

  assert.match(prompt, /## criterio: custom_code/);
  assert.match(prompt, /Regla: siempre cumple/);
});
