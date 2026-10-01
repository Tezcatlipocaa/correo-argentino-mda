import { QUALITY_CONFIG } from "@/config/quality";
import type { AuditParameter, ChannelType, EvaluationParameter } from "@/types/quality";

export interface MultiChannelScoreResult {
  section1Score: number;
  section2Score: number;
  totalScore: number;
}

export function calculateMultiChannelAuditScores(
  channel: ChannelType,
  parameters: (EvaluationParameter | AuditParameter)[],
  compliantIdsOrCodes: Set<number | string>,
  hasSection2: boolean,
  isCriticalFailure = false,
): MultiChannelScoreResult {
  let s1Deductions = 0;
  let s2Deductions = 0;

  for (const p of parameters) {
    // Si weight es null o 0, no deduce (ej. 'Solicitud' n/a)
    if (typeof p.weight !== "number" || p.weight <= 0) continue;

    const isCompliant =
      (p.id !== undefined && compliantIdsOrCodes.has(p.id)) ||
      (p.id !== undefined && compliantIdsOrCodes.has(String(p.id))) ||
      compliantIdsOrCodes.has(p.code);

    if (!isCompliant) {
      const section = "section" in p ? p.section : p.category === "Items" || p.category === "Interacción con Usuario" ? "items" : "ticket";

      if (section === "items") {
        s1Deductions += p.weight;
      } else {
        s2Deductions += p.weight;
      }
    }
  }

  const section1Score = Math.max(0, 100 - s1Deductions);
  const section2Score = hasSection2 ? Math.max(0, 100 - s2Deductions) : 0;

  let totalScore: number;
  if (hasSection2) {
    totalScore = Math.round((section1Score + section2Score) / 2);
  } else {
    totalScore = section1Score;
  }

  if (isCriticalFailure) {
    totalScore = Math.round(totalScore * (QUALITY_CONFIG.criticalFailurePenaltyMultiplier ?? 0.5));
  }

  return {
    section1Score,
    section2Score,
    totalScore,
  };
}

export interface OperatorChannelStats {
  wiseCallsAvg: number;
  wiseCallsCount: number;
  wiseEmailsAvg: number;
  wiseEmailsCount: number;
  invgateAgAvg: number;
  invgateAgCount: number;
  totalAuditsCount: number;
  globalAverage: number;
  quotaFulfilled: boolean;
}

export function calculateOperatorChannelStats(audits: { channelType?: string; totalScore: number }[]): OperatorChannelStats {
  const calls = audits.filter((a) => (a.channelType ?? "wise_call") === "wise_call");
  const emails = audits.filter((a) => a.channelType === "wise_email");
  const ags = audits.filter((a) => a.channelType === "invgate_ticket");

  const calcAvg = (items: { totalScore: number }[]) =>
    items.length > 0 ? Math.round(items.reduce((s, a) => s + a.totalScore, 0) / items.length) : 0;

  const wiseCallsAvg = calcAvg(calls);
  const wiseEmailsAvg = calcAvg(emails);
  const invgateAgAvg = calcAvg(ags);

  // Promedio global: promedio de los promedios de los canales con evaluaciones
  const activeAvgs: number[] = [];
  if (calls.length > 0) activeAvgs.push(wiseCallsAvg);
  if (emails.length > 0) activeAvgs.push(wiseEmailsAvg);
  if (ags.length > 0) activeAvgs.push(invgateAgAvg);

  const globalAverage = activeAvgs.length > 0
    ? Math.round(activeAvgs.reduce((s, v) => s + v, 0) / activeAvgs.length)
    : 0;

  const quotaFulfilled = calls.length >= 4 && emails.length >= 4 && ags.length >= 4;

  return {
    wiseCallsAvg,
    wiseCallsCount: calls.length,
    wiseEmailsAvg,
    wiseEmailsCount: emails.length,
    invgateAgAvg,
    invgateAgCount: ags.length,
    totalAuditsCount: audits.length,
    globalAverage,
    quotaFulfilled,
  };
}

// Legacy helper for backward compatibility
export function calculateAuditScores(
  parameters: AuditParameter[],
  checkedParameterIdsOrCodes: Set<number | string>,
  isCriticalFailure: boolean,
) {
  return calculateMultiChannelAuditScores(
    "wise_call",
    parameters,
    checkedParameterIdsOrCodes,
    true,
    isCriticalFailure,
  );
}
