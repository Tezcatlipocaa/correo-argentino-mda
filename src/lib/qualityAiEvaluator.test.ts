import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, buildTicketContext } from "./qualityAiEvaluator";

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

  assert.match(prompt, /RÚBRICAS OFICIALES Y EJEMPLOS DE EVALUACIÓN/i);
  assert.match(prompt, /## criterio: call_ticket_tipo/);
  assert.match(prompt, /## criterio: call_ticket_prioridad/);
  assert.doesNotMatch(prompt, /## criterio: email_mda_tipo/);
  assert.doesNotMatch(prompt, /## criterio: ag_analisis/);
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

test("buildTicketContext inyecta la Línea de Tiempo e Historial de Cambios unificada cuando está presente", () => {
  const meta = {
    caseNumber: "90688",
    operator: "Camila Cuello",
    date: "2026-10-14",
    title: "Netterm- No ingresa",
    description: "No puede ingresar a Netterm",
  };

  const timeline = [
    {
      kind: "log" as const,
      timestamp: 1791986591,
      dateStr: "14 oct. 2026, 11:03",
      text: "C. Cuello creó esta solicitud ( Incidente ) vía teléfono",
    },
    {
      kind: "log" as const,
      timestamp: 1791990689,
      dateStr: "14 oct. 2026, 12:11",
      text: "C. Cuello cambió la categoría de Solicitudes rechazadas a Netterm- Consulta",
    },
    {
      kind: "private_note" as const,
      timestamp: 1791991702,
      dateStr: "14 oct. 2026, 12:28",
      author: "Camila Cuello",
      text: "Ping a b0044w103 exitoso",
    },
    {
      kind: "solution" as const,
      timestamp: 1791993145,
      dateStr: "14 oct. 2026, 12:52",
      author: "Camila Cuello",
      text: "Se le indica aguardar por exceso de usuarios.",
    },
  ];

  const ctx = buildTicketContext(meta, { type_id: 1, comments: [] }, timeline);

  assert.match(ctx, /Línea de Tiempo e Historial de Cambios \(4 eventos\):/);
  assert.match(ctx, /\[CAMBIO\] C\. Cuello cambió la categoría de Solicitudes rechazadas a Netterm- Consulta/);
  assert.match(ctx, /\[NOTA INTERNA\] Camila Cuello: Ping a b0044w103 exitoso/);
  assert.match(ctx, /\[SOLUCIÓN\] Camila Cuello: Se le indica aguardar por exceso de usuarios\./);
  assert.doesNotMatch(ctx, /Comentarios \(0\):/, "No debe duplicar ni mostrar la sección vieja de comentarios si hay timeline");
});

test("buildTicketContext hace fallback a los comentarios de la API REST si no hay timeline scrapeado", () => {
  const meta = {
    caseNumber: "90688",
    operator: "Camila Cuello",
    date: "2026-10-14",
  };
  const raw = {
    type_id: 1,
    comments: [{ created_at: "2026-10-14", author: { name: "Camila" }, message: "Respuesta por API" }],
  };

  const ctx = buildTicketContext(meta, raw, []);
  assert.match(ctx, /Comentarios \(1\):/);
  assert.match(ctx, /Camila: Respuesta por API/);
});
