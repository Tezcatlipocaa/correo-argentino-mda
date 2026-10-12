import type { HelpdeskMetricsItem, HelpdesksOverviewMetrics } from "@/types/helpdesks";

export function computeInOutRatio(incoming: number, resolved: number): number {
  if (incoming <= 0) {
    return 0;
  }
  return Number((resolved / incoming).toFixed(2));
}

export function computeHelpdesksOverview(items: HelpdeskMetricsItem[]): HelpdesksOverviewMetrics {
  if (items.length === 0) {
    return {
      totalHelpdesks: 0,
      totalActiveTickets: 0,
      totalWaitingTickets: 0,
      totalResolvedMonth: 0,
      globalSlaCompliancePercent: 0,
      globalAvgCsat: 0,
      globalInOutRatio: 0,
    };
  }

  let totalActive = 0;
  let totalWaiting = 0;
  let totalResolved = 0;
  let totalIncoming = 0;
  let sumSlaResolution = 0;
  let sumCsat = 0;

  for (const item of items) {
    totalActive += item.backlog?.active ?? 0;
    totalWaiting += item.backlog?.waiting ?? 0;
    totalResolved += item.resolvedTicketsMonth ?? 0;
    totalIncoming += item.incomingTicketsMonth ?? 0;
    sumSlaResolution += item.serviceTimes?.slaResolutionCompliancePercent ?? 0;
    sumCsat += item.csat?.averageRating ?? 0;
  }

  const globalInOutRatio = computeInOutRatio(totalIncoming, totalResolved);
  const globalSlaCompliancePercent = Number((sumSlaResolution / items.length).toFixed(1));
  const globalAvgCsat = Number((sumCsat / items.length).toFixed(1));

  return {
    totalHelpdesks: items.length,
    totalActiveTickets: totalActive,
    totalWaitingTickets: totalWaiting,
    totalResolvedMonth: totalResolved,
    globalSlaCompliancePercent,
    globalAvgCsat,
    globalInOutRatio,
  };
}
