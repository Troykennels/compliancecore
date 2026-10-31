import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withTenantSchema } from "../../lib/prisma";
import { setAuditSessionVars } from "../../middleware/audit.middleware";
import { AppError, ForbiddenError, NotFoundError } from "../../lib/errors";
import { assertActiveMembers } from "../../lib/active-member";
import { complianceFollowup } from "../frameworks/compliance-followup";
import { notificationRepository } from "../notifications/notification.repository";

type Actor = {
  id: string;
  email: string;
  role: string | null;
  tenantId: string | null;
};
type Tx = Prisma.TransactionClient;
export const requestSchema = z.object({
  reference: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(500),
  requirement: z.string().trim().max(2000).optional(),
  description: z.string().trim().max(10000).optional(),
  controlId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
});
export const participantSchema = z
  .object({
    userId: z.string().uuid(),
    accessFrom: z.string().date(),
    accessUntil: z.string().date(),
  })
  .refine((v) => v.accessUntil >= v.accessFrom, {
    message: "Access must end on or after its start date.",
    path: ["accessUntil"],
  });
export const commentSchema = z.object({
  body: z.string().trim().min(1).max(10000),
});
export const attachmentSchema = z.object({
  evidenceId: z.string().uuid(),
  evidenceVersionId: z.string().uuid(),
});
export const decisionSchema = z.object({
  status: z.enum(["submitted", "accepted", "needs_revision"]),
  note: z.string().trim().min(1).max(5000),
});

export const AUDIT_REQUEST_OWNER_ROLES = [
  "owner",
  "admin",
  "compliance_manager",
  "control_owner",
];

async function validateRequest(
  tx: Tx,
  schema: string,
  input: z.infer<typeof requestSchema>,
) {
  if (input.ownerId) {
    const members = await tx.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM global.tenant_memberships m JOIN global.tenants t ON t.id=m.tenant_id
       JOIN global.users u ON u.id=m.user_id WHERE t.schema_name=$1 AND m.user_id=$2::uuid
       AND m.role::text=ANY($3::text[]) AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL`,
      schema,
      input.ownerId,
      AUDIT_REQUEST_OWNER_ROLES,
    );
    if (!members.length)
      throw new AppError(
        "Choose an active owner, administrator, compliance manager or control owner who can prepare evidence.",
        422,
        "INVALID_REQUEST_OWNER",
      );
  }
  if (input.controlId) {
    const controls = await tx.$queryRawUnsafe<unknown[]>(
      "SELECT 1 FROM controls WHERE id=$1::uuid AND deleted_at IS NULL",
      input.controlId,
    );
    if (!controls.length) throw new NotFoundError("Control not found.");
  }
}

async function invalidateReport(tx: Tx, auditId: string, actor: Actor) {
  const updated = await tx.$executeRawUnsafe(
    `UPDATE audits SET reviewed_by=NULL,reviewed_at=NULL,
    status=CASE WHEN status='completed' THEN 'in_progress' ELSE status END,updated_by=$2::uuid,updated_at=NOW()
    WHERE id=$1::uuid AND status<>'cancelled'`,
    auditId,
    actor.id,
  );
  if (!updated)
    throw new AppError(
      "Reopen this cancelled audit before changing its evidence requests.",
      409,
    );
}

async function updateFollowup(
  tx: Tx,
  auditId: string,
  requestId: string,
  input: z.infer<typeof requestSchema>,
  actor: Actor,
) {
  if (input.ownerId && input.dueDate) {
    await complianceFollowup(tx, {
      kind: "audit_request",
      id: requestId,
      title:
        "Audit evidence requested: " + input.reference + " - " + input.title,
      due: input.dueDate,
      ownerId: input.ownerId,
      actorId: actor.id,
      url: "/audits/" + auditId,
    });
  } else {
    await tx.$executeRawUnsafe(
      "UPDATE compliance_calendar_events SET status='cancelled',updated_at=NOW() WHERE source_key=$1",
      "compliance:audit_request:" + requestId,
    );
  }
}

const managers = new Set(["owner", "admin", "compliance_manager"]);
export function assertRoomAction(
  role: string | null,
  action: "manage" | "submit" | "decide" | "comment",
  assigned: boolean,
) {
  if (managers.has(role ?? "")) return;
  if (role === "auditor" && (action === "decide" || action === "comment"))
    return;
  if (
    role === "control_owner" &&
    assigned &&
    (action === "submit" || action === "comment")
  )
    return;
  throw new ForbiddenError("Your role cannot perform this audit-room action.");
}

async function access(tx: Tx, auditId: string, actor: Actor) {
  const audit = await tx.$queryRawUnsafe<
    Array<{ id: string; title: string; scope: string | null; status: string }>
  >(
    "SELECT id,title,scope,status FROM audits WHERE id=$1::uuid AND deleted_at IS NULL FOR UPDATE",
    auditId,
  );
  if (!audit[0]) throw new NotFoundError("Audit not found.");
  if (managers.has(actor.role ?? "")) return audit[0];
  if (actor.role === "auditor") {
    const allowed = await tx.$queryRawUnsafe<unknown[]>(
      "SELECT 1 FROM audit_participants WHERE audit_id=$1::uuid AND user_id=$2::uuid AND CURRENT_DATE BETWEEN access_from AND access_until",
      auditId,
      actor.id,
    );
    if (allowed.length) return audit[0];
  }
  if (actor.role === "control_owner") {
    const assigned = await tx.$queryRawUnsafe<unknown[]>(
      "SELECT 1 FROM audit_requests WHERE audit_id=$1::uuid AND owner_id=$2::uuid AND deleted_at IS NULL",
      auditId,
      actor.id,
    );
    if (assigned.length) return audit[0];
  }
  throw new ForbiddenError(
    "Ask the audit manager for an active access window or an assigned evidence request.",
  );
}

async function request(
  tx: Tx,
  auditId: string,
  requestId: string,
  actor: Actor,
) {
  await access(tx, auditId, actor);
  const rows = await tx.$queryRawUnsafe<
    Array<{
      id: string;
      owner_id: string | null;
      status: string;
      submitted_by: string | null;
    }>
  >(
    "SELECT id,owner_id,status,submitted_by FROM audit_requests WHERE id=$1::uuid AND audit_id=$2::uuid AND deleted_at IS NULL FOR UPDATE",
    requestId,
    auditId,
  );
  if (!rows[0]) throw new NotFoundError("Evidence request not found.");
  if (actor.role === "control_owner" && rows[0].owner_id !== actor.id)
    throw new ForbiddenError();
  return rows[0];
}

export const auditRoomService = {
  async get(schema: string, auditId: string, actor: Actor) {
    return withTenantSchema(schema, async (tx) => {
      const audit = await access(tx, auditId, actor);
      const own = actor.role === "control_owner";
      const requests = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT r.*,u.first_name || ' ' || u.last_name AS owner_name,c.title AS control_title
         FROM audit_requests r LEFT JOIN global.users u ON u.id=r.owner_id LEFT JOIN controls c ON c.id=r.control_id
         WHERE r.audit_id=$1::uuid AND r.deleted_at IS NULL AND (NOT $2::boolean OR r.owner_id=$3::uuid) ORDER BY r.created_at`,
        auditId,
        own,
        actor.id,
      );
      const attachments = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT l.*,e.title,v.version_number,v.file_name,v.upload_status,e.current_version_id
         FROM audit_request_evidence l JOIN audit_requests r ON r.id=l.request_id
         JOIN evidence e ON e.id=l.evidence_id JOIN evidence_versions v ON v.id=l.evidence_version_id
         WHERE r.audit_id=$1::uuid AND r.deleted_at IS NULL AND (NOT $2::boolean OR r.owner_id=$3::uuid) ORDER BY l.linked_at`,
        auditId,
        own,
        actor.id,
      );
      const comments = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT c.*,u.first_name || ' ' || u.last_name AS author_name FROM audit_request_comments c
         JOIN audit_requests r ON r.id=c.request_id JOIN global.users u ON u.id=c.author_id
         WHERE r.audit_id=$1::uuid AND r.deleted_at IS NULL AND (NOT $2::boolean OR r.owner_id=$3::uuid) ORDER BY c.created_at`,
        auditId,
        own,
        actor.id,
      );
      const participants = own
        ? []
        : await tx.$queryRawUnsafe<Record<string, unknown>[]>(
            `SELECT p.*,u.first_name || ' ' || u.last_name AS name FROM audit_participants p JOIN global.users u ON u.id=p.user_id WHERE p.audit_id=$1::uuid`,
            auditId,
          );
      return {
        audit,
        requests,
        attachments,
        comments,
        participants,
        requestOwnerRoles: AUDIT_REQUEST_OWNER_ROLES,
      };
    });
  },

  async addParticipant(
    schema: string,
    auditId: string,
    input: z.infer<typeof participantSchema>,
    actor: Actor,
  ) {
    assertRoomAction(actor.role, "manage", false);
    await assertActiveMembers(schema, [input.userId]);
    return withTenantSchema(schema, async (tx) => {
      await access(tx, auditId, actor);
      await setAuditSessionVars(tx, actor);
      await tx.$executeRawUnsafe(
        `INSERT INTO audit_participants(audit_id,user_id,access_from,access_until,added_by)
        VALUES($1::uuid,$2::uuid,$3::date,$4::date,$5::uuid) ON CONFLICT(audit_id,user_id)
        DO UPDATE SET access_from=EXCLUDED.access_from,access_until=EXCLUDED.access_until,added_by=EXCLUDED.added_by`,
        auditId,
        input.userId,
        input.accessFrom,
        input.accessUntil,
        actor.id,
      );
    });
  },

  async removeParticipant(
    schema: string,
    auditId: string,
    userId: string,
    actor: Actor,
  ) {
    assertRoomAction(actor.role, "manage", false);
    return withTenantSchema(schema, async (tx) => {
      await access(tx, auditId, actor);
      await setAuditSessionVars(tx, actor);
      await tx.$executeRawUnsafe(
        "DELETE FROM audit_participants WHERE audit_id=$1::uuid AND user_id=$2::uuid",
        auditId,
        userId,
      );
    });
  },

  async create(
    schema: string,
    auditId: string,
    input: z.infer<typeof requestSchema>,
    actor: Actor,
  ) {
    assertRoomAction(actor.role, "manage", false);
    await assertActiveMembers(schema, [input.ownerId]);
    return withTenantSchema(schema, async (tx) => {
      await access(tx, auditId, actor);
      await setAuditSessionVars(tx, actor);
      await validateRequest(tx, schema, input);
      const duplicate = await tx.$queryRawUnsafe<unknown[]>(
        "SELECT 1 FROM audit_requests WHERE audit_id=$1::uuid AND reference=$2",
        auditId,
        input.reference,
      );
      if (duplicate.length)
        throw new AppError(
          "This request reference is already in use for this audit.",
          409,
        );
      await invalidateReport(tx, auditId, actor);
      const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO audit_requests(audit_id,reference,title,requirement,description,control_id,owner_id,due_date,created_by)
        VALUES($1::uuid,$2,$3,$4,$5,$6::uuid,$7::uuid,$8::date,$9::uuid) RETURNING id`,
        auditId,
        input.reference,
        input.title,
        input.requirement ?? null,
        input.description ?? null,
        input.controlId ?? null,
        input.ownerId ?? null,
        input.dueDate ?? null,
        actor.id,
      );
      if (input.ownerId) {
        if (input.dueDate)
          await complianceFollowup(tx, {
            kind: "audit_request",
            id: rows[0].id,
            title: `Audit evidence requested: ${input.reference} · ${input.title}`,
            due: input.dueDate,
            ownerId: input.ownerId,
            actorId: actor.id,
            url: `/audits/${auditId}`,
          });
        else
          await notificationRepository.create(tx, {
            userId: input.ownerId,
            title: `Audit evidence requested: ${input.reference} · ${input.title}`,
            body:
              input.description ??
              "Open the audit room to attach supporting evidence.",
            notificationType: "reminder",
            referenceType: "audit_request",
            referenceId: rows[0].id,
            actionUrl: `/audits/${auditId}`,
          });
      }
      return rows;
    });
  },

  async update(
    schema: string,
    auditId: string,
    requestId: string,
    input: z.infer<typeof requestSchema>,
    actor: Actor,
  ) {
    assertRoomAction(actor.role, "manage", false);
    return withTenantSchema(schema, async (tx) => {
      await request(tx, auditId, requestId, actor);
      await validateRequest(tx, schema, input);
      const duplicate = await tx.$queryRawUnsafe<unknown[]>(
        "SELECT 1 FROM audit_requests WHERE audit_id=$1::uuid AND reference=$2 AND id<>$3::uuid",
        auditId,
        input.reference,
        requestId,
      );
      if (duplicate.length)
        throw new AppError(
          "This request reference is already in use for this audit.",
          409,
        );
      await setAuditSessionVars(tx, actor);
      await invalidateReport(tx, auditId, actor);
      await tx.$executeRawUnsafe(
        `UPDATE audit_requests SET reference=$2,title=$3,requirement=$4,description=$5,control_id=$6::uuid,
        owner_id=$7::uuid,due_date=$8::date,status='requested',submitted_by=NULL,submitted_at=NULL,decided_by=NULL,decided_at=NULL,decision_note=NULL,updated_at=NOW() WHERE id=$1::uuid`,
        requestId,
        input.reference,
        input.title,
        input.requirement ?? null,
        input.description ?? null,
        input.controlId ?? null,
        input.ownerId ?? null,
        input.dueDate ?? null,
      );
      await updateFollowup(tx, auditId, requestId, input, actor);
      if (input.ownerId && !input.dueDate)
        await notificationRepository.create(tx, {
          userId: input.ownerId,
          title: "Audit evidence request updated: " + input.reference,
          body: "Open the audit room to prepare and resubmit the revised request.",
          notificationType: "reminder",
          referenceType: "audit_request",
          referenceId: requestId,
          actionUrl: "/audits/" + auditId,
        });
    });
  },

  async archive(
    schema: string,
    auditId: string,
    requestId: string,
    actor: Actor,
  ) {
    assertRoomAction(actor.role, "manage", false);
    return withTenantSchema(schema, async (tx) => {
      await request(tx, auditId, requestId, actor);
      await setAuditSessionVars(tx, actor);
      await invalidateReport(tx, auditId, actor);
      await tx.$executeRawUnsafe(
        "UPDATE audit_requests SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1::uuid",
        requestId,
      );
      await tx.$executeRawUnsafe(
        "UPDATE compliance_calendar_events SET status='cancelled',updated_at=NOW() WHERE source_key=$1",
        "compliance:audit_request:" + requestId,
      );
    });
  },

  async removeAttachment(
    schema: string,
    auditId: string,
    requestId: string,
    input: z.infer<typeof attachmentSchema>,
    actor: Actor,
  ) {
    return withTenantSchema(schema, async (tx) => {
      const current = await request(tx, auditId, requestId, actor);
      assertRoomAction(actor.role, "submit", current.owner_id === actor.id);
      if (!["requested", "needs_revision"].includes(current.status))
        throw new AppError(
          "Return the request for revision before changing its evidence.",
          409,
        );
      await setAuditSessionVars(tx, actor);
      const removed = await tx.$executeRawUnsafe(
        "DELETE FROM audit_request_evidence WHERE request_id=$1::uuid AND evidence_id=$2::uuid AND evidence_version_id=$3::uuid",
        requestId,
        input.evidenceId,
        input.evidenceVersionId,
      );
      if (!removed) throw new NotFoundError("Evidence attachment not found.");
      await invalidateReport(tx, auditId, actor);
    });
  },

  async attach(
    schema: string,
    auditId: string,
    requestId: string,
    input: z.infer<typeof attachmentSchema>,
    actor: Actor,
  ) {
    return withTenantSchema(schema, async (tx) => {
      const current = await request(tx, auditId, requestId, actor);
      assertRoomAction(actor.role, "submit", current.owner_id === actor.id);
      if (!["requested", "needs_revision"].includes(current.status))
        throw new AppError(
          "Return the request for revision before changing its evidence.",
          409,
        );
      const evidence = await tx.$queryRawUnsafe<unknown[]>(
        `SELECT 1 FROM evidence e JOIN evidence_versions v ON v.evidence_id=e.id
        WHERE e.id=$1::uuid AND v.id=$2::uuid AND e.deleted_at IS NULL AND e.status='active'
        AND v.upload_status='completed' AND (e.retention_date IS NULL OR e.retention_date>NOW())`,
        input.evidenceId,
        input.evidenceVersionId,
      );
      if (!evidence.length)
        throw new AppError(
          "Choose a completed version of active, retained evidence from this organisation.",
          422,
        );
      await setAuditSessionVars(tx, actor);
      const attached = await tx.$executeRawUnsafe(
        `INSERT INTO audit_request_evidence(request_id,evidence_id,evidence_version_id,linked_by)
        VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid) ON CONFLICT DO NOTHING`,
        requestId,
        input.evidenceId,
        input.evidenceVersionId,
        actor.id,
      );
      if (attached) await invalidateReport(tx, auditId, actor);
    });
  },

  async comment(
    schema: string,
    auditId: string,
    requestId: string,
    body: string,
    actor: Actor,
  ) {
    return withTenantSchema(schema, async (tx) => {
      const current = await request(tx, auditId, requestId, actor);
      assertRoomAction(actor.role, "comment", current.owner_id === actor.id);
      await setAuditSessionVars(tx, actor);
      await tx.$executeRawUnsafe(
        "INSERT INTO audit_request_comments(request_id,author_id,body) VALUES($1::uuid,$2::uuid,$3)",
        requestId,
        actor.id,
        body,
      );
    });
  },

  async decide(
    schema: string,
    auditId: string,
    requestId: string,
    input: z.infer<typeof decisionSchema>,
    actor: Actor,
  ) {
    return withTenantSchema(schema, async (tx) => {
      const current = await request(tx, auditId, requestId, actor);
      const submit = input.status === "submitted";
      assertRoomAction(
        actor.role,
        submit ? "submit" : "decide",
        current.owner_id === actor.id,
      );
      if (submit) {
        if (!["requested", "needs_revision"].includes(current.status))
          throw new AppError("Only an open request can be submitted.", 409);
        const attachments = await tx.$queryRawUnsafe<unknown[]>(
          `SELECT 1 FROM audit_request_evidence l JOIN evidence e ON e.id=l.evidence_id
          JOIN evidence_versions v ON v.id=l.evidence_version_id WHERE l.request_id=$1::uuid AND e.deleted_at IS NULL
          AND e.status='active' AND v.upload_status='completed' AND (e.retention_date IS NULL OR e.retention_date>NOW())`,
          requestId,
        );
        if (!attachments.length)
          throw new AppError(
            "Attach completed evidence before submitting this request.",
            409,
          );
      } else {
        if (
          current.status !== "submitted" &&
          !(current.status === "accepted" && input.status === "needs_revision")
        )
          throw new AppError(
            "Submit evidence before recording a review decision.",
            409,
          );
        if (current.submitted_by === actor.id || current.owner_id === actor.id)
          throw new AppError(
            "A different reviewer must decide on this evidence request.",
            409,
            "INDEPENDENT_REVIEW_REQUIRED",
          );
        if (input.status === "accepted") {
          const invalid = await tx.$queryRawUnsafe<unknown[]>(
            `SELECT 1 FROM audit_request_evidence l JOIN evidence e ON e.id=l.evidence_id
            JOIN evidence_versions v ON v.id=l.evidence_version_id WHERE l.request_id=$1::uuid
            AND (e.deleted_at IS NOT NULL OR e.status<>'active' OR v.upload_status<>'completed' OR e.retention_date<=NOW())`,
            requestId,
          );
          if (invalid.length)
            throw new AppError(
              "Some attached evidence is no longer available. Request a revision before accepting it.",
              409,
            );
        }
      }
      await setAuditSessionVars(tx, actor);
      await invalidateReport(tx, auditId, actor);
      await tx.$executeRawUnsafe(
        `UPDATE audit_requests SET status=$2,decision_note=$3,updated_at=NOW(),
        submitted_by=CASE WHEN $4 THEN $5::uuid ELSE submitted_by END,
        submitted_at=CASE WHEN $4 THEN NOW() ELSE submitted_at END,
        decided_by=CASE WHEN $4 THEN NULL ELSE $5::uuid END,decided_at=CASE WHEN $4 THEN NULL ELSE NOW() END WHERE id=$1::uuid`,
        requestId,
        input.status,
        input.note,
        submit,
        actor.id,
      );
      await tx.$executeRawUnsafe(
        "UPDATE compliance_calendar_events SET status=$2,updated_at=NOW() WHERE source_key=$1",
        "compliance:audit_request:" + requestId,
        input.status === "accepted" ? "completed" : "upcoming",
      );
      const recipients = submit
        ? await tx.$queryRawUnsafe<Array<{ user_id: string }>>(
            `SELECT user_id FROM audit_participants WHERE audit_id=$1::uuid AND CURRENT_DATE BETWEEN access_from AND access_until
            UNION SELECT COALESCE(owner_id,created_by) AS user_id FROM audits WHERE id=$1::uuid`,
            auditId,
          )
        : current.owner_id
          ? [{ user_id: current.owner_id }]
          : [];
      for (const recipient of recipients) {
        if (!recipient.user_id || recipient.user_id === actor.id) continue;
        await notificationRepository.create(tx, {
          userId: recipient.user_id,
          title: `Audit evidence ${input.status === "needs_revision" ? "needs revision" : input.status}`,
          body: input.note,
          notificationType: "reminder",
          referenceType: "audit_request",
          referenceId: requestId,
          actionUrl: `/audits/${auditId}`,
        });
      }
    });
  },
};
