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
  isReclamoNovedad = false,
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

  let section1Score = 0;
  let section2Score = 0;
  let totalScore = 0;

  if (channel === "wise_call") {
    const s1Raw = Math.max(0, 45 - s1Deductions);
    section1Score = Math.round((s1Raw / 45) * 100);
    if (hasSection2) {
      if (isReclamoNovedad) {
        section2Score = 100;
        totalScore = s1Raw + 55;
      } else {
        const s2Raw = Math.max(0, 55 - s2Deductions);
        section2Score = Math.round((s2Raw / 55) * 100);
        totalScore = s1Raw + s2Raw;
      }
    } else {
      section2Score = 0;
      totalScore = section1Score;
    }
  } else {
    section1Score = Math.max(0, 100 - s1Deductions);
    if (hasSection2) {
      if (isReclamoNovedad) {
        section2Score = 100;
        totalScore = Math.round((section1Score + 100) / 2);
      } else {
        section2Score = Math.max(0, 100 - s2Deductions);
        totalScore = Math.round((section1Score + section2Score) / 2);
      }
    } else {
      section2Score = 0;
      totalScore = section1Score;
    }
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

export interface ChannelAveragesResult {
  wiseCallsAvg: number | null;
  wiseCallsCount: number;
  wiseEmailsAvg: number | null;
  wiseEmailsCount: number;
  invgateTicketAvg: number | null;
  invgateTicketCount: number;
  totalCount: number;
  overallAvg: number | null;
}

export function calculateChannelAverages(
  audits: { channelType?: string; totalScore?: number | null }[],
): ChannelAveragesResult {
  const calls = audits.filter(
    (a) => (a.channelType || "wise_call") === "wise_call",
  );
  const emails = audits.filter((a) => a.channelType === "wise_email");
  const tickets = audits.filter((a) => a.channelType === "invgate_ticket");

  const calcAvg = (items: { totalScore?: number | null }[]) => {
    const validScores = items
      .map((i) => (typeof i.totalScore === "number" ? i.totalScore : null))
      .filter((s): s is number => s !== null);
    if (validScores.length === 0) return null;
    return Math.round(
      validScores.reduce((sum, s) => sum + s, 0) / validScores.length,
    );
  };

  const wiseCallsAvg = calcAvg(calls);
  const wiseEmailsAvg = calcAvg(emails);
  const invgateTicketAvg = calcAvg(tickets);

  const allValidScores = audits
    .map((a) => (typeof a.totalScore === "number" ? a.totalScore : null))
    .filter((s): s is number => s !== null);

  const overallAvg =
    allValidScores.length > 0
      ? Math.round(
          allValidScores.reduce((sum, s) => sum + s, 0) / allValidScores.length,
        )
      : null;

  return {
    wiseCallsAvg,
    wiseCallsCount: calls.length,
    wiseEmailsAvg,
    wiseEmailsCount: emails.length,
    invgateTicketAvg,
    invgateTicketCount: tickets.length,
    totalCount: audits.length,
    overallAvg,
  };
}

export function formatChannelAverageScore(avg: number | null | undefined): string {
  if (avg === null || avg === undefined || isNaN(avg)) return "--";
  return `${Math.round(avg)}%`;
}

export function getChannelAverageBadgeClass(avg: number | null | undefined): string {
  if (avg === null || avg === undefined || isNaN(avg)) {
    return "badge badge-xs badge-ghost";
  }
  if (avg >= 85) {
    return "badge badge-xs badge-success text-success-content font-bold";
  }
  if (avg >= 70) {
    return "badge badge-xs badge-warning text-warning-content font-bold";
  }
  return "badge badge-xs badge-error text-error-content font-bold";
}

