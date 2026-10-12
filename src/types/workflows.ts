export type WorkflowStatus =
  | "in_progress"
  | "waiting_approval"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled";

export interface WorkflowStageItem {
  id: string;
  name: string;
  order: number;
  status: "pending" | "current" | "completed" | "skipped";
  completedAt?: string;
}

export interface WorkflowApprovalItem {
  id: string;
  title: string;
  approverName: string;
  approverRole?: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  decidedAt?: string;
  comments?: string;
}

export interface WorkflowChildTicket {
  id: number;
  prettyId: string;
  title: string;
  assignedGroup: string;
  status: "open" | "in_progress" | "solved" | "closed";
  createdAt: string;
  solvedAt?: string;
}

export interface WorkflowProcessInstance {
  id: number;
  prettyId: string;
  title: string;
  status: WorkflowStatus;
  statusLabel: string;
  assignedGroup: string;
  creatorName: string;
  createdAt: string;
  solvedAt?: string;
  closedAt?: string;
  leadTimeHours?: number;
  slaBreached: boolean;
  progressPercent: number;
  stages: WorkflowStageItem[];
  approvals: WorkflowApprovalItem[];
  childTickets: WorkflowChildTicket[];
  notes?: string;
}

export interface WorkflowConfig {
  slug: string;
  name: string;
  description: string;
  viewId?: number;
  icon: string;
}

export interface WorkflowOverviewMetrics {
  totalInstances: number;
  activeInstances: number;
  completedInstances: number;
  pendingApprovalsCount: number;
  avgLeadTimeHours: number;
  slaCompliancePercent: number;
  statusDistribution: Record<WorkflowStatus, number>;
  groupDistribution: Record<string, number>;
}

export interface WorkflowReportData {
  config: WorkflowConfig;
  overview: WorkflowOverviewMetrics;
  instances: WorkflowProcessInstance[];
  cachedAt: string;
}
