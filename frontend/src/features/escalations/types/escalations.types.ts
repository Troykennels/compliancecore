export type EscalationTrigger = 'task_overdue' | 'approval_pending' | 'expiry_approaching' | 'control_overdue';
export type EscalationAction  = 'notify' | 'notify_role' | 'reassign' | 'create_task';
export type EscalationEventStatus = 'active' | 'resolved' | 'cancelled' | 'completed';

export interface EscalationChainStep {
  delayHours:  number;
  action:      EscalationAction;
  targetType?: 'user' | 'role';
  targetId?:   string;
  targetRole?: string;
  message?:    string;
}

export interface EscalationConditions {
  overdueHours?:    number;
  pendingHours?:    number;
  expiryDays?:      number;
  entityType?:      string;
  priority?:        string;
}

export interface EscalationRule {
  id:               string;
  name:             string;
  description:      string | null;
  triggerType:      EscalationTrigger;
  conditions:       EscalationConditions;
  escalationChain:  EscalationChainStep[];
  isActive:         boolean;
  createdAt:        string;
  updatedAt:        string;
}

export interface EscalationEvent {
  id:                string;
  ruleId:            string;
  ruleName:          string | null;
  entityType:        string;
  entityId:          string;
  status:            EscalationEventStatus;
  currentChainStep:  number;
  nextEscalationAt:  string | null;
  resolvedAt:        string | null;
  resolutionNote:    string | null;
  createdAt:         string;
  updatedAt:         string;
}

export interface CreateEscalationRuleDto {
  name:            string;
  description?:    string;
  triggerType:     EscalationTrigger;
  conditions:      EscalationConditions;
  escalationChain: EscalationChainStep[];
}

export interface EscalationFilters {
  isActive?:    boolean;
  triggerType?: EscalationTrigger;
  page?:        number;
  limit?:       number;
}

export interface EscalationEventFilters {
  status?:     EscalationEventStatus;
  ruleId?:     string;
  entityType?: string;
  page?:       number;
  limit?:      number;
}

export const TRIGGER_CONFIG: Record<EscalationTrigger, { label: string; color: string }> = {
  task_overdue:         { label: 'Task Overdue',          color: 'text-red-700' },
  approval_pending:     { label: 'Approval Pending',      color: 'text-amber-700' },
  expiry_approaching:   { label: 'Expiry Approaching',    color: 'text-orange-700' },
  control_overdue:      { label: 'Control Review Overdue',color: 'text-purple-700' },
};

export const ACTION_CONFIG: Record<EscalationAction, { label: string; color: string }> = {
  notify:      { label: 'Notify User',  color: 'text-blue-700' },
  notify_role: { label: 'Notify Role',  color: 'text-indigo-700' },
  reassign:    { label: 'Reassign',     color: 'text-purple-700' },
  create_task: { label: 'Create Task',  color: 'text-green-700' },
};
