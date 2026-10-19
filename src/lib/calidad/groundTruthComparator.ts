import type { QualityAiSnapshot } from "@/types/quality";

export type DiscrepancyClassification =
  | "acuerdo"
  | "falso_positivo"
  | "falso_negativo"
  | "sin_evidencia"
  | "fuera_de_scope";

export interface AuditEvaluationInput {
  id: number;
  date: string;
  channelType: string;
  ticketId: string;
  callId: string;
  operatorName: string;
  isReclamoNovedad: boolean;
  appliesMda: boolean;
  aiSnapshot?: QualityAiSnapshot | null;
}

export interface AuditScoreRow {
  auditId: number;
  parameterId: number;
  score: boolean;
  comment?: string | null;
}

export interface AuditParameterRow {
  id: number;
  code: string;
  name: string;
  section: string;
  channel: string;
}

export interface DiscrepancyRecord {
  auditId: number;
  date: string;
  channelType: string;
  ticketId: string;
  callId: string;
  operatorName: string;
  criterionCode: string;
  criterionName: string;
  model: string;
  aiVerdict: boolean | null;
  aiConfidence: number;
  aiEvidence: string;
  aiRationale: string;
  humanScore: boolean | null;
  humanComment: string | null;
  wasAppliedBySupervisor: boolean;
  classification: DiscrepancyClassification;
}

export interface CriterionCalibrationMetrics {
  criterionCode: string;
  criterionName: string;
  model: string;
  totalEvaluated: number; // N = acuerdo + FP + FN
  agreementCount: number;
  agreementRate: number; // (agreementCount / totalEvaluated) * 100
  falsePositiveCount: number;
  falseNegativeCount: number;
  sinEvidenciaCount: number;
  outOfScopeCount: number;
}

/**
 * Determina si un criterio específico está en el alcance evaluable de una auditoría.
 */
function isCriterionInScope(
  param: AuditParameterRow,
  audit: AuditEvaluationInput,
): boolean {
  // Canales distintos no cruzan
  if (param.channel !== audit.channelType) return false;

  const isSection2 =
    param.section === "ticket" ||
    param.section === "mda" ||
    param.section === "Gestión del Ticket";

  if (isSection2) {
    // Si la auditoría fue Reclamo/Novedad, Sección 2 no se evalúa individualmente
    if (audit.isReclamoNovedad) return false;
    // Si no aplica sección MDA/Ticket
    if (!audit.appliesMda) return false;
  }

  return true;
}

/**
 * Compara los veredictos de la IA contra la decisión humana del supervisor.
 * Sigue el orden estricto de 3 pasos:
 * 1. ¿En scope? (No -> fuera_de_scope, humanScore: null)
 * 2. En scope -> ¿hay fila en audit_scores? (No -> humanScore: false, Sí -> score)
 * 3. Contraste contra veredicto IA (null -> sin_evidencia, true/false matches)
 */
export function evaluateGroundTruth(
  audits: AuditEvaluationInput[],
  scores: AuditScoreRow[],
  parameters: AuditParameterRow[],
): DiscrepancyRecord[] {
  const paramsByCode = new Map<string, AuditParameterRow>();
  const paramsById = new Map<number, AuditParameterRow>();
  for (const p of parameters) {
    paramsByCode.set(p.code, p);
    paramsById.set(p.id, p);
  }

  // Indexar scores por auditId -> parameterId
  const scoreMap = new Map<string, AuditScoreRow>();
  for (const s of scores) {
    scoreMap.set(`${s.auditId}:${s.parameterId}`, s);
  }

  const discrepancies: DiscrepancyRecord[] = [];

  for (const audit of audits) {
    const snap = audit.aiSnapshot;
    if (!snap || !Array.isArray(snap.verdicts) || snap.verdicts.length === 0) {
      continue;
    }

    const appliedSet = new Set(snap.appliedCodes || []);

    for (const v of snap.verdicts) {
      const param = paramsByCode.get(v.codigo);
      const criterionName = param?.name || v.codigo;

      // 1. ¿En Scope?
      if (!param || !isCriterionInScope(param, audit)) {
        discrepancies.push({
          auditId: audit.id,
          date: audit.date,
          channelType: audit.channelType,
          ticketId: audit.ticketId,
          callId: audit.callId,
          operatorName: audit.operatorName,
          criterionCode: v.codigo,
          criterionName,
          model: snap.model,
          aiVerdict: v.cumple,
          aiConfidence: v.confianza || 0,
          aiEvidence: v.evidencia || "",
          aiRationale: v.razonamiento || "",
          humanScore: null,
          humanComment: null,
          wasAppliedBySupervisor: appliedSet.has(v.codigo),
          classification: "fuera_de_scope",
        });
        continue;
      }

      // 2. Evaluación humana en scope
      const scoreKey = `${audit.id}:${param.id}`;
      const scoreRow = scoreMap.get(scoreKey);
      const humanScore: boolean = scoreRow ? Boolean(scoreRow.score) : false;
      const humanComment: string | null = scoreRow?.comment || null;

      // 3. Contraste con IA
      let classification: DiscrepancyClassification;
      if (v.cumple === null) {
        classification = "sin_evidencia";
      } else if (v.cumple === humanScore) {
        classification = "acuerdo";
      } else if (v.cumple === true && humanScore === false) {
        classification = "falso_positivo";
      } else {
        classification = "falso_negativo";
      }

      discrepancies.push({
        auditId: audit.id,
        date: audit.date,
        channelType: audit.channelType,
        ticketId: audit.ticketId,
        callId: audit.callId,
        operatorName: audit.operatorName,
        criterionCode: v.codigo,
        criterionName,
        model: snap.model,
        aiVerdict: v.cumple,
        aiConfidence: v.confianza || 0,
        aiEvidence: v.evidencia || "",
        aiRationale: v.razonamiento || "",
        humanScore,
        humanComment,
        wasAppliedBySupervisor: appliedSet.has(v.codigo),
        classification,
      });
    }
  }

  return discrepancies;
}

/**
 * Calcula métricas agregadas por criterio y modelo con denominador estricto:
 * N = acuerdo + falso_positivo + falso_negativo
 */
export function calculateCalibrationMetrics(
  records: DiscrepancyRecord[],
): CriterionCalibrationMetrics[] {
  const groups = new Map<
    string,
    {
      criterionCode: string;
      criterionName: string;
      model: string;
      acuerdo: number;
      fp: number;
      fn: number;
      sinEvidencia: number;
      fueraScope: number;
    }
  >();

  for (const r of records) {
    const key = `${r.criterionCode}|${r.model}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        criterionCode: r.criterionCode,
        criterionName: r.criterionName,
        model: r.model,
        acuerdo: 0,
        fp: 0,
        fn: 0,
        sinEvidencia: 0,
        fueraScope: 0,
      };
      groups.set(key, g);
    }

    if (r.classification === "acuerdo") g.acuerdo++;
    else if (r.classification === "falso_positivo") g.fp++;
    else if (r.classification === "falso_negativo") g.fn++;
    else if (r.classification === "sin_evidencia") g.sinEvidencia++;
    else if (r.classification === "fuera_de_scope") g.fueraScope++;
  }

  const metrics: CriterionCalibrationMetrics[] = [];
  for (const g of groups.values()) {
    const totalEvaluated = g.acuerdo + g.fp + g.fn;
    const agreementRate =
      totalEvaluated > 0 ? Math.round((g.acuerdo / totalEvaluated) * 1000) / 10 : 0;

    metrics.push({
      criterionCode: g.criterionCode,
      criterionName: g.criterionName,
      model: g.model,
      totalEvaluated,
      agreementCount: g.acuerdo,
      agreementRate,
      falsePositiveCount: g.fp,
      falseNegativeCount: g.fn,
      sinEvidenciaCount: g.sinEvidencia,
      outOfScopeCount: g.fueraScope,
    });
  }

  return metrics.sort((a, b) => {
    const discA = a.falsePositiveCount + a.falseNegativeCount;
    const discB = b.falsePositiveCount + b.falseNegativeCount;
    if (discB !== discA) return discB - discA;
    if (b.totalEvaluated !== a.totalEvaluated) return b.totalEvaluated - a.totalEvaluated;
    return a.criterionCode.localeCompare(b.criterionCode);
  });
}
