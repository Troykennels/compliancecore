import { withTenantSchema } from '../../lib/tenant';
import { AppError, ValidationError } from '../../lib/errors';
import { generateSignatureHash } from '../signatures/signatures.repository';
import type {
  ApprovalWorkflow, ApprovalWorkflowStep,
  ApprovalRequest, ApprovalRequestStep,
  CreateWorkflowDto, CreateApprovalRequestDto,
  ApprovalListFilters,
} from './approvals.types';

// ── Workflow templates ────────────────────────────────────────

export async function findWorkflows(schemaName: string): Promise<ApprovalWorkflow[]> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT aw.*, u.first_name || ' ' || u.last_name AS creator_name
      FROM approval_workflows aw
      LEFT JOIN global.users u ON u.id = aw.created_by
      WHERE aw.deleted_at IS NULL
      ORDER BY aw.created_at DESC
    `);
    return rows.map(mapWorkflow);
  });
}

export async function findWorkflowById(schemaName: string, id: string): Promise<(ApprovalWorkflow & { steps: ApprovalWorkflowStep[] }) | null> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT aw.* FROM approval_workflows aw WHERE aw.id = $1 AND aw.deleted_at IS NULL
    `, id);
    if (!rows.length) return null;
    const workflow = mapWorkflow(rows[0]);
    const steps = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM approval_workflow_steps WHERE workflow_id = $1 ORDER BY step_order
    `, id);
    return { ...workflow, steps: steps.map(mapWorkflowStep) };
  });
}

export async function createWorkflow(schemaName: string, dto: CreateWorkflowDto, userId: string): Promise<string> {
  return withTenantSchema(schemaName, async (prisma) => {
    const [wf] = await prisma.$queryRawUnsafe<any[]>(`
      INSERT INTO approval_workflows(name, description, entity_type, created_by)
      VALUES($1,$2,$3,$4) RETURNING id
    `, dto.name, dto.description ?? null, dto.entityType, userId);

    for (const step of dto.steps) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO approval_workflow_steps(workflow_id,step_order,name,approver_type,approver_id,approver_role,approver_user_list,min_approvals,deadline_hours,allow_self_approval,require_signature,instructions)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, wf.id, step.stepOrder, step.name, step.approverType,
        step.approverId ?? null, step.approverRole ?? null,
        step.approverUserList ? `{${step.approverUserList.join(',')}}` : '{}',
        step.minApprovals ?? 1, step.deadlineHours ?? null,
        step.allowSelfApproval ?? false, step.requireSignature ?? false,
        step.instructions ?? null,
      );
    }
    return wf.id as string;
  });
}

export async function updateWorkflow(schemaName: string, id: string, dto: Partial<CreateWorkflowDto>): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    if (dto.name || dto.description !== undefined || dto.entityType) {
      await prisma.$executeRawUnsafe(`
        UPDATE approval_workflows SET
          name        = COALESCE($2, name),
          description = COALESCE($3, description),
          entity_type = COALESCE($4, entity_type),
          updated_at  = NOW()
        WHERE id = $1 AND deleted_at IS NULL
      `, id, dto.name ?? null, dto.description ?? null, dto.entityType ?? null);
    }
    if (dto.steps) {
      await prisma.$executeRawUnsafe(`DELETE FROM approval_workflow_steps WHERE workflow_id = $1`, id);
      for (const step of dto.steps) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO approval_workflow_steps(workflow_id,step_order,name,approver_type,approver_id,approver_role,approver_user_list,min_approvals,deadline_hours,allow_self_approval,require_signature,instructions)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, id, step.stepOrder, step.name, step.approverType,
          step.approverId ?? null, step.approverRole ?? null,
          step.approverUserList ? `{${step.approverUserList.join(',')}}` : '{}',
          step.minApprovals ?? 1, step.deadlineHours ?? null,
          step.allowSelfApproval ?? false, step.requireSignature ?? false,
          step.instructions ?? null,
        );
      }
    }
  });
}

export async function softDeleteWorkflow(schemaName: string, id: string): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    await prisma.$executeRawUnsafe(`UPDATE approval_workflows SET deleted_at=NOW() WHERE id=$1`, id);
  });
}

// ── Approval Requests ─────────────────────────────────────────

export async function findRequests(
  schemaName: string,
  filters: ApprovalListFilters,
  currentUserId: string,
): Promise<{ requests: ApprovalRequest[]; total: number }> {
  return withTenantSchema(schemaName, async (prisma) => {
    const conditions: string[] = ['ar.deleted_at IS NULL'];
    const params: any[] = [];
    let p = 1;

    if (filters.status)     { conditions.push(`ar.status = $${p++}`);      params.push(filters.status); }
    if (filters.entityType) { conditions.push(`ar.entity_type = $${p++}`); params.push(filters.entityType); }
    if (filters.priority)   { conditions.push(`ar.priority = $${p++}`);    params.push(filters.priority); }
    if (filters.requestedBy){ conditions.push(`ar.requested_by = $${p++}`);params.push(filters.requestedBy); }
    if (filters.q) {
      conditions.push(`ar.title ILIKE $${p++}`);
      params.push(`%${filters.q}%`);
    }
    if (filters.assignedToMe) {
      conditions.push(`EXISTS (
        SELECT 1 FROM approval_request_steps ars
        WHERE ars.request_id = ar.id AND ars.assigned_to = $${p++} AND ars.status = 'active'
      )`);
      params.push(currentUserId);
    }

    const where = conditions.join(' AND ');
    const limit  = filters.limit  ?? 20;
    const offset = ((filters.page ?? 1) - 1) * limit;

    const [countRow] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS total FROM approval_requests ar WHERE ${where}`, ...params,
    );
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT ar.*,
             u.first_name || ' ' || u.last_name AS requester_name,
             u.email AS requester_email
      FROM approval_requests ar
      LEFT JOIN global.users u ON u.id = ar.requested_by
      WHERE ${where}
      ORDER BY ar.created_at DESC
      LIMIT $${p++} OFFSET $${p++}
    `, ...params, limit, offset);

    return { requests: rows.map(mapRequest), total: countRow.total };
  });
}

export async function findRequestById(schemaName: string, id: string): Promise<(ApprovalRequest & { steps: ApprovalRequestStep[] }) | null> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT ar.*,
             u.first_name || ' ' || u.last_name AS requester_name,
             u.email AS requester_email
      FROM approval_requests ar
      LEFT JOIN global.users u ON u.id = ar.requested_by
      WHERE ar.id = $1 AND ar.deleted_at IS NULL
    `, id);
    if (!rows.length) return null;
    const request = mapRequest(rows[0]);
    const steps = await prisma.$queryRawUnsafe<any[]>(`
      SELECT ars.*,
             u1.first_name || ' ' || u1.last_name AS assignee_name,
             u1.email AS assignee_email,
             u2.first_name || ' ' || u2.last_name AS decider_name
      FROM approval_request_steps ars
      LEFT JOIN global.users u1 ON u1.id = ars.assigned_to
      LEFT JOIN global.users u2 ON u2.id = ars.decided_by
      WHERE ars.request_id = $1
      ORDER BY ars.step_order
    `, id);
    return { ...request, steps: steps.map(mapRequestStep) };
  });
}

export async function createRequest(
  schemaName: string,
  dto: CreateApprovalRequestDto,
  userId: string,
  stepsInput: Array<{
    stepOrder: number; name: string; approverType: string;
    assignedTo: string | null; assignedRole: string | null;
    approverUserList: string[]; minApprovals: number; allowSelfApproval: boolean;
    requireSignature: boolean; instructions: string | null;
    deadlineHours: number | null;
  }>,
): Promise<string> {
  return withTenantSchema(schemaName, async (prisma) => {
    const [req] = await prisma.$queryRawUnsafe<any[]>(`
      INSERT INTO approval_requests(workflow_id,title,description,entity_type,entity_id,status,priority,total_steps,requested_by,deadline,metadata)
      VALUES($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10) RETURNING id
    `,
      dto.workflowId ?? null, dto.title, dto.description ?? null,
      dto.entityType, dto.entityId ?? null, dto.priority ?? 'medium',
      stepsInput.length, userId, dto.deadline ?? null,
      JSON.stringify(dto.metadata ?? {}),
    );
    const reqId = req.id as string;

    for (const step of stepsInput) {
      const isFirstStep = step.stepOrder === Math.min(...stepsInput.map((s) => s.stepOrder));
      const status = isFirstStep ? 'active' : 'pending';
      const activatedAt = isFirstStep ? 'NOW()' : 'NULL';
      let deadline = 'NULL';
      if (isFirstStep && step.deadlineHours) {
        deadline = `NOW() + INTERVAL '${step.deadlineHours} hours'`;
      }
      await prisma.$executeRawUnsafe(`
        INSERT INTO approval_request_steps(request_id,step_order,name,status,approver_type,assigned_to,assigned_role,approver_user_list,min_approvals,allow_self_approval,require_signature,instructions,activated_at,deadline)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,${activatedAt},${deadline})
      `,
        reqId, step.stepOrder, step.name, status, step.approverType,
        step.assignedTo, step.assignedRole,
        `{${(step.approverUserList ?? []).join(',')}}`,
        step.minApprovals, step.allowSelfApproval,
        step.requireSignature, step.instructions,
      );
    }
    return reqId;
  });
}

export async function updateStepDecision(
  schemaName: string,
  stepId: string,
  decidedBy: string,
  decision: string,
  comments: string | null,
  signatureId: string | null,
): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    await prisma.$executeRawUnsafe(`
      UPDATE approval_request_steps
      SET status = $2, decided_by = $3, decision = $4, comments = $5,
          digital_signature_id = $6, decided_at = NOW()
      WHERE id = $1
    `, stepId, decision, decidedBy, decision, comments, signatureId);
  });
}

// ── Atomic decision ───────────────────────────────────────────
// Records an approval/rejection and advances the request in ONE row-locked
// transaction. This is the correctness-critical path: without the lock +
// conditional update, two concurrent deciders (double-click, parallel
// approvers, or a decision racing the deadline job) could both pass a "still
// pending" check and corrupt the approval chain (request left both approved and
// rejected, or a step decided twice).

export interface DecideSignatureInput {
  documentHash:   string;
  signatureImage: string | null;
  ipAddress:      string;
  userAgent:      string;
}

export interface DecideOutcome {
  requestStatus:     'approved' | 'rejected' | 'changes_requested' | 'pending';
  signatureId:       string | null;
  activatedNextStep: boolean;
  nextStepAssignees: Array<{ userId: string; stepName: string }>;
}

export async function decideRequestTx(
  schemaName: string,
  requestId: string,
  decidingUserId: string,
  decidingUserRole: string | null,
  decision: 'approved' | 'rejected' | 'changes_requested' | 'abstained',
  comments: string | null,
  signature: DecideSignatureInput | null,
): Promise<DecideOutcome> {
  return withTenantSchema(schemaName, async (tx) => {
    // 1. Lock the request row for the duration of the transaction. Any other
    //    concurrent decision on the same request blocks here until we commit.
    const lockRows = await tx.$queryRawUnsafe<any[]>(`
      SELECT id, status, requested_by FROM approval_requests
      WHERE id = $1 AND deleted_at IS NULL
      FOR UPDATE
    `, requestId);
    if (!lockRows.length) throw new AppError('Approval request not found', 404);
    if (lockRows[0].status !== 'pending') {
      throw new AppError('Request is no longer pending', 409);
    }

    // 2. Find THIS user's active step. Authorisation is enforced per approver
    //    type: a direct assignee, a role step whose assigned_role matches the
    //    decider's role, or an any_from_list step whose candidate list contains
    //    the decider. A role step must never be decidable by someone whose role
    //    differs from assigned_role. (Manager steps have no manager model here,
    //    so they fall back to the direct-assignment clause.)
    const [activeStep] = await tx.$queryRawUnsafe<any[]>(`
      SELECT id, step_order, require_signature, allow_self_approval
      FROM approval_request_steps
      WHERE request_id = $1 AND status = 'active'
        AND (
          assigned_to = $2
          OR (approver_type = 'role' AND assigned_role = $3)
          OR (approver_type = 'any_from_list' AND $2 = ANY(approver_user_list))
        )
      ORDER BY step_order
      LIMIT 1
    `, requestId, decidingUserId, decidingUserRole);
    if (!activeStep) throw new AppError('No active approval step found for you', 403);

    // 2a. Separation of duties: the requester may not decide their own step
    //     unless the step explicitly allows self-approval.
    if (!activeStep.allow_self_approval && lockRows[0].requested_by === decidingUserId) {
      throw new AppError('You cannot decide your own approval request', 403);
    }

    // 2b. Steps flagged require_signature cannot be approved without a signature.
    if (activeStep.require_signature && decision === 'approved' && !signature) {
      throw new ValidationError('This approval step requires a digital signature.');
    }

    // 3. Optional digital signature — created inside the SAME transaction so the
    //    signature and the decision commit atomically (no orphan signatures).
    let signatureId: string | null = null;
    if (signature) {
      const signedAt = new Date().toISOString();
      const signatureHash = generateSignatureHash(
        'approval_step', activeStep.id, signature.documentHash, decidingUserId, signedAt,
      );
      const [u] = await tx.$queryRawUnsafe<any[]>(
        `SELECT first_name, last_name, email FROM global.users WHERE id = $1`, decidingUserId,
      );
      const certificateData = {
        version: '1.0', algorithm: 'HMAC-SHA256',
        signerName: u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : null,
        signerEmail: u?.email ?? null, signedAt,
        ipAddress: signature.ipAddress, userAgent: signature.userAgent,
        documentType: 'approval_step', documentId: activeStep.id,
      };
      const [sig] = await tx.$queryRawUnsafe<any[]>(`
        INSERT INTO digital_signatures(
          user_id, document_type, document_id, document_hash,
          signature_hash, signature_image, certificate_data, ip_address, user_agent, signed_at
        ) VALUES($1,'approval_step',$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id
      `,
        decidingUserId, activeStep.id, signature.documentHash, signatureHash,
        signature.signatureImage, JSON.stringify(certificateData),
        signature.ipAddress || null, signature.userAgent || null, signedAt,
      );
      signatureId = sig.id as string;
    }

    // 4. Conditional step update — only an 'active' step can be decided. A
    //    0-row result means it was already decided by a concurrent request.
    const stepStatus = decision; // approved | rejected | changes_requested | abstained
    const updated = await tx.$executeRawUnsafe(`
      UPDATE approval_request_steps
      SET status = $2, decided_by = $3, decision = $4, comments = $5,
          digital_signature_id = $6, decided_at = NOW()
      WHERE id = $1 AND status = 'active'
    `, activeStep.id, stepStatus, decidingUserId, decision, comments, signatureId);
    if (updated === 0) throw new AppError('This step has already been decided', 409);

    // 5. Terminal decisions end the whole request immediately.
    if (decision === 'rejected' || decision === 'changes_requested') {
      await tx.$executeRawUnsafe(`
        UPDATE approval_requests
        SET status = $2, rejection_reason = $3, completed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, requestId, decision, comments);
      return { requestStatus: decision, signatureId, activatedNextStep: false, nextStepAssignees: [] };
    }

    // 6. Approval: has the whole current step-order group been decided AND has it
    //    collected the required number of ACTUAL 'approved' decisions? Abstained
    //    or skipped steps count as "decided" but never as approvals, so a step
    //    that only abstains can never satisfy its minApprovals threshold.
    const steps = await tx.$queryRawUnsafe<any[]>(`
      SELECT id, step_order, status, assigned_to, name, min_approvals
      FROM approval_request_steps WHERE request_id = $1 ORDER BY step_order
    `, requestId);
    const group = steps.filter((s) => s.step_order === activeStep.step_order);
    const allDecided    = group.every((s) => ['approved', 'abstained', 'skipped'].includes(s.status));
    const approvedCount = group.filter((s) => s.status === 'approved').length;
    const minApprovals  = Math.max(1, ...group.map((s) => Number(s.min_approvals) || 1));
    const groupDone = allDecided && approvedCount >= minApprovals;
    if (!groupDone) {
      return { requestStatus: 'pending', signatureId, activatedNextStep: false, nextStepAssignees: [] };
    }

    // 7. Advance to the next step group, or finalise as approved.
    const orders = [...new Set(steps.map((s) => s.step_order as number))].sort((a, b) => a - b);
    const nextOrder = orders[orders.indexOf(activeStep.step_order) + 1];
    if (nextOrder === undefined) {
      await tx.$executeRawUnsafe(`
        UPDATE approval_requests
        SET status = 'approved', completed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, requestId);
      return { requestStatus: 'approved', signatureId, activatedNextStep: false, nextStepAssignees: [] };
    }

    await tx.$executeRawUnsafe(`
      UPDATE approval_request_steps
      SET status = 'active', activated_at = NOW()
      WHERE request_id = $1 AND step_order = $2 AND status = 'pending'
    `, requestId, nextOrder);
    await tx.$executeRawUnsafe(`
      UPDATE approval_requests SET current_step = $2, updated_at = NOW() WHERE id = $1
    `, requestId, nextOrder);

    const nextStepAssignees = steps
      .filter((s) => s.step_order === nextOrder && s.assigned_to)
      .map((s) => ({ userId: s.assigned_to as string, stepName: s.name as string }));
    return { requestStatus: 'pending', signatureId, activatedNextStep: true, nextStepAssignees };
  });
}

export async function activateNextStepGroup(schemaName: string, requestId: string, nextStepOrder: number): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    await prisma.$executeRawUnsafe(`
      UPDATE approval_request_steps
      SET status = 'active', activated_at = NOW()
      WHERE request_id = $1 AND step_order = $2 AND status = 'pending'
    `, requestId, nextStepOrder);
    await prisma.$executeRawUnsafe(`
      UPDATE approval_requests SET current_step = $2, updated_at = NOW() WHERE id = $1
    `, requestId, nextStepOrder);
  });
}

export async function finaliseRequest(schemaName: string, id: string, status: string, rejectionReason: string | null): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    await prisma.$executeRawUnsafe(`
      UPDATE approval_requests
      SET status = $2, rejection_reason = $3, completed_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, id, status, rejectionReason);
  });
}

export async function cancelRequest(schemaName: string, id: string, reason?: string): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    await prisma.$executeRawUnsafe(`
      UPDATE approval_requests SET status='cancelled', rejection_reason=$2, completed_at=NOW(), updated_at=NOW() WHERE id=$1
    `, id, reason ?? null);
    await prisma.$executeRawUnsafe(`
      UPDATE approval_request_steps SET status='skipped' WHERE request_id=$1 AND status IN ('pending','active')
    `, id);
  });
}

export async function getStepsForRequest(schemaName: string, requestId: string): Promise<any[]> {
  return withTenantSchema(schemaName, async (prisma) => {
    return prisma.$queryRawUnsafe<any[]>(`
      SELECT ars.*, u.email AS assignee_email
      FROM approval_request_steps ars
      LEFT JOIN global.users u ON u.id = ars.assigned_to
      WHERE ars.request_id = $1
      ORDER BY ars.step_order
    `, requestId);
  });
}

// Resolve a user's display name ("First Last") from the global users table,
// falling back to null when the user or both name parts are missing.
export async function getUserDisplayName(schemaName: string, userId: string): Promise<string | null> {
  return withTenantSchema(schemaName, async (prisma) => {
    const [u] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT first_name, last_name FROM global.users WHERE id = $1`, userId,
    );
    if (!u) return null;
    const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
    return name || null;
  });
}

export async function getMyPendingRequests(schemaName: string, userId: string, userRole: string): Promise<ApprovalRequest[]> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT ar.*,
             u.first_name || ' ' || u.last_name AS requester_name,
             u.email AS requester_email
      FROM approval_requests ar
      JOIN approval_request_steps ars ON ars.request_id = ar.id
      LEFT JOIN global.users u ON u.id = ar.requested_by
      WHERE ar.deleted_at IS NULL AND ar.status = 'pending'
        AND ars.status = 'active'
        AND (
          ars.assigned_to = $1
          OR (ars.approver_type = 'role' AND ars.assigned_role = $2)
          OR (ars.approver_type = 'any_from_list' AND $1 = ANY(ars.approver_user_list))
          OR ars.approver_type = 'manager'
        )
      ORDER BY ar.created_at DESC
    `, userId, userRole);
    return rows.map(mapRequest);
  });
}

// ── Mappers ───────────────────────────────────────────────────

function mapWorkflow(r: any): ApprovalWorkflow {
  return {
    id: r.id, name: r.name, description: r.description,
    entityType: r.entity_type, isActive: r.is_active,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapWorkflowStep(r: any): ApprovalWorkflowStep {
  return {
    id: r.id, workflowId: r.workflow_id, stepOrder: r.step_order,
    name: r.name, approverType: r.approver_type, approverId: r.approver_id,
    approverRole: r.approver_role, approverUserList: r.approver_user_list ?? [],
    minApprovals: r.min_approvals, deadlineHours: r.deadline_hours,
    allowSelfApproval: r.allow_self_approval, requireSignature: r.require_signature,
    instructions: r.instructions,
  };
}

function mapRequest(r: any): ApprovalRequest {
  return {
    id: r.id, workflowId: r.workflow_id, title: r.title, description: r.description,
    entityType: r.entity_type, entityId: r.entity_id, status: r.status,
    priority: r.priority, currentStep: r.current_step, totalSteps: r.total_steps,
    requestedBy: r.requested_by, requesterName: r.requester_name ?? null,
    requesterEmail: r.requester_email ?? null, deadline: r.deadline,
    submittedAt: r.submitted_at, completedAt: r.completed_at,
    rejectionReason: r.rejection_reason, metadata: r.metadata ?? {},
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapRequestStep(r: any): ApprovalRequestStep {
  return {
    id: r.id, requestId: r.request_id, workflowStepId: r.workflow_step_id,
    stepOrder: r.step_order, name: r.name, status: r.status,
    approverType: r.approver_type, assignedTo: r.assigned_to,
    assigneeName: r.assignee_name ?? null, assigneeEmail: r.assignee_email ?? null,
    assignedRole: r.assigned_role, decidedBy: r.decided_by,
    deciderName: r.decider_name ?? null, decision: r.decision, comments: r.comments,
    digitalSignatureId: r.digital_signature_id, requireSignature: r.require_signature,
    instructions: r.instructions, activatedAt: r.activated_at, decidedAt: r.decided_at,
    deadline: r.deadline, createdAt: r.created_at,
  };
}
