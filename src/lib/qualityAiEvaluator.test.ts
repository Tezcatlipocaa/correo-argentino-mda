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

  const ctx = buildTicketContext(
    meta,
    { type_id: 1, custom_fields: { "22945": "11111" }, comments: [] },
    [
      ...timeline,
      {
        kind: "log" as const,
        timestamp: 1791993146,
        dateStr: "14 oct. 2026, 12:52",
        text: "C. Cuello cambió el estado de espera a Esperando confirmación de solución",
      },
    ],
  );

  assert.match(ctx, /Campos personalizados \(API custom_fields\): campo_22945: "11111"/);
  assert.match(ctx, /Línea de Tiempo e Historial de Cambios \(4 eventos\):/);
  assert.match(ctx, /\[CAMBIO\] C\. Cuello cambió la categoría de Solicitudes rechazadas a Netterm- Consulta/);
  assert.match(ctx, /\[INTERNO\] Camila Cuello: Ping a b0044w103 exitoso/);
  assert.match(ctx, /\[SOLUCIÓN\] Camila Cuello: Se le indica aguardar por exceso de usuarios\./);
  assert.doesNotMatch(ctx, /Esperando confirmación de solución/, "Debe descartar logs ruidosos de estado de espera");
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

test("getAiCriteria con hasAudio=true incluye criterios de atención telefónica para wise_call", async () => {
  const { getAiCriteria } = await import("./qualityAiEvaluator.js");
  const defaultCriteria = getAiCriteria("wise_call");
  const audioCriteria = getAiCriteria("wise_call", { hasAudio: true });

  assert.ok(audioCriteria.length > defaultCriteria.length);
  const audioCodes = new Set(audioCriteria.map((c) => c.code));

  assert.ok(audioCodes.has("call_saludo_estandar"));
  assert.ok(audioCodes.has("call_cordialidad"));
  assert.ok(audioCodes.has("call_contencion_espera"));
  assert.ok(audioCodes.has("call_despedida_cordial"));
  assert.ok(audioCodes.has("call_ticket_tipo"));
});

test("buildTicketContext incluye bloque de transcripción telefónica cuando está presente", () => {
  const meta = {
    caseNumber: "90688",
    operator: "Martín Pérez",
    date: "2026-10-16",
  };
  const transcript = "Operador: Buenos días Correo Argentino, habla Martín.\nUsuario: Hola, no me anda el sistema.";

  const ctx = buildTicketContext(meta, {}, [], transcript);
  assert.match(ctx, /TRANSCRIPCIÓN DE LA LLAMADA TELEFÓNICA \(Audio Wise CX \/ Whisper\):/);
  assert.match(ctx, /Buenos días Correo Argentino, habla Martín/);
});

test("getAiCriteria con hasEmailThread=true incluye únicamente los 4 ítems permitidos de correo para wise_email", async () => {
  const { getAiCriteria } = await import("./qualityAiEvaluator.js");
  const defaultCriteria = getAiCriteria("wise_email");
  const emailCriteria = getAiCriteria("wise_email", { hasEmailThread: true });

  assert.ok(emailCriteria.length > defaultCriteria.length);
  const emailCodes = new Set(emailCriteria.map((c) => c.code));

  // 4 ítems permitidos en allowlist
  assert.ok(emailCodes.has("email_interpretacion"));
  assert.ok(emailCodes.has("email_redaccion"));
  assert.ok(emailCodes.has("email_claridad"));
  assert.ok(emailCodes.has("email_resolucion"));

  // Ítems de correo excluidos (manuales o deterministas)
  assert.ok(!emailCodes.has("email_procedimientos"));
  assert.ok(!emailCodes.has("email_gestion_herramientas"));
  assert.ok(!emailCodes.has("email_seguimiento"));
  assert.ok(!emailCodes.has("email_solicitud"));
  assert.ok(!emailCodes.has("email_sla_90min"));

  // Criterios de sección MDA siguen presentes
  assert.ok(emailCodes.has("email_mda_categorizacion"));
  assert.ok(emailCodes.has("email_mda_ortografia"));
});

test("buildTicketContext incluye bloque de hilo de correo electrónico cuando meta.emailThread está presente", () => {
  const meta = {
    caseNumber: "544637",
    operator: "Juan Perez",
    date: "2026-10-17",
    emailThread: {
      messages: [
        {
          type: "customer" as const,
          createdAt: "2026-10-17 10:00:00",
          content: "Consulta sobre paquete de encomienda.",
        },
        {
          type: "operator" as const,
          createdAt: "2026-10-17 10:15:00",
          content: "Estimado, el paquete fue entregado hoy a las 09:30.",
        },
      ],
      hasCustomerMessage: true,
      hasOperatorReply: true,
    },
  };

  const ctx = buildTicketContext(meta as any, {}, []);
  assert.match(ctx, /HILO DE CORREO ELECTRÓNICO \(Wise CX \/ emailThread\):/);
  assert.match(ctx, /CLIENTE\/SOLICITANTE \[2026-10-17 10:00:00\]:/);
  assert.match(ctx, /Consulta sobre paquete de encomienda\./);
  assert.match(ctx, /OPERADOR \[2026-10-17 10:15:00\]:/);
  assert.match(ctx, /Estimado, el paquete fue entregado hoy a las 09:30\./);
});

test("getAiCriteria con hasAudio=true y hasTicket=false incluye ÚNICAMENTE los 10 criterios de atención y omite sección ticket", async () => {
  const { getAiCriteria } = await import("./qualityAiEvaluator.js");
  const callOnlyCriteria = getAiCriteria("wise_call", { hasAudio: true, hasTicket: false });

  assert.equal(callOnlyCriteria.length, 10, "Debe tener exactamente 10 criterios de llamada");
  const codes = new Set(callOnlyCriteria.map((c) => c.code));

  // Todos los 10 de interacción en llamada deben estar presentes
  const expectedCallCodes = [
    "call_cordialidad",
    "call_saludo_estandar",
    "call_interes_resolver",
    "call_sondeo",
    "call_escucha_activa",
    "call_control_conversacion",
    "call_contencion_espera",
    "call_despedida_cordial",
    "call_lenguaje_apropiado",
    "call_procedimiento",
  ];
  for (const c of expectedCallCodes) {
    assert.ok(codes.has(c), `Debe contener ${c}`);
  }

  // Ninguno de sección ticket debe estar presente
  assert.ok(!codes.has("call_ticket_tipo"));
  assert.ok(!codes.has("call_ticket_categorizacion"));
  assert.ok(!codes.has("call_ticket_ortografia"));
  assert.ok(!codes.has("call_ticket_prioridad"));
  assert.ok(!codes.has("call_ticket_descripcion"));
  assert.ok(!codes.has("call_ticket_exactitud_datos"));
});

test("buildTicketContext con llamada standalone (sin ticket) formatea contexto enfocado en llamada y omite campos vacíos de ticket", () => {
  const meta = {
    caseNumber: "544637",
    operator: "Martín Pérez",
    date: "2026-10-19",
    duration: "03:45",
    ringTime: "00:12",
    detectedChannel: "wise_call" as const,
  };
  const transcript = "Operador: Correo Argentino, buenos días Martín.\nUsuario: Hola tengo un problema con una sucursal.";

  const ctx = buildTicketContext(meta, undefined, [], transcript);
  assert.match(ctx, /Llamada Wise CX: 544637/);
  assert.match(ctx, /Operador: Martín Pérez/);
  assert.match(ctx, /Duración: 03:45/);
  assert.match(ctx, /Tiempo de espera \(ring\): 00:12/);
  assert.match(ctx, /TRANSCRIPCIÓN DE LA LLAMADA TELEFÓNICA \(Audio Wise CX \/ Whisper\):/);
  assert.match(ctx, /Correo Argentino, buenos días Martín/);
  assert.doesNotMatch(ctx, /Prioridad: -/);
  assert.doesNotMatch(ctx, /Categoría: -/);
});


