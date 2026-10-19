import type {
  WorkflowProcessInstance,
  WorkflowOverviewMetrics,
  WorkflowStageItem,
  WorkflowStatus,
} from "@/types/workflows";

function roundTo(num: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export function computeProgressPercent(stages: WorkflowStageItem[]): number {
  if (!stages || stages.length === 0) {
    return 0;
  }
  const completedCount = stages.filter((stage) => stage.status === "completed").length;
  return Math.round((completedCount / stages.length) * 100);
}

export function computeWorkflowOverview(
  instances: WorkflowProcessInstance[],
): WorkflowOverviewMetrics {
  const statusDistribution: Record<WorkflowStatus, number> = {
    in_progress: 0,
    waiting_approval: 0,
    approved: 0,
    rejected: 0,
    completed: 0,
    cancelled: 0,
  };

  const groupDistribution: Record<string, number> = {};

  if (!instances || instances.length === 0) {
    return {
      totalInstances: 0,
      activeInstances: 0,
      completedInstances: 0,
      pendingApprovalsCount: 0,
      avgLeadTimeHours: 0,
      slaCompliancePercent: 0,
      statusDistribution,
      groupDistribution,
    };
  }

  let activeInstances = 0;
  let completedInstances = 0;
  let pendingApprovalsCount = 0;
  let compliantCount = 0;
  let sumLeadTime = 0;
  let leadTimeCount = 0;

  for (const instance of instances) {
    if (instance.status in statusDistribution) {
      statusDistribution[instance.status] += 1;
    }

    if (instance.assignedGroup) {
      groupDistribution[instance.assignedGroup] =
        (groupDistribution[instance.assignedGroup] ?? 0) + 1;
    }

    if (
      instance.status !== "completed" &&
      instance.status !== "cancelled" &&
      instance.status !== "rejected"
    ) {
      activeInstances += 1;
    }

    if (instance.status === "completed") {
      completedInstances += 1;
    }

    if (Array.isArray(instance.approvals)) {
      for (const approval of instance.approvals) {
        if (approval.status === "pending") {
          pendingApprovalsCount += 1;
        }
      }
    }

    if (!instance.slaBreached) {
      compliantCount += 1;
    }

    if (typeof instance.leadTimeHours === "number" && instance.leadTimeHours > 0) {
      sumLeadTime += instance.leadTimeHours;
      leadTimeCount += 1;
    }
  }

  const avgLeadTimeHours =
    leadTimeCount > 0 ? roundTo(sumLeadTime / leadTimeCount, 1) : 0;
  const slaCompliancePercent = roundTo(
    (compliantCount / instances.length) * 100,
    1,
  );

  return {
    totalInstances: instances.length,
    activeInstances,
    completedInstances,
    pendingApprovalsCount,
    avgLeadTimeHours,
    slaCompliancePercent,
    statusDistribution,
    groupDistribution,
  };
}
