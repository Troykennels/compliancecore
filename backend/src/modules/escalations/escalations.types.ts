export type EscalationTriggerType =
  | 'task_overdue'
  | 'approval_pending'
  | 'control_overdue'
  | 'expiry_approaching'
  | 'risk_unmitigated'
  | 'signature_missing';

export type EscalationAction =
  | 'notify'
  | 'notify_manager'
  | 'notify_role'
  | 'reassign'
  | 'create_task'
  | 'cancel_request';

export type EscalationTargetType = 'assignee' | 'requester' | 'user' | 'role' | 'manager';

export type EscalationEventStatus = 'active' | 'resolved' | 'cancelled' | 'completed';

export interface EscalationChainStep {
  delayHours:  number;
  action:      EscalationAction;
  targetType:  EscalationTargetType;
  targetId?:   string;
  targetRole?: string;
  message:     string;
}

export interface EscalationConditions {
  daysOverdue?:    number;
  daysPending?:    number;
  daysUntilExpiry?:number;
  priority?:       string[];
  status?:         string[];
}

export interface EscalationRule {
  id:              string;
  name:            string;
  description:     string | null;
  triggerType:     EscalationTriggerType;
  entityType:      string | null;
  conditions:      EscalationConditions;
  escalationChain: EscalationChainStep[];
  isActive:        boolean;
  createdBy:       string | null;
  createdAt:       string;
  updatedAt:       string;
}

export interface EscalationEvent {
  id:               string;
  ruleId:           string;
  ruleName:         string | null;
  entityType:       string;
  entityId:         string;
  triggeredAt:      string;
  currentChainStep: number;
  status:           EscalationEventStatus;
  nextEscalationAt: string | null;
  resolvedAt:       string | null;
  metadata:         Record<string, unknown>;
  createdAt:        string;
}

export interface CreateEscalationRuleDto {
  name:            string;
  description?:    string;
  triggerType:     EscalationTriggerType;
  entityType?:     string;
  conditions:      EscalationConditions;
  escalationChain: EscalationChainStep[];
}
