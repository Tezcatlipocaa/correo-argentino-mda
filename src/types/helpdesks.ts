export interface HelpdeskBacklog {
  active: number;
  waiting: number;
  closed: number;
  total: number;
}

export interface HelpdeskServiceTimes {
  firstReplyAvgMinutes: number;
  mttrAvgHours: number;
  slaFirstReplyCompliancePercent: number;
  slaResolutionCompliancePercent: number;
}

export interface HelpdeskCSAT {
  averageRating: number;
  totalResponses: number;
  positiveSentimentPercent: number;
  neutralSentimentPercent: number;
  negativeSentimentPercent: number;
}

export interface HelpdeskMetricsItem {
  id: number;
  name: string;
  displayName: string;
  isMainMda: boolean;
  totalMembers: number;
  incomingTicketsMonth: number;
  resolvedTicketsMonth: number;
  inOutRatio: number;
  backlog: HelpdeskBacklog;
  serviceTimes: HelpdeskServiceTimes;
  csat: HelpdeskCSAT;
}

export interface HelpdesksOverviewMetrics {
  totalHelpdesks: number;
  totalActiveTickets: number;
  totalWaitingTickets: number;
  totalResolvedMonth: number;
  globalSlaCompliancePercent: number;
  globalAvgCsat: number;
  globalInOutRatio: number;
}

export interface HelpdesksReportData {
  overview: HelpdesksOverviewMetrics;
  items: HelpdeskMetricsItem[];
  cachedAt: string;
  /**
   * `demo`: los números ticket/CSAT/SLA son sintéticos (seed por mesa) hasta que
   * exista el endpoint GET de métricas reales de InvGate.
   */
  dataSource: "demo" | "live";
}
