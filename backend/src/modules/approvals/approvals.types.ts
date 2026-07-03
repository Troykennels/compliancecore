export type ApprovalStatus =
  | 'draft' | 'pending' | 'approved' | 'rejected'
  | 'cancelled' | 'withdrawn' | 'changes_requested';

export type ApprovalStepStatus =
  | 'pending' | 'active' | 'approved' | 'rejected' | 'skipped' | 'changes_requested';

export type ApprovalDecision = 'approved' | 'rejected' | 'changes_requested' | 'abstained';

export type ApproverType = 'user' | 'role' | 'manager' | 'any_from_list';

export type ApprovalPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ApprovalWorkflow {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  steps?: ApprovalWorkflowStep[];
}

export interface ApprovalWorkflowStep {
  id: string;
  workflowId: string;
  stepOrder: number;
  name: string;
  approverType: ApproverType;
  approverId: string | null;
  approverRole: string | null;
  approverUserList: string[];
  minApprovals: number;
  deadlineHours: number | null;
  allowSelfApproval: boolean;
  requireSignature: boolean;
  instructions: string | null;
}

export interface ApprovalRequest {
  id: string;
  workflowId: string | null;
  title: string;
  description: string | null;
  entityType: string;
  entityId: string | null;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  currentStep: number;
  totalSteps: number;
  requestedBy: string;
  requesterName: string | null;
  requesterEmail: string | null;
  deadline: string | null;
  submittedAt: string;
  completedAt: string | null;
  rejectionReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  steps?: ApprovalRequestStep[];
}

export interface ApprovalRequestStep {
  id: string;
  requestId: string;
  workflowStepId: string | null;
  stepOrder: number;
  name: string;
  status: ApprovalStepStatus;
  approverType: ApproverType;
  assignedTo: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assignedRole: string | null;
  decidedBy: string | null;
  deciderName: string | null;
  decision: ApprovalDecision | null;
  comments: string | null;
  digitalSignatureId: string | null;
  requireSignature: boolean;
  instructions: string | null;
  activatedAt: string | null;
  decidedAt: string | null;
  deadline: string | null;
  createdAt: string;
}

export interface CreateWorkflowDto {
  name: string;
  description?: string;
  entityType: string;
  steps: CreateWorkflowStepDto[];
}

export interface CreateWorkflowStepDto {
  stepOrder: number;
  name: string;
  approverType: ApproverType;
  approverId?: string;
  approverRole?: string;
  approverUserList?: string[];
  minApprovals?: number;
  deadlineHours?: number;
  allowSelfApproval?: boolean;
  requireSignature?: boolean;
  instructions?: string;
}

export interface CreateApprovalRequestDto {
  workflowId?: string;
  title: string;
  description?: string;
  entityType: string;
  entityId?: string;
  priority?: ApprovalPriority;
  deadline?: string;
  metadata?: Record<string, unknown>;
  steps?: CreateAdHocStepDto[];
}

export interface CreateAdHocStepDto {
  stepOrder: number;
  name: string;
  approverType: ApproverType;
  assignedTo?: string;
  assignedRole?: string;
  requireSignature?: boolean;
  instructions?: string;
  deadlineHours?: number;
}

export interface DecideApprovalDto {
  decision: ApprovalDecision;
  comments?: string;
  signatureImageBase64?: string;
  documentHash?: string;
}

export interface ApprovalListFilters {
  status?: ApprovalStatus;
  entityType?: string;
  priority?: ApprovalPriority;
  requestedBy?: string;
  assignedToMe?: boolean;
  page?: number;
  limit?: number;
  q?: string;
}
