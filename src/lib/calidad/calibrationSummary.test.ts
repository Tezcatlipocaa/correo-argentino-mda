import test from "node:test";
import assert from "node:assert/strict";
import {
  summarizeCalibration,
  getHealthStatus,
  CALIBRATION_THRESHOLDS,
} from "./calibrationSummary.js";
import type { CriterionCalibrationMetrics } from "./groundTruthComparator.js";

test("summarizeCalibration: Caso N = 0 (Sin auditorías o todos los casos sin evidencia / fuera de scope) (Q1)", () => {
  const emptyMetrics: CriterionCalibrationMetrics[] = [
    {
      criterionCode: "c1",
      criterionName: "Criterio 1",
      model: "council",
      totalEvaluated: 0,
      agreementCount: 0,
      agreementRate: 0,
      falsePositiveCount: 0,
      falseNegativeCount: 0,
      sinEvidenciaCount: 5,
      outOfScopeCount: 2,
    },
    {
      criterionCode: "c2",
      criterionName: "Criterio 2",
      model: "council",
      totalEvaluated: 0,
      agreementCount: 0,
      agreementRate: 0,
      falsePositiveCount: 0,
      falseNegativeCount: 0,
      sinEvidenciaCount: 3,
      outOfScopeCount: 0,
    },
  ];

  const summary = summarizeCalibration(emptyMetrics, 2, 1);

  // Q1: N = 0 no debe producir 100% de acuerdo ficticio
  assert.equal(summary.totalEvaluatedCases, 0);
  assert.equal(summary.totalAgreements, 0);
  assert.equal(summary.macroAgreementRate, null, "macroAgreementRate debe ser null cuando N = 0");
  assert.equal(summary.microAgreementRate, null, "microAgreementRate debe ser null cuando N = 0");
  assert.equal(summary.macroHealthStatus, "no_data");
  assert.equal(summary.microHealthStatus, "no_data");
  assert.equal(summary.totalAuditsWithAi, 2);
  assert.equal(summary.calibratedCriteriaCount, 1);
  assert.equal(summary.totalCriteriaCount, 2);
});

test("summarizeCalibration: Caso balanceado uniforme (tasas y volúmenes homogéneos)", () => {
  const metrics: CriterionCalibrationMetrics[] = [
    {
      criterionCode: "c1",
      criterionName: "Criterio 1",
      model: "council",
      totalEvaluated: 10,
      agreementCount: 9,
      agreementRate: 90,
      falsePositiveCount: 1,
      falseNegativeCount: 0,
      sinEvidenciaCount: 0,
      outOfScopeCount: 0,
    },
    {
      criterionCode: "c2",
      criterionName: "Criterio 2",
      model: "council",
      totalEvaluated: 10,
      agreementCount: 9,
      agreementRate: 90,
      falsePositiveCount: 0,
      falseNegativeCount: 1,
      sinEvidenciaCount: 0,
      outOfScopeCount: 0,
    },
  ];

  const summary = summarizeCalibration(metrics, 10, 2);

  assert.equal(summary.totalEvaluatedCases, 20);
  assert.equal(summary.totalAgreements, 18);
  assert.equal(summary.totalFalsePositives, 1);
  assert.equal(summary.totalFalseNegatives, 1);
  assert.equal(summary.macroAgreementRate, 90);
  assert.equal(summary.microAgreementRate, 90);
  assert.equal(summary.macroHealthStatus, "healthy");
  assert.equal(summary.microHealthStatus, "healthy");
});

test("summarizeCalibration: Caso desbalanceado que diferencia Macro vs Micro (Q2)", () => {
  // Criterio 1: Criterio frecuente de alto volumen con tasa alta (98%)
  // Criterio 2: Criterio crítico infrecuente con tasa muy baja (20%)
  const metrics: CriterionCalibrationMetrics[] = [
    {
      criterionCode: "c_frecuente",
      criterionName: "Saludo y protocolo",
      model: "council",
      totalEvaluated: 100,
      agreementCount: 98,
      agreementRate: 98,
      falsePositiveCount: 2,
      falseNegativeCount: 0,
      sinEvidenciaCount: 1,
      outOfScopeCount: 0,
    },
    {
      criterionCode: "c_critico",
      criterionName: "Diagnóstico técnico de red",
      model: "council",
      totalEvaluated: 5,
      agreementCount: 1,
      agreementRate: 20,
      falsePositiveCount: 4,
      falseNegativeCount: 0,
      sinEvidenciaCount: 0,
      outOfScopeCount: 0,
    },
  ];

  const summary = summarizeCalibration(metrics, 50, 1);

  // Micro (ponderado por volumen de casos): 99 / 105 = ~94% (el criterio frecuente oculta el problema)
  assert.equal(summary.microAgreementRate, 94);
  assert.equal(summary.microHealthStatus, "healthy");

  // Macro (promedio de tasas por rúbrica): (98 + 20) / 2 = 59% (alerta que una rúbrica falla)
  assert.equal(summary.macroAgreementRate, 59);
  assert.equal(summary.macroHealthStatus, "critical");

  assert.equal(summary.totalFalsePositives, 6);
  assert.equal(summary.totalFalseNegatives, 0);
});

test("getHealthStatus: evalúa los umbrales constantes CALIBRATION_THRESHOLDS (Q6)", () => {
  assert.equal(getHealthStatus(null), "no_data");
  assert.equal(getHealthStatus(CALIBRATION_THRESHOLDS.HEALTHY), "healthy");
  assert.equal(getHealthStatus(85), "healthy");
  assert.equal(getHealthStatus(84), "warning");
  assert.equal(getHealthStatus(CALIBRATION_THRESHOLDS.WARNING), "warning");
  assert.equal(getHealthStatus(70), "warning");
  assert.equal(getHealthStatus(69), "critical");
  assert.equal(getHealthStatus(0), "critical");
});
