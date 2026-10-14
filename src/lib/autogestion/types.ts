export interface AutogestionRuleCondition {
  label: string;
  description: string;
  required: boolean;
}

export interface AutogestionRuleDoc {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive";
  intervalMinutes: number;
  triggerEvent: string;
  priority?: number;
  conditions: AutogestionRuleCondition[];
  effect: string;
  updatedAt: string;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  ticketId: number;
  ticketNumber: string;
  matchesCategory: boolean;
  isMdaOperator: boolean;
  isOperatorAvailable: boolean;
  canAssign: boolean;
  skipQueueUpdate?: boolean;
  customComment?: string;
  reason?: string;
  targetOperator?: {
    agentId: number;
    invgateId?: number;
    nombre: string;
    username?: string;
    disponible?: boolean;
    asignableAgs?: boolean;
    lastAutogestionAssignedAt?: number | null;
  };
}

export interface AutoAssignmentExecutionResult {
  success: boolean;
  ticketId: number;
  ticketNumber: string;
  assignedTo?: string;
  agentId?: number;
  ruleId: string;
  error?: string;
}
