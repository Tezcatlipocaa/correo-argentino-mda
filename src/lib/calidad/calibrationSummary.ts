import type { CriterionCalibrationMetrics } from "./groundTruthComparator";

export const CALIBRATION_THRESHOLDS = {
  HEALTHY: 85,
  WARNING: 70,
} as const;

export type CalibrationHealthStatus = "healthy" | "warning" | "critical" | "no_data";

export interface CalibrationSummaryResult {
  totalAuditsWithAi: number;
  totalEvaluatedCases: number;
  totalAgreements: number;
  totalFalsePositives: number;
  totalFalseNegatives: number;
  macroAgreementRate: number | null; // Promedio no ponderado de tasas de criterios con N > 0
  microAgreementRate: number | null; // Ponderado por volumen: sum(acuerdos) / sum(N)
  macroHealthStatus: CalibrationHealthStatus;
  microHealthStatus: CalibrationHealthStatus;
  calibratedCriteriaCount: number;
  totalCriteriaCount: number;
}

export function getHealthStatus(rate: number | null): CalibrationHealthStatus {
  if (rate === null) return "no_data";
  if (rate >= CALIBRATION_THRESHOLDS.HEALTHY) return "healthy";
  if (rate >= CALIBRATION_THRESHOLDS.WARNING) return "warning";
  return "critical";
}

/**
 * Agrega y resume métricas de calibración de calidad IA.
 * - Si N = 0, devuelve null para evitar falsos verdes (Q1).
 * - Calcula tanto macro-promedio (por rúbrica) como micro-promedio (por volumen de casos) (Q2).
 */
export function summarizeCalibration(
  metrics: CriterionCalibrationMetrics[],
  totalAuditsWithAi: number,
  calibratedCriteriaCount: number,
): CalibrationSummaryResult {
  const totalEvaluatedCases = metrics.reduce((acc, m) => acc + m.totalEvaluated, 0);
  const totalAgreements = metrics.reduce((acc, m) => acc + m.agreementCount, 0);
  const totalFalsePositives = metrics.reduce((acc, m) => acc + m.falsePositiveCount, 0);
  const totalFalseNegatives = metrics.reduce((acc, m) => acc + m.falseNegativeCount, 0);

  // Micro: ponderado por casos (null si N = 0)
  const microAgreementRate =
    totalEvaluatedCases > 0
      ? Math.round((totalAgreements / totalEvaluatedCases) * 100)
      : null;

  // Macro: promedio de criterios con N > 0 (null si no hay criterios evaluables)
  const evaluatedCriteria = metrics.filter((m) => m.totalEvaluated > 0);
  const macroAgreementRate =
    evaluatedCriteria.length > 0
      ? Math.round(
          evaluatedCriteria.reduce((acc, m) => acc + m.agreementRate, 0) /
            evaluatedCriteria.length,
        )
      : null;

  return {
    totalAuditsWithAi,
    totalEvaluatedCases,
    totalAgreements,
    totalFalsePositives,
    totalFalseNegatives,
    macroAgreementRate,
    microAgreementRate,
    macroHealthStatus: getHealthStatus(macroAgreementRate),
    microHealthStatus: getHealthStatus(microAgreementRate),
    calibratedCriteriaCount,
    totalCriteriaCount: metrics.length,
  };
}
