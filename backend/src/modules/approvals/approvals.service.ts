import * as repo from './approvals.repository';
import { notificationService } from '../notifications/notification.service';
import { sendEmail, emailTemplates } from '../../lib/email.service';
import type {
  CreateWorkflowDto, CreateApprovalRequestDto,
  DecideApprovalDto, ApprovalListFilters,
} from './approvals.types';
import { AppError } from '../../lib/errors';

export async function listWorkflows(schemaName: string) {
  return repo.findWorkflows(schemaName);
}

export async function getWorkflow(schemaName: string, id: string) {
  const wf = await repo.findWorkflowById(schemaName, id);
  if (!wf) throw new AppError('Workflow not found', 404);
  return wf;
}

export async function createWorkflow(schemaName: string, dto: CreateWorkflowDto, userId: string) {
  const id = await repo.createWorkflow(schemaName, dto, userId);
  return repo.findWorkflowById(schemaName, id);
}

export async function updateWorkflow(schemaName: string, id: string, dto: Partial<CreateWorkflowDto>) {
  const existing = await repo.findWorkflowById(schemaName, id);
  if (!existing) throw new AppError('Workflow not found', 404);
  await repo.updateWorkflow(schemaName, id, dto);
  return repo.findWorkflowById(schemaName, id);
}

export async function deleteWorkflow(schemaName: string, id: string) {
  const existing = await repo.findWorkflowById(schemaName, id);
  if (!existing) throw new AppError('Workflow not found', 404);
  await repo.softDeleteWorkflow(schemaName, id);
}

// ── Approval Requests ─────────────────────────────────────────

export async function listRequests(schemaName: string, filters: ApprovalListFilters, currentUserId: string) {
  return repo.findRequests(schemaName, filters, currentUserId);
}

export async function getRequest(schemaName: string, id: string) {
  const req = await repo.findRequestById(schemaName, id);
  if (!req) throw new AppError('Approval request not found', 404);
  return req;
}

export async function createRequest(
  schemaName: string,
  dto: CreateApprovalRequestDto,
  userId: string,
  userEmail: string,
) {
  let stepsInput: any[] = [];

  if (dto.workflowId) {
    const wf = await repo.findWorkflowById(schemaName, dto.workflowId);
    if (!wf) throw new AppError('Workflow not found', 404);
    stepsInput = (wf.steps ?? []).map((s) => ({
      stepOrder:        s.stepOrder,
      name:             s.name,
      approverType:     s.approverType,
      assignedTo:       s.approverId ?? null,
      assignedRole:     s.approverRole ?? null,
      requireSignature: s.requireSignature,
      instructions:     s.instructions ?? null,
      deadlineHours:    s.deadlineHours ?? null,
    }));
  } else if (dto.steps && dto.steps.length > 0) {
    stepsInput = dto.steps.map((s) => ({
      stepOrder:        s.stepOrder,
      name:             s.name,
      approverType:     s.approverType,
      assignedTo:       s.assignedTo ?? null,
      assignedRole:     s.assignedRole ?? null,
      requireSignature: s.requireSignature ?? false,
      instructions:     s.instructions ?? null,
      deadlineHours:    s.deadlineHours ?? null,
    }));
  } else {
    throw new AppError('Either workflowId or at least one step is required', 400);
  }

  const id = await repo.createRequest(schemaName, dto, userId, stepsInput);

  // Notify first-step approvers
  const firstStepOrder = Math.min(...stepsInput.map((s) => s.stepOrder));
  const firstSteps = stepsInput.filter((s) => s.stepOrder === firstStepOrder);
  for (const step of firstSteps) {
    if (step.assignedTo) {
      await notificationService.createForUser(schemaName, {
        userId:           step.assignedTo,
        title:            `Approval needed: ${dto.title}`,
        body:          `${step.name} — your approval is required.`,
        notificationType: 'approval_requested',
        priority:         dto.priority ?? 'medium',
        referenceType:    'approval_request',
        referenceId:      id,
        actionUrl:        `/approvals/${id}`,
      });
    }
  }

  return repo.findRequestById(schemaName, id);
}

export async function decideRequest(
  schemaName: string,
  requestId: string,
  decidingUserId: string,
  decidingUserName: string,
  decidingUserEmail: string,
  dto: DecideApprovalDto,
  ipAddress: string,
  userAgent: string,
) {
  // Read for the 404 / requester details used by post-commit notifications.
  const request = await repo.findRequestById(schemaName, requestId);
  if (!request) throw new AppError('Approval request not found', 404);
  if (request.status !== 'pending') throw new AppError('Request is no longer pending', 409);

  const signature = (dto.signatureImageBase64 && dto.documentHash)
    ? {
        documentHash:   dto.documentHash,
        signatureImage: dto.signatureImageBase64,
        ipAddress,
        userAgent,
      }
    : null;

  // The entire decision (lock, validate, sign, update, advance) runs atomically
  // in one row-locked transaction inside the repository.
  const outcome = await repo.decideRequestTx(
    schemaName, requestId, decidingUserId, dto.decision, dto.comments ?? null, signature,
  );

  // Notifications / emails run AFTER commit — they are side effects, not part of
  // the state transition, and must not hold the row lock or roll it back.
  if (outcome.requestStatus === 'approved'
      || outcome.requestStatus === 'rejected'
      || outcome.requestStatus === 'changes_requested') {
    await _notifyRequester(schemaName, request, outcome.requestStatus, decidingUserName, dto.comments);
  } else if (outcome.activatedNextStep) {
    for (const assignee of outcome.nextStepAssignees) {
      await notificationService.createForUser(schemaName, {
        userId:           assignee.userId,
        title:            `Approval needed: ${request.title}`,
        body:             `Step ${assignee.stepName} — your approval is required.`,
        notificationType: 'approval_requested',
        priority:         request.priority,
        referenceType:    'approval_request',
        referenceId:      requestId,
        actionUrl:        `/approvals/${requestId}`,
      });
    }
  }
}

export async function cancelRequest(schemaName: string, requestId: string, userId: string, reason?: string) {
  const request = await repo.findRequestById(schemaName, requestId);
  if (!request) throw new AppError('Approval request not found', 404);
  if (request.requestedBy !== userId) throw new AppError('Only the requester can cancel', 403);
  if (!['pending', 'draft'].includes(request.status)) throw new AppError('Cannot cancel completed request', 400);
  await repo.cancelRequest(schemaName, requestId, reason);
}

export async function getMyPending(schemaName: string, userId: string, userRole: string) {
  return repo.getMyPendingRequests(schemaName, userId, userRole);
}

// ── Internal helpers ──────────────────────────────────────────

async function _notifyRequester(
  schemaName: string,
  request: any,
  decision: string,
  decidedBy: string,
  comments?: string,
) {
  await notificationService.createForUser(schemaName, {
    userId:           request.requestedBy,
    title:            `Approval ${decision}: ${request.title}`,
    body:          comments ?? `Your request was ${decision} by ${decidedBy}.`,
    notificationType: 'approval_decided',
    priority:         decision === 'approved' ? 'medium' : 'high',
    referenceType:    'approval_request',
    referenceId:      request.id,
    actionUrl:        `/approvals/${request.id}`,
  });

  if (request.requesterEmail) {
    const tmpl = emailTemplates.approvalDecided({
      recipientName: request.requesterName ?? request.requesterEmail,
      requestTitle:  request.title,
      decision,
      decidedBy,
      comments,
      requestId:     request.id,
    });
    sendEmail({ to: request.requesterEmail, ...tmpl }).catch(() => {});
  }
}
