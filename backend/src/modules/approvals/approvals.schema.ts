import { z } from 'zod';

const approverType = z.enum(['user', 'role', 'manager', 'any_from_list']);
const priority     = z.enum(['critical', 'high', 'medium', 'low']).default('medium');

const workflowStepSchema = z.object({
  stepOrder:         z.number().int().min(1),
  name:              z.string().min(1).max(500),
  approverType:      approverType,
  approverId:        z.string().uuid().optional(),
  approverRole:      z.string().max(100).optional(),
  approverUserList:  z.array(z.string().uuid()).optional(),
  minApprovals:      z.number().int().min(1).default(1),
  deadlineHours:     z.number().int().positive().optional(),
  allowSelfApproval: z.boolean().default(false),
  requireSignature:  z.boolean().default(false),
  instructions:      z.string().max(5000).optional(),
});

export const createWorkflowSchema = z.object({
  name:        z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  entityType:  z.string().min(1).max(100),
  steps:       z.array(workflowStepSchema).min(1),
});

export const updateWorkflowSchema = createWorkflowSchema.partial();

export const adHocStepSchema = z.object({
  stepOrder:        z.number().int().min(1),
  name:             z.string().min(1).max(500),
  approverType:     approverType,
  assignedTo:       z.string().uuid().optional(),
  assignedRole:     z.string().max(100).optional(),
  requireSignature: z.boolean().default(false),
  instructions:     z.string().max(5000).optional(),
  deadlineHours:    z.number().int().positive().optional(),
});

export const createApprovalRequestSchema = z.object({
  workflowId:  z.string().uuid().optional(),
  title:       z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  entityType:  z.string().min(1).max(100),
  entityId:    z.string().uuid().optional(),
  priority,
  deadline:    z.string().datetime().optional(),
  metadata:    z.record(z.unknown()).optional(),
  steps:       z.array(adHocStepSchema).optional(),
});

export const decideApprovalSchema = z.object({
  decision:              z.enum(['approved', 'rejected', 'changes_requested', 'abstained']),
  comments:              z.string().max(5000).optional(),
  signatureImageBase64:  z.string().optional(),
  documentHash:          z.string().length(64).optional(),
});

export const listApprovalRequestsSchema = z.object({
  status:       z.enum(['draft','pending','approved','rejected','cancelled','withdrawn','changes_requested']).optional(),
  entityType:   z.string().optional(),
  priority:     z.enum(['critical','high','medium','low']).optional(),
  requestedBy:  z.string().uuid().optional(),
  assignedToMe: z.coerce.boolean().optional(),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
  q:            z.string().optional(),
});
