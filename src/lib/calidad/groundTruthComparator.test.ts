import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateGroundTruth,
  calculateCalibrationMetrics,
  type AuditEvaluationInput,
  type AuditScoreRow,
  type AuditParameterRow,
} from "./groundTruthComparator.js";

// Parámetros de prueba
const mockParameters: AuditParameterRow[] = [
  { id: 1, code: "call_sondeo", name: "Sondeo y relevamiento", section: "items", channel: "wise_call" },
  { id: 2, code: "call_procedimiento", name: "Procedimiento correcto", section: "items", channel: "wise_call" },
  { id: 3, code: "call_ticket_tipo", name: "Tipo de ticket", section: "ticket", channel: "wise_call" },
  { id: 4, code: "call_ticket_prioridad", name: "Prioridad", section: "ticket", channel: "wise_call" },
  { id: 5, code: "email_interpretacion", name: "Interpretación del correo", section: "items", channel: "wise_email" },
  { id: 6, code: "email_mda_sla_resolucion", name: "SLA Resolución", section: "mda", channel: "wise_email" },
];

test("evaluateGroundTruth: Paso 1 - Fuera de Scope para Sección 2 en modo Reclamo / Novedad", () => {
  const audit: AuditEvaluationInput = {
    id: 101,
    date: "2026-10-17",
    channelType: "wise_call",
    ticketId: "90688",
    callId: "CALL-1",
    operatorName: "Juan Pérez",
    isReclamoNovedad: true, // Sección 2 no se evalúa individualmente
    appliesMda: true,
    aiSnapshot: {
      model: "opencode/deepseek-v4.1-flash-free",
      resumen: "Atención de prueba",
      verdicts: [
        { codigo: "call_sondeo", cumple: true, confianza: 0.9, evidencia: "preguntó todo", razonamiento: "ok" },
        { codigo: "call_ticket_tipo", cumple: true, confianza: 0.85, evidencia: "tipo incidente", razonamiento: "ok" },
      ],
      appliedCodes: ["call_sondeo"],
      createdAt: "2026-10-17T10:00:00Z",
    },
  };

  const scores: AuditScoreRow[] = [
    { auditId: 101, parameterId: 1, score: true, comment: "Buen sondeo" },
    // No hay fila para parameterId: 3 porque Sección 2 estuvo en modo reclamo
  ];

  const results = evaluateGroundTruth([audit], scores, mockParameters);

  const sondeoRes = results.find((r) => r.criterionCode === "call_sondeo");
  assert.ok(sondeoRes);
  assert.equal(sondeoRes.classification, "acuerdo");
  assert.equal(sondeoRes.humanScore, true);

  const tipoRes = results.find((r) => r.criterionCode === "call_ticket_tipo");
  assert.ok(tipoRes);
  assert.equal(tipoRes.classification, "fuera_de_scope", "Debe ser fuera_de_scope por isReclamoNovedad = true");
  assert.equal(tipoRes.humanScore, null, "humanScore debe ser null cuando está fuera_de_scope");
});

test("evaluateGroundTruth: Paso 1 - Fuera de Scope cuando appliesMda es false", () => {
  const audit: AuditEvaluationInput = {
    id: 102,
    date: "2026-10-17",
    channelType: "wise_email",
    ticketId: "544637",
    callId: "CASE-2",
    operatorName: "María Gómez",
    isReclamoNovedad: false,
    appliesMda: false, // Sección MDA deshabilitada
    aiSnapshot: {
      model: "opencode/deepseek-v4.1-flash-free",
      resumen: "Mail de prueba",
      verdicts: [
        { codigo: "email_interpretacion", cumple: true, confianza: 0.9, evidencia: "interpretó", razonamiento: "ok" },
        { codigo: "email_mda_sla_resolucion", cumple: false, confianza: 0.9, evidencia: "demora", razonamiento: "no cumple" },
      ],
      appliedCodes: ["email_interpretacion"],
      createdAt: "2026-10-17T10:00:00Z",
    },
  };

  const scores: AuditScoreRow[] = [
    { auditId: 102, parameterId: 5, score: true, comment: null },
  ];

  const results = evaluateGroundTruth([audit], scores, mockParameters);
  const slaRes = results.find((r) => r.criterionCode === "email_mda_sla_resolucion");
  assert.ok(slaRes);
  assert.equal(slaRes.classification, "fuera_de_scope");
  assert.equal(slaRes.humanScore, null);
});

test("evaluateGroundTruth: Paso 2 - Criterio en scope sin fila en audit_scores se convalida como No Cumple (false)", () => {
  const audit: AuditEvaluationInput = {
    id: 103,
    date: "2026-10-17",
    channelType: "wise_call",
    ticketId: "90688",
    callId: "CALL-3",
    operatorName: "Juan Pérez",
    isReclamoNovedad: false,
    appliesMda: true,
    aiSnapshot: {
      model: "opencode/deepseek-v4.1-flash-free",
      resumen: "Atención",
      verdicts: [
        { codigo: "call_procedimiento", cumple: true, confianza: 0.9, evidencia: "siguió manual", razonamiento: "ok" },
      ],
      appliedCodes: [],
      createdAt: "2026-10-17T10:00:00Z",
    },
  };

  // Sin fila para parameterId: 2 (call_procedimiento) -> El supervisor no lo tildó
  const scores: AuditScoreRow[] = [];

  const results = evaluateGroundTruth([audit], scores, mockParameters);
  const procRes = results.find((r) => r.criterionCode === "call_procedimiento");
  assert.ok(procRes);
  assert.equal(procRes.humanScore, false, "Sin fila en audit_scores con criterio en scope es No Cumple");
  assert.equal(procRes.classification, "falso_positivo", "IA dijo true y supervisor convalidó false -> FP");
});

test("evaluateGroundTruth: Paso 3 - Falso Negativo, Acuerdo Negativo y Sin Evidencia", () => {
  const audit: AuditEvaluationInput = {
    id: 104,
    date: "2026-10-17",
    channelType: "wise_call",
    ticketId: "90688",
    callId: "CALL-4",
    operatorName: "Juan Pérez",
    isReclamoNovedad: false,
    appliesMda: true,
    aiSnapshot: {
      model: "opencode/deepseek-v4.1-flash-free",
      resumen: "Atención",
      verdicts: [
        { codigo: "call_sondeo", cumple: false, confianza: 0.8, evidencia: "no preguntó", razonamiento: "mal" },
        { codigo: "call_procedimiento", cumple: false, confianza: 0.85, evidencia: "omitió paso", razonamiento: "mal" },
        { codigo: "call_ticket_tipo", cumple: null, confianza: 0.5, evidencia: "", razonamiento: "sin datos" },
      ],
      appliedCodes: ["call_procedimiento"],
      createdAt: "2026-10-17T10:00:00Z",
    },
  };

  const scores: AuditScoreRow[] = [
    { auditId: 104, parameterId: 1, score: true, comment: "El operador sí preguntó al inicio" }, // Humano lo tildó
    // parameterId: 2 no tiene fila -> Humano no lo tildó (score: false)
  ];

  const results = evaluateGroundTruth([audit], scores, mockParameters);

  // call_sondeo: IA false, Humano true -> Falso Negativo
  const fnRes = results.find((r) => r.criterionCode === "call_sondeo");
  assert.equal(fnRes?.classification, "falso_negativo");
  assert.equal(fnRes?.humanScore, true);

  // call_procedimiento: IA false, Humano false -> Acuerdo (TN)
  const tnRes = results.find((r) => r.criterionCode === "call_procedimiento");
  assert.equal(tnRes?.classification, "acuerdo");
  assert.equal(tnRes?.humanScore, false);

  // call_ticket_tipo: IA null -> Sin evidencia
  const nullRes = results.find((r) => r.criterionCode === "call_ticket_tipo");
  assert.equal(nullRes?.classification, "sin_evidencia");
});

test("calculateCalibrationMetrics: cálculo estricto con denominador N = acuerdo + FP + FN", () => {
  const records = [
    // call_sondeo: 2 acuerdos, 1 FP, 1 FN, 1 sin_evidencia, 1 fuera_de_scope
    { criterionCode: "call_sondeo", criterionName: "Sondeo", model: "deepseek", classification: "acuerdo" as const },
    { criterionCode: "call_sondeo", criterionName: "Sondeo", model: "deepseek", classification: "acuerdo" as const },
    { criterionCode: "call_sondeo", criterionName: "Sondeo", model: "deepseek", classification: "falso_positivo" as const },
    { criterionCode: "call_sondeo", criterionName: "Sondeo", model: "deepseek", classification: "falso_negativo" as const },
    { criterionCode: "call_sondeo", criterionName: "Sondeo", model: "deepseek", classification: "sin_evidencia" as const },
    { criterionCode: "call_sondeo", criterionName: "Sondeo", model: "deepseek", classification: "fuera_de_scope" as const },
  ];

  const metrics = calculateCalibrationMetrics(records as any);
  assert.equal(metrics.length, 1);
  const m = metrics[0];

  assert.equal(m.totalEvaluated, 4, "N debe ser acuerdo (2) + FP (1) + FN (1) = 4");
  assert.equal(m.agreementCount, 2);
  assert.equal(m.falsePositiveCount, 1);
  assert.equal(m.falseNegativeCount, 1);
  assert.equal(m.sinEvidenciaCount, 1);
  assert.equal(m.outOfScopeCount, 1);
  assert.equal(m.agreementRate, 50.0, "2 / 4 = 50.0%");
});

test("evaluateGroundTruth: resuelve nombres de criterios desde audit_parameters y descarta snapshots vacíos", () => {
  const auditWithoutSnapshot: AuditEvaluationInput = {
    id: 105,
    date: "2026-10-17",
    channelType: "wise_call",
    ticketId: "90688",
    callId: "CALL-5",
    operatorName: "Juan Pérez",
    isReclamoNovedad: false,
    appliesMda: true,
    aiSnapshot: null,
  };

  assert.deepEqual(evaluateGroundTruth([auditWithoutSnapshot], [], mockParameters), []);
});
