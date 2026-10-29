import { closeResolvedControlActions } from "./control-actions";
import { complianceFollowup } from "./compliance-followup";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withTenantSchema } from "../../lib/prisma";
import { setAuditSessionVars } from "../../middleware/audit.middleware";
import { AppError, ForbiddenError, NotFoundError } from "../../lib/errors";
import { ROLE_PERMISSIONS } from "../../middleware/rbac.middleware";
import type { UserRole } from "../auth/auth.types";

type Tx = Prisma.TransactionClient;
export type RecordActor = {
  id: string;
  email: string;
  role: string | null;
  tenantId: string | null;
};
const id = z.string().uuid(),
  text = z.string().trim().min(20).max(10000);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Use a valid calendar date.",
  );
const https = z
  .string()
  .url()
  .max(2000)
  .refine(
    (v) => new URL(v).protocol === "https:",
    "Use the official HTTPS source.",
  );
export const obligationSchema = z.object({
  id: id.optional(),
  revision: z.number().int().positive().optional(),
  title: z.string().trim().min(5).max(500),
  authority: z.string().trim().min(2).max(200),
  sourceUrl: https,
  sourceVersion: z.string().trim().min(2).max(200),
  jurisdiction: z.string().trim().min(2).max(200),
  sector: z.string().trim().min(2).max(200),
  verifiedOn: day,
  effectiveOn: day.nullable().optional(),
  applicability: z.enum(["pending", "applicable", "not_applicable"]),
  rationale: text,
  ownerId: id,
  dueDate: day.nullable(),
  reviewDate: day,
  evidenceId: id.nullable(),
  controlIds: z.array(id).max(150),
  status: z.enum(["draft", "in_review"]),
});
export const testSchema = z.object({
  controlId: id,
  auditId: id.nullable().optional(),
  period: z.string().trim().min(5).max(300),
  criteria: text,
  sample: text,
  method: text,
  result: z.enum(["pass", "fail", "exception"]),
  notes: text,
  evidenceIds: z.array(id).min(1).max(20),
});
export const decisionSchema = z.object({
  decision: z.enum(["approve", "return"]),
  note: text,
});
export const riskReviewSchema = decisionSchema.extend({
  riskId: id,
  expiresOn: day,
  controlIds: z.array(id).max(150),
});
export const riskContextSchema = z.object({ riskId: id, frameworkId: id });
export const acknowledgmentSchema = z.object({
  policyId: id,
  userIds: z.array(id).min(1).max(200),
  dueDate: day,
});
export const vendorQuestionnaireSchema = z.object({
  vendorId: id,
  service: text,
  dataAccess: text,
  assurance: text,
  contract: text,
  continuity: text,
  exceptions: text,
  evidenceId: id,
  reviewDue: day,
});
export const actionSchema = z.object({
  taskId: id,
  sourceKind: z.enum(["finding", "incident", "control"]),
  sourceId: id,
  rootCause: text,
  correction: text,
  prevention: text,
  effectivenessCriteria: text,
  evidenceId: id,
  dueDate: day,
});
export const incidentDecisionSchema = z
  .object({
    incidentId: id,
    decision: z.enum(["pending", "required", "not_required", "submitted"]),
    obligationId: id.nullable(),
    awarenessAt: z.string().datetime(),
    deadlineAt: z.string().datetime().nullable(),
    recipient: z.string().trim().max(500),
    rationale: text,
    evidenceId: id.nullable(),
  })
  .superRefine((v, c) => {
    if (["required", "submitted"].includes(v.decision) && !v.obligationId)
      c.addIssue({
        code: "custom",
        message: "Choose the reviewed applicable duty.",
      });
    if (v.decision === "required" && (!v.deadlineAt || !v.recipient))
      c.addIssue({
        code: "custom",
        message:
          "A required notification needs its verified deadline and recipient.",
      });
    if (v.decision === "submitted" && !v.evidenceId)
      c.addIssue({ code: "custom", message: "Attach the submission receipt." });
    if (v.deadlineAt && new Date(v.deadlineAt) < new Date(v.awarenessAt))
      c.addIssue({
        code: "custom",
        message: "Deadline cannot precede the awareness timestamp.",
      });
  });
export const trainingCompletionSchema = z.object({
  recordId: id,
  evidenceId: id,
  note: text,
});
export const auditReviewSchema = z.object({
  auditId: id,
  evidenceId: id,
  note: text,
});
export const findingClosureSchema = z.object({
  findingId: id,
  evidenceId: id,
  note: text,
});
function manager(a: RecordActor) {
  if (
    !["owner", "admin", "compliance_manager", "msp_admin"].includes(
      a.role ?? "",
    )
  )
    throw new ForbiddenError(
      "A compliance manager or administrator must coordinate this record.",
    );
}
async function row(tx: Tx, table: string, recordId: string) {
  const rows = await tx.$queryRawUnsafe<Array<Record<string, any>>>(
    `SELECT * FROM ${table} WHERE id=$1::uuid FOR UPDATE`,
    recordId,
  );
  if (!rows[0] || rows[0].deleted_at) throw new NotFoundError("Record");
  return rows[0];
}
async function member(tx: Tx, a: RecordActor, ids: string[]) {
  if (!ids.length) return;
  const rows = await tx.$queryRawUnsafe<Array<{ user_id: string }>>(
    "SELECT m.user_id FROM global.tenant_memberships m JOIN global.users u ON u.id=m.user_id WHERE m.tenant_id=$1::uuid AND m.user_id=ANY($2::uuid[]) AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL",
    a.tenantId,
    ids,
  );
  if (new Set(rows.map((r) => r.user_id)).size !== new Set(ids).size)
    throw new AppError(
      "Select active members of this organisation.",
      422,
      "INVALID_MEMBER",
    );
}
async function evidence(tx: Tx, ids: string[]) {
  const rows = await tx.$queryRawUnsafe<
    Array<{ id: string; current_version_id: string }>
  >(
    "SELECT e.id,e.current_version_id FROM evidence e JOIN evidence_versions v ON v.id=e.current_version_id WHERE e.id=ANY($1::uuid[]) AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()) AND v.upload_status='completed'",
    ids,
  );
  if (new Set(rows.map((r) => r.id)).size !== new Set(ids).size)
    throw new AppError(
      "Choose current evidence with a completed file upload.",
      422,
      "CURRENT_EVIDENCE_REQUIRED",
    );
  return rows;
}
async function controls(tx: Tx, ids: string[]) {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    "SELECT id FROM controls WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL",
    ids,
  );
  if (new Set(rows.map((r) => r.id)).size !== new Set(ids).size)
    throw new AppError(
      "Choose controls belonging to this organisation.",
      422,
      "INVALID_CONTROL",
    );
}
function independent(a: RecordActor, ids: unknown[]) {
  if (ids.includes(a.id))
    throw new ForbiddenError(
      "Another authorised person must review this work.",
    );
}
function future(v: string) {
  if (v < new Date().toISOString().slice(0, 10))
    throw new AppError(
      "Choose today or a future review date.",
      422,
      "INVALID_REVIEW_DATE",
    );
}
const scopes: Record<string, string> = {
  obligations: "controls:read",
  tests: "controls:read",
  risks: "risks:read",
  acknowledgments: "policies:read",
  vendors: "vendors:read",
  actions: "tasks:read",
  incidents: "incidents:read",
  training: "training:read",
  audits: "audits:read",
  history: "settings:read",
};
export function canReadWorkspace(kind: string, a: RecordActor) {
  const perms = ROLE_PERMISSIONS[(a.role ?? "viewer") as UserRole] ?? [];
  return perms.includes("*") || perms.includes(scopes[kind] ?? "__denied");
}
export const recordsService = {
  async workspace(
    schema: string,
    kind: string,
    a: RecordActor,
    attention = false,
    page = 1,
    recordId?:string,
  ) {
    if(recordId&&!id.safeParse(recordId).success)throw new AppError('Choose a valid linked record.',422);
    page = Math.max(1, Math.min(10000, Math.floor(page) || 1));
    if (!canReadWorkspace(kind, a)) throw new ForbiddenError();
    return withTenantSchema(
      schema,
      async (tx) => {
        const options: Record<string, unknown> = {};
        let records: unknown[] = [];
        const list=(sql:string,...args:unknown[])=>{if(recordId&&kind==='tests'&&sql.includes('FROM control_tests t JOIN controls c')){sql=sql.replace('WHERE c.deleted_at IS NULL','WHERE c.deleted_at IS NULL AND c.id=$'+(args.length+1)+'::uuid');args.push(recordId);}return tx.$queryRawUnsafe<unknown[]>(sql.replace(/LIMIT 200/g,'LIMIT 201 OFFSET '+((page-1)*200)),...args);};
        if (kind !== "history")
          options.members = await tx.$queryRawUnsafe(
            "SELECT u.id,COALESCE(NULLIF(concat_ws(' ',u.first_name,u.last_name),''),u.email) title FROM global.users u JOIN global.tenant_memberships m ON m.user_id=u.id WHERE m.tenant_id=$1::uuid AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL ORDER BY title",
            a.tenantId,
          );
        if (["obligations", "tests", "risks", "audits"].includes(kind))
          options.controls = await tx.$queryRawUnsafe(
            "SELECT id,control_ref||' — '||title title FROM controls WHERE deleted_at IS NULL ORDER BY control_ref LIMIT 1000",
          );
        if (
          [
            "obligations",
            "tests",
            "vendors",
            "actions",
            "incidents",
            "training",
            "audits",
          ].includes(kind)
        )
          options.evidence = await tx.$queryRawUnsafe(
            "SELECT e.id,e.title FROM evidence e JOIN evidence_versions v ON v.id=e.current_version_id WHERE e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()) AND v.upload_status='completed' ORDER BY e.title LIMIT 1000",
          );
        if (kind === "obligations")
          records = await list(
            "SELECT o.*,(SELECT jsonb_agg(jsonb_build_object('revision',v.revision,'snapshot',v.snapshot,'reviewedAt',v.reviewed_at) ORDER BY v.revision DESC) FROM compliance_obligation_versions v WHERE v.obligation_id=o.id) versions FROM compliance_obligations o" +
              (attention
                ? " WHERE status<>'superseded' AND (status<>'active' OR review_date<CURRENT_DATE)"
                : "") +
              " ORDER BY updated_at DESC LIMIT 200",
          );
        if(kind==='tests'&&canReadWorkspace('audits',a))options.audits=await tx.$queryRawUnsafe('SELECT id,title FROM audits WHERE deleted_at IS NULL ORDER BY title LIMIT 1000');
        if (kind === "tests")
          records = await list(
            `SELECT t.*,c.title,c.control_ref,(c.updated_at>t.tested_at OR EXISTS(SELECT 1 FROM jsonb_array_elements(t.evidence_versions) s LEFT JOIN evidence e ON e.id=(s->>'id')::uuid WHERE e.id IS NULL OR e.deleted_at IS NOT NULL OR e.status<>'active' OR (e.retention_date IS NOT NULL AND e.retention_date<=NOW()) OR e.current_version_id IS DISTINCT FROM (s->>'current_version_id')::uuid)) stale FROM control_tests t JOIN controls c ON c.id=t.control_id WHERE c.deleted_at IS NULL ${attention ? "AND t.status='submitted'" : ""} ORDER BY t.tested_at DESC LIMIT 200`,
          );
        if (kind === "risks") {
          options.frameworks = await tx.$queryRawUnsafe(
            "SELECT f.id,f.name title FROM framework_data.frameworks f JOIN framework_implementations p ON p.framework_id=f.id WHERE f.deleted_at IS NULL ORDER BY f.name",
          );
          options.risks = await tx.$queryRawUnsafe(
            "SELECT id,title FROM risks WHERE deleted_at IS NULL ORDER BY title LIMIT 1000",
          );
          records = await list(
            "SELECT v.*,r.title,(r.updated_at>v.reviewed_at OR v.expires_on<CURRENT_DATE) stale FROM risk_reviews v JOIN risks r ON r.id=v.risk_id WHERE r.deleted_at IS NULL ORDER BY v.reviewed_at DESC LIMIT 200",
          );
        }
        if (kind === "acknowledgments") {
          options.policies = await tx.$queryRawUnsafe(
            "SELECT id,title FROM policies WHERE deleted_at IS NULL AND status='published' ORDER BY title LIMIT 1000",
          );
          records = await list(
            "SELECT a.*,p.title,v.version_number,p.current_version<>v.version_number superseded,v.content version_content,COALESCE(NULLIF(concat_ws(' ',u.first_name,u.last_name),''),u.email) person FROM policy_acknowledgments a JOIN policies p ON p.id=a.policy_id JOIN policy_versions v ON v.id=a.policy_version_id JOIN global.users u ON u.id=a.user_id WHERE ($1::boolean OR a.user_id=$2::uuid)" +
              (attention
                ? " AND p.deleted_at IS NULL AND p.status='published' AND p.current_version=v.version_number AND a.acknowledged_at IS NULL"
                : "") +
              " ORDER BY a.created_at DESC LIMIT 200",
            ["owner", "admin", "compliance_manager", "msp_admin"].includes(
              a.role ?? "",
            ),
            a.id,
          );
        }
        if (kind === "vendors") {
          options.vendors = await tx.$queryRawUnsafe(
            "SELECT id,name title FROM vendors WHERE deleted_at IS NULL ORDER BY name LIMIT 1000",
          );
          records = await list(
            "SELECT q.*,v.name title,(q.review_due<CURRENT_DATE OR NOT EXISTS(SELECT 1 FROM evidence e JOIN evidence_versions ev ON ev.id=e.current_version_id WHERE e.id::text=q.responses->>'evidenceId' AND e.current_version_id::text=q.responses->>'evidenceVersionId' AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()) AND ev.upload_status='completed')) stale FROM vendor_questionnaire_responses q JOIN vendors v ON v.id=q.vendor_id WHERE v.deleted_at IS NULL ORDER BY q.created_at DESC LIMIT 200",
          );
        }
        if (kind === "actions") {
          options.sourceKinds = [
            { id: "finding", title: "Audit finding" },
            { id: "incident", title: "Incident" },
            { id: "control", title: "Safeguard" },
          ];
          options.sources = await tx.$queryRawUnsafe(
            "SELECT id,title,'finding' type FROM audit_findings UNION ALL SELECT id,title,'incident' type FROM incidents WHERE deleted_at IS NULL UNION ALL SELECT id,title,'control' type FROM controls WHERE deleted_at IS NULL",
          );
          options.tasks = await tx.$queryRawUnsafe(
            "SELECT id,title FROM tasks WHERE deleted_at IS NULL ORDER BY title LIMIT 1000",
          );
          records = await list(
            "SELECT id,title,status,assigned_to,entity_type,entity_id,corrective_action,(NOT EXISTS(SELECT 1 FROM evidence e JOIN evidence_versions v ON v.id=e.current_version_id WHERE e.id::text=tasks.corrective_action->>'evidenceId' AND e.current_version_id::text=tasks.corrective_action->>'evidenceVersionId' AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()) AND v.upload_status='completed')) stale FROM tasks WHERE deleted_at IS NULL AND corrective_action IS NOT NULL" +
              (attention
                ? " AND status='in_review' AND corrective_action->>'state'='awaiting_verification'"
                : "") +
              " ORDER BY updated_at DESC LIMIT 200",
          );
        }
        if (kind === "incidents") {
          options.incidents = await tx.$queryRawUnsafe(
            "SELECT id,title FROM incidents WHERE deleted_at IS NULL ORDER BY title LIMIT 1000",
          );
          options.obligations = await tx.$queryRawUnsafe(
            "SELECT id,title FROM compliance_obligations WHERE status='active' AND applicability='applicable' ORDER BY title",
          );
          records = await list(
            "SELECT id,title,status,notification_decision FROM incidents WHERE deleted_at IS NULL AND notification_decision IS NOT NULL ORDER BY updated_at DESC LIMIT 200",
          );
        }
        if (kind === "training") {
          options.records = await list(
            "SELECT r.id,p.title||' — '||COALESCE(NULLIF(concat_ws(' ',u.first_name,u.last_name),''),u.email) title FROM training_records r JOIN training_programs p ON p.id=r.program_id JOIN global.users u ON u.id=r.user_id WHERE p.deleted_at IS NULL ORDER BY p.title LIMIT 1000",
          );
          records = await list(
            "SELECT r.*,p.title,(r.status='completed' AND NOT EXISTS(SELECT 1 FROM evidence e JOIN evidence_versions ev ON ev.id=e.current_version_id WHERE e.id=r.completion_evidence_id AND e.current_version_id=r.completion_evidence_version_id AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()) AND ev.upload_status='completed')) stale FROM training_records r JOIN training_programs p ON p.id=r.program_id WHERE p.deleted_at IS NULL ORDER BY r.created_at DESC LIMIT 200",
          );
        }
        if (kind === "audits") {
          options.audits = await tx.$queryRawUnsafe(
            "SELECT id,title FROM audits WHERE deleted_at IS NULL ORDER BY title LIMIT 1000",
          );
          options.tests=await tx.$queryRawUnsafe("SELECT t.id,c.control_ref||' ? '||t.result||' ? '||t.tested_at::date title FROM control_tests t JOIN controls c ON c.id=t.control_id WHERE c.deleted_at IS NULL ORDER BY t.tested_at DESC LIMIT 1000");
          options.findings = await tx.$queryRawUnsafe(
            "SELECT f.*,a.title audit_title,(f.status<>'resolved' OR EXISTS(SELECT 1 FROM evidence e WHERE e.id=f.closure_evidence_id AND e.current_version_id=f.closure_evidence_version_id AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()))) verification_current FROM audit_findings f JOIN audits a ON a.id=f.audit_id WHERE a.deleted_at IS NULL ORDER BY f.created_at DESC LIMIT 1000",
          );
          records = await list(
            "SELECT id,title,status,reviewed_by,reviewed_at,report_evidence_id FROM audits WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200",
          );
        }
        if (kind === "history")
          records = await list(
            "SELECT * FROM (SELECT id,event_sequence::text event_sequence,user_id,user_role,action,entity_type,entity_id,old_value,new_value,created_at,hash_chain,previous_hash FROM audit_log UNION ALL SELECT id,event_sequence::text,user_id,user_role,action,entity_type,entity_id,old_value,new_value,created_at,hash_chain,previous_hash FROM global.global_audit_log WHERE tenant_id=$1::uuid) h ORDER BY created_at DESC LIMIT 200",
            a.tenantId,
          );
        return {
          records: records.slice(0, 200),
          options,
          page,
          hasMore: records.length > 200,
        };
      },
      { timeout: 20000 },
    );
  },
  async obligation(
    schema: string,
    input: z.infer<typeof obligationSchema>,
    a: RecordActor,
  ) {
    manager(a);
    future(input.reviewDate);
    if (input.verifiedOn > new Date().toISOString().slice(0, 10))
      throw new AppError(
        "A source cannot have been verified in the future.",
        422,
      );
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      await member(tx, a, [input.ownerId]);
      await controls(tx, input.controlIds);
      if (input.evidenceId) await evidence(tx, [input.evidenceId]);
      if (input.id) {
        const before = await row(tx, "compliance_obligations", input.id);
        if (input.revision !== before.revision)
          throw new AppError(
            "This record changed. Reload before saving.",
            409,
            "STALE_RECORD",
          );
        const r = await tx.$queryRawUnsafe(
          "UPDATE compliance_obligations SET title=$2,authority=$3,source_url=$4,source_version=$5,jurisdiction=$6,sector=$7,verified_on=$8::date,applicability=$9,rationale=$10,owner_id=$11::uuid,due_date=$12::date,review_date=$13::date,evidence_id=$14::uuid,control_ids=$15::uuid[],status=$16,reviewed_by=NULL,reviewed_at=NULL,revision=revision+1,updated_at=NOW(),updated_by=$17::uuid,effective_on=$18::date WHERE id=$1::uuid RETURNING *",
          input.id,
          input.title,
          input.authority,
          input.sourceUrl,
          input.sourceVersion,
          input.jurisdiction,
          input.sector,
          input.verifiedOn,
          input.applicability,
          input.rationale,
          input.ownerId,
          input.dueDate,
          input.reviewDate,
          input.evidenceId,
          input.controlIds,
          input.status,
          a.id,
          input.effectiveOn ?? null,
        );
        await tx.$executeRawUnsafe("UPDATE compliance_calendar_events SET status='cancelled',updated_at=NOW() WHERE linked_entity_type='obligation' AND linked_entity_id=$1::uuid AND deleted_at IS NULL", input.id);
        return r;
      }
      return tx.$queryRawUnsafe(
        "INSERT INTO compliance_obligations(title,authority,source_url,source_version,jurisdiction,sector,verified_on,applicability,rationale,owner_id,due_date,review_date,evidence_id,control_ids,status,created_by,effective_on) VALUES($1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10::uuid,$11::date,$12::date,$13::uuid,$14::uuid[],$15,$16::uuid,$17::date) RETURNING *",
        input.title,
        input.authority,
        input.sourceUrl,
        input.sourceVersion,
        input.jurisdiction,
        input.sector,
        input.verifiedOn,
        input.applicability,
        input.rationale,
        input.ownerId,
        input.dueDate,
        input.reviewDate,
        input.evidenceId,
        input.controlIds,
        input.status,
        a.id,
        input.effectiveOn ?? null,
      );
    });
  },
  async reviewObligation(
    schema: string,
    recordId: string,
    input: z.infer<typeof decisionSchema>,
    a: RecordActor,
  ) {
    manager(a);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      const r = await row(tx, "compliance_obligations", recordId);
      independent(a, [r.owner_id, r.created_by, r.updated_by]);
      if (r.status !== "in_review" || r.applicability === "pending")
        throw new AppError(
          "Submit a decided applicability record for review first.",
          409,
        );
      if (input.decision === "approve" && r.review_date < new Date())
        throw new AppError("The review date has expired.", 409);
      await tx.$executeRawUnsafe(
        "UPDATE compliance_obligations SET status=$2,reviewed_by=$3::uuid,reviewed_at=NOW(),rationale=rationale||E'\nReview: '||$4,revision=revision+1,updated_at=NOW() WHERE id=$1::uuid",
        recordId,
        input.decision === "approve" ? "active" : "draft",
        a.id,
        input.note,
      );
      if (input.decision === "approve") {
        await tx.$executeRawUnsafe(
          "INSERT INTO compliance_obligation_versions(obligation_id,revision,snapshot,reviewed_by) SELECT id,revision,to_jsonb(o),$2::uuid FROM compliance_obligations o WHERE id=$1::uuid ON CONFLICT DO NOTHING",
          recordId,
          a.id,
        );
        await complianceFollowup(tx, {
          kind: "obligation",
          id: recordId,
          title: "Review obligation: " + r.title,
          due: new Date(r.review_date).toISOString().slice(0, 10),
          ownerId: r.owner_id,
          actorId: a.id,
          url: "/frameworks",
        });
      }
      return { saved: true };
    });
  },
  async submitTest(
    schema: string,
    input: z.infer<typeof testSchema>,
    a: RecordActor,
  ) {
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      const c = await row(tx, "controls", input.controlId);
      if(input.auditId){if(!canReadWorkspace('audits',a))throw new ForbiddenError('Your role cannot access this audit.');await row(tx,"audits",input.auditId);}
      if (a.role === "control_owner" && c.owner_id !== a.id)
        throw new ForbiddenError("Choose your assigned control.");
      const files = await evidence(tx, input.evidenceIds);
      return tx.$queryRawUnsafe(
        "INSERT INTO control_tests(control_id,result,notes,test_data,tested_by,control_snapshot,evidence_versions) VALUES($1::uuid,$2,$3,$4::jsonb,$5::uuid,$6::jsonb,$7::jsonb) RETURNING *",
        input.controlId,
        input.result,
        input.notes,
        JSON.stringify({
          period: input.period,
          criteria: input.criteria,
          sample: input.sample,
          method: input.method,
          auditId: input.auditId??null,
        }),
        a.id,
        JSON.stringify(c),
        JSON.stringify(files),
      );
    });
  },
  async reviewTest(
    schema: string,
    recordId: string,
    input: z.infer<typeof decisionSchema>,
    a: RecordActor,
  ) {
    manager(a);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      const t = await row(tx, "control_tests", recordId),
        c = await row(tx, "controls", t.control_id);
      independent(a, [t.tested_by, c.owner_id, c.updated_by]);
      if (t.status !== "submitted")
        throw new AppError(
          "This test already has a review. Submit a new test for changed work.",
          409,
        );
      const current = await evidence(
        tx,
        t.evidence_versions.map((v: { id: string }) => v.id),
      );
      if (
        !isDeepStrictEqual(
          JSON.parse(
            JSON.stringify(
              current.slice().sort((a, b) => a.id.localeCompare(b.id)),
            ),
          ),
          t.evidence_versions
            .slice()
            .sort((a: { id: string }, b: { id: string }) =>
              a.id.localeCompare(b.id),
            ),
        ) ||
        !isDeepStrictEqual(JSON.parse(JSON.stringify(c)), t.control_snapshot)
      )
        throw new AppError(
          "Control or evidence changed. Submit a fresh test.",
          409,
          "STALE_TEST",
        );
      await tx.$executeRawUnsafe(
        "UPDATE control_tests SET status=$2,reviewed_by=$3::uuid,reviewed_at=NOW(),review_note=$4 WHERE id=$1::uuid",
        recordId,
        input.decision === "approve" ? "approved" : "returned",
        a.id,
        input.note,
      );
      if (input.decision === "approve") {
        await closeResolvedControlActions(tx, t.control_id);
        if (t.result !== "pass")
          await tx.$executeRawUnsafe(
            "INSERT INTO tasks(title,description,assigned_to,assigned_by,priority,status,entity_type,entity_id,tags,created_by) VALUES($1,$2,$3::uuid,$4::uuid,'high','todo','control',$5::uuid,$6::text[],$4::uuid)",
            "Investigate control-test exception: " + c.title,
            "Review the failed or exception test and record corrective action. Test reference: " +
              t.id,
            c.owner_id,
            a.id,
            c.id,
            ["control-test", t.id],
          );
      }
      return { saved: true };
    });
  },
  async assignRiskContext(
    schema: string,
    input: z.infer<typeof riskContextSchema>,
    a: RecordActor,
  ) {
    manager(a);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      const r = await row(tx, "risks", input.riskId);
      if (r.framework_id && r.framework_id !== input.frameworkId)
        throw new AppError(
          "This risk already has an original assessment. Use shared control links to relate it to further frameworks; do not create a copy.",
          409,
        );
      const scope = await tx.$queryRawUnsafe<unknown[]>(
        "SELECT 1 FROM framework_implementations WHERE framework_id=$1::uuid",
        input.frameworkId,
      );
      if (!scope.length)
        throw new AppError(
          "Save the framework scope before linking a risk.",
          409,
        );
      if (!r.framework_id)
        await tx.$executeRawUnsafe(
          "UPDATE risks SET framework_id=$2::uuid,rating_confirmed=FALSE,updated_at=NOW() WHERE id=$1::uuid",
          input.riskId,
          input.frameworkId,
        );
      return { saved: true };
    });
  },
  async reviewRisk(
    schema: string,
    input: z.infer<typeof riskReviewSchema>,
    a: RecordActor,
  ) {
    manager(a);
    future(input.expiresOn);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      const r = await row(tx, "risks", input.riskId);
      independent(a, [r.owner_id, r.created_by, r.updated_by]);
      if (!r.rating_confirmed || !r.residual_basis || !r.mitigation_plan)
        throw new AppError(
          "Confirm the assessment and record treatment and residual reasoning first.",
          409,
        );
      if (r.treatment === "mitigate" && !input.controlIds.length)
        throw new AppError(
          "Select the controls used for mitigation, or revise the treatment decision.",
          422,
        );
      await controls(tx, input.controlIds);
      await tx.$executeRawUnsafe(
        "UPDATE risks SET status=$2,updated_at=NOW(),control_ids=$3::uuid[] WHERE id=$1::uuid",
        input.riskId,
        input.decision === "approve"
          ? r.treatment === "accept"
            ? "accepted"
            : "mitigated"
          : "in_treatment",
        input.controlIds,
      );
      const reviewedRisk = await row(tx, "risks", input.riskId);
      await tx.$executeRawUnsafe(
        "DELETE FROM risk_control_links WHERE risk_id=$1::uuid",
        input.riskId,
      );
      for (const controlId of input.controlIds)
        await tx.$executeRawUnsafe(
          "INSERT INTO risk_control_links(risk_id,control_id) VALUES($1::uuid,$2::uuid)",
          input.riskId,
          controlId,
        );
      await complianceFollowup(tx, {
        kind: "risk_review",
        id: input.riskId,
        title: "Review remaining risk: " + r.title,
        due: input.expiresOn,
        ownerId: r.owner_id,
        actorId: a.id,
        url: "/risks",
      });
      return tx.$queryRawUnsafe(
        "INSERT INTO risk_reviews(risk_id,reviewed_by,decision,notes,expires_on,risk_snapshot) VALUES($1::uuid,$2::uuid,$3,$4,$5::date,$6::jsonb) RETURNING *",
        input.riskId,
        a.id,
        input.decision,
        input.note,
        input.expiresOn,
        JSON.stringify({
          ...reviewedRisk,
          reviewed_control_ids: input.controlIds,
        }),
      );
    });
  },
  async assignAcknowledgments(
    schema: string,
    input: z.infer<typeof acknowledgmentSchema>,
    a: RecordActor,
  ) {
    manager(a);
    future(input.dueDate);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      await member(tx, a, input.userIds);
      const p = await row(tx, "policies", input.policyId);
      if (p.status !== "published")
        throw new AppError(
          "Publish an independently approved policy first.",
          409,
        );
      const versions = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        "SELECT id FROM policy_versions WHERE policy_id=$1::uuid AND version_number=$2",
        input.policyId,
        p.current_version,
      );
      if (!versions.length)
        throw new AppError(
          "The published version is missing; contact an administrator.",
          409,
        );
      for (const userId of new Set(input.userIds)) {
        const assigned = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          "INSERT INTO policy_acknowledgments(policy_id,policy_version_id,user_id,assigned_by,due_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::date) ON CONFLICT(policy_id,policy_version_id,user_id) DO NOTHING RETURNING id",
          input.policyId,
          versions[0].id,
          userId,
          a.id,
          input.dueDate,
        );
        if (assigned[0])
          await complianceFollowup(tx, {
            kind: "policy_acknowledgment",
            id: assigned[0].id,
            title: "Read policy: " + p.title,
            due: input.dueDate,
            ownerId: userId,
            actorId: a.id,
            url: "/policies",
          });
      }
      return { saved: true };
    });
  },
  async acknowledge(schema: string, recordId: string, a: RecordActor) {
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      const r = await row(tx, "policy_acknowledgments", recordId);
      if (r.user_id !== a.id)
        throw new ForbiddenError(
          "Only the assigned reader can acknowledge this policy.",
        );
      const p = await row(tx, "policies", r.policy_id);
      const v = await row(tx, "policy_versions", r.policy_version_id);
      if (p.status !== "published" || p.current_version !== v.version_number)
        throw new AppError(
          "The policy changed. Read and acknowledge its current published version.",
          409,
        );
      await tx.$executeRawUnsafe(
        "UPDATE policy_acknowledgments SET acknowledged_at=COALESCE(acknowledged_at,NOW()) WHERE id=$1::uuid",
        recordId,
      );
      await tx.$executeRawUnsafe(
        "UPDATE compliance_calendar_events SET status='completed',updated_at=NOW() WHERE linked_entity_type='policy_acknowledgment' AND linked_entity_id=$1::uuid AND deleted_at IS NULL",
        recordId,
      );
      return { saved: true };
    });
  },
  async submitVendor(
    schema: string,
    input: z.infer<typeof vendorQuestionnaireSchema>,
    a: RecordActor,
  ) {
    manager(a);
    future(input.reviewDue);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      await row(tx, "vendors", input.vendorId);
      const [proof] = await evidence(tx, [input.evidenceId]);
      return tx.$queryRawUnsafe(
        "INSERT INTO vendor_questionnaire_responses(vendor_id,responses,recorded_by,review_due) VALUES($1::uuid,$2::jsonb,$3::uuid,$4::date) RETURNING *",
        input.vendorId,
        JSON.stringify({...input,evidenceVersionId:proof.current_version_id}),
        a.id,
        input.reviewDue,
      );
    });
  },
  async reviewVendor(
    schema: string,
    recordId: string,
    input: z.infer<typeof decisionSchema>,
    a: RecordActor,
  ) {
    manager(a);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      const r = await row(tx, "vendor_questionnaire_responses", recordId);
      independent(a, [r.recorded_by]);
      if (r.status !== "submitted")
        throw new AppError(
          "Submit a new assessment for changed vendor answers.",
          409,
        );
      const [proof] = await evidence(tx, [r.responses.evidenceId]);
      if (proof.current_version_id !== r.responses.evidenceVersionId)
        throw new AppError("The supplier proof changed. Submit a new questionnaire with the current file.", 409);
      if (r.review_due < new Date())
        throw new AppError("The vendor review date expired.", 409);
      await tx.$executeRawUnsafe(
        "UPDATE vendor_questionnaire_responses SET status=$2,reviewed_by=$3::uuid,reviewed_at=NOW(),review_note=$4 WHERE id=$1::uuid",
        recordId,
        input.decision === "approve" ? "approved" : "returned",
        a.id,
        input.note,
      );
      return { saved: true };
    });
  },
  async action(
    schema: string,
    input: z.infer<typeof actionSchema>,
    a: RecordActor,
  ) {
    manager(a);
    future(input.dueDate);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      const t = await row(tx, "tasks", input.taskId);
      const tables: Record<string, string> = {
        finding: "audit_findings",
        incident: "incidents",
        control: "controls",
      };
      await row(tx, tables[input.sourceKind], input.sourceId);
      if (t.corrective_action && t.entity_id !== input.sourceId)
        throw new AppError(
          "A corrective task keeps its source. Create a separate task for another issue.",
          409,
        );
      if (!t.assigned_to)
        throw new AppError("Assign a responsible task owner first.", 422);
      const [proof] = await evidence(tx, [input.evidenceId]);
      await tx.$executeRawUnsafe(
        "UPDATE tasks SET corrective_action=$2::jsonb,status='in_review',due_date=$3::date,entity_type=$4,entity_id=$5::uuid,updated_at=NOW() WHERE id=$1::uuid",
        input.taskId,
        JSON.stringify({
          ...input,
          evidenceVersionId: proof.current_version_id,
          preparedBy: a.id,
          state: "awaiting_verification",
        }),
        input.dueDate,
        input.sourceKind,
        input.sourceId,
      );
      return { saved: true };
    });
  },
  async verifyAction(
    schema: string,
    recordId: string,
    input: z.infer<typeof decisionSchema>,
    a: RecordActor,
  ) {
    manager(a);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      const t = await row(tx, "tasks", recordId);
      if (
        !t.corrective_action ||
        t.corrective_action.state !== "awaiting_verification"
      )
        throw new AppError(
          "Record the root cause, action and effectiveness proof first.",
          409,
        );
      independent(a, [t.assigned_to, t.corrective_action.preparedBy]);
      const [proof] = await evidence(tx, [t.corrective_action.evidenceId]);
      if (proof.current_version_id !== t.corrective_action.evidenceVersionId)
        throw new AppError("The supporting file changed. Prepare the corrective action again using its current evidence.", 409);
      await tx.$executeRawUnsafe(
        "UPDATE tasks SET corrective_action=$2::jsonb,status=$3,updated_at=NOW() WHERE id=$1::uuid",
        recordId,
        JSON.stringify({
          ...t.corrective_action,
          state: input.decision === "approve" ? "effective" : "ineffective",
          reviewedBy: a.id,
          reviewedAt: new Date().toISOString(),
          reviewNote: input.note,
        }),
        input.decision === "approve" ? "completed" : "in_progress",
      );
      await tx.$executeRawUnsafe("INSERT INTO task_comments(task_id,user_id,body,is_internal) VALUES($1::uuid,$2::uuid,$3,true)", recordId, a.id,
        `Effectiveness review: ${input.decision === "approve" ? "effective" : "returned for correction"}. ${input.note}\nAction checked: ${t.corrective_action.correction}\nPrevention: ${t.corrective_action.prevention}\nProof version: ${t.corrective_action.evidenceVersionId}`);
      if (input.decision === "return") {
        if (["finding", "audit_finding"].includes(t.entity_type)) {
          await tx.$executeRawUnsafe("UPDATE audit_findings SET status='open',verified_by=NULL,verified_at=NULL,updated_at=NOW() WHERE id=$1::uuid", t.entity_id);
          await tx.$executeRawUnsafe("UPDATE audits SET status='in_progress',updated_at=NOW() WHERE id=(SELECT audit_id FROM audit_findings WHERE id=$1::uuid) AND status='completed' AND deleted_at IS NULL", t.entity_id);
        } else if (t.entity_type === "incident") {
          await tx.$executeRawUnsafe("UPDATE incidents SET status='investigating',updated_at=NOW() WHERE id=$1::uuid AND status='closed' AND deleted_at IS NULL", t.entity_id);
        }
      }
      return { saved: true };
    });
  },
  async incident(
    schema: string,
    input: z.infer<typeof incidentDecisionSchema>,
    a: RecordActor,
  ) {
    manager(a);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      await row(tx, "incidents", input.incidentId);
      const o = input.obligationId
        ? await row(tx, "compliance_obligations", input.obligationId)
        : null;
      if (o && (o.status !== "active" || o.applicability !== "applicable" || o.review_date < new Date(new Date().toISOString().slice(0,10)) || (o.effective_on && o.effective_on > new Date())))
        throw new AppError(
          "Choose an independently reviewed applicable obligation.",
          409,
        );
      if (new Date(input.awarenessAt) > new Date())
        throw new AppError("Awareness cannot be future-dated.", 422);
      const proof = input.evidenceId ? (await evidence(tx, [input.evidenceId]))[0] : null;
      await tx.$executeRawUnsafe(
        "UPDATE incidents SET notification_decision=$2::jsonb,updated_at=NOW() WHERE id=$1::uuid",
        input.incidentId,
        JSON.stringify({
          ...input,
          decidedBy: a.id,
          decidedAt: new Date().toISOString(),
          obligationRevision: o?.revision ?? null,
          evidenceVersionId: proof?.current_version_id ?? null,
        }),
      );
      return { saved: true };
    });
  },
  async completeTraining(
    schema: string,
    input: z.infer<typeof trainingCompletionSchema>,
    a: RecordActor,
  ) {
    manager(a);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      const r = await row(tx, "training_records", input.recordId);
      independent(a, [r.user_id]);
      await evidence(tx, [input.evidenceId]);
      await tx.$executeRawUnsafe(
        "UPDATE training_records SET status='completed',completed_at=NOW(),completion_evidence_id=$2::uuid,completion_note=$3,verified_by=$4::uuid,completion_evidence_version_id=(SELECT current_version_id FROM evidence WHERE id=$2::uuid) WHERE id=$1::uuid",
        input.recordId,
        input.evidenceId,
        input.note,
        a.id,
      );
      return { saved: true };
    });
  },
  async reviewAudit(
    schema: string,
    input: z.infer<typeof auditReviewSchema>,
    a: RecordActor,
  ) {
    manager(a);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      const r = await row(tx, "audits", input.auditId);
      independent(a, [r.owner_id, r.created_by, r.updated_by]);
      if (!r.scope?.trim() || !r.summary?.trim() || !r.end_date)
        throw new AppError(
          "Record audit scope, report summary and end date before review.",
          409,
        );
      await evidence(tx, [input.evidenceId]);
      await tx.$executeRawUnsafe(
        "UPDATE audits SET report_evidence_id=$2::uuid,reviewed_by=$3::uuid,reviewed_at=NOW(),report_review_note=$4,report_evidence_version_id=(SELECT current_version_id FROM evidence WHERE id=$2::uuid) WHERE id=$1::uuid",
        input.auditId,
        input.evidenceId,
        a.id,
        input.note,
      );
      return { saved: true };
    });
  },
  async closeFinding(
    schema: string,
    input: z.infer<typeof findingClosureSchema>,
    a: RecordActor,
  ) {
    manager(a);
    return withTenantSchema(schema, async (tx) => {
      await setAuditSessionVars(tx, a);
      const r = await row(tx, "audit_findings", input.findingId);
      independent(a, [r.owner_id, r.created_by]);
      await evidence(tx, [input.evidenceId]);
      const actions = await tx.$queryRawUnsafe<unknown[]>(
        "SELECT 1 FROM tasks WHERE entity_id=$1::uuid AND entity_type IN ('finding','audit_finding') AND deleted_at IS NULL AND status='completed' AND corrective_action->>'state'='effective' AND EXISTS(SELECT 1 FROM evidence e JOIN evidence_versions v ON v.id=e.current_version_id WHERE e.id::text=tasks.corrective_action->>'evidenceId' AND e.current_version_id::text=tasks.corrective_action->>'evidenceVersionId' AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()) AND v.upload_status='completed')",
        input.findingId,
      );
      const pending = await tx.$queryRawUnsafe<unknown[]>(
        "SELECT 1 FROM tasks WHERE entity_id=$1::uuid AND entity_type IN ('finding','audit_finding') AND deleted_at IS NULL AND status NOT IN ('completed','cancelled')",
        input.findingId,
      );
      if (!actions.length || pending.length)
        throw new AppError(
          "Verify the effectiveness of a linked corrective task before closing this finding.",
          409,
        );
      await tx.$executeRawUnsafe(
        "UPDATE audit_findings SET status='resolved',closure_evidence_id=$2::uuid,closure_note=$3,verified_by=$4::uuid,verified_at=NOW(),updated_at=NOW(),closure_evidence_version_id=(SELECT current_version_id FROM evidence WHERE id=$2::uuid) WHERE id=$1::uuid",
        input.findingId,
        input.evidenceId,
        input.note,
        a.id,
      );
      return { saved: true };
    });
  },
  async search(schema: string, q: string, a: RecordActor) {
    if (q.trim().length < 2) return [];
    const catalog = [
      ["controls", "controls:read", "/controls"],
      ["risks", "risks:read", "/risks"],
      ["policies", "policies:read", "/policies"],
      ["tasks", "tasks:read", "/tasks"],
      ["evidence", "evidence:read", "/evidence"],
      ["audits", "audits:read", "/audits"],
      ["incidents", "incidents:read", "/incidents"],
    ] as const;
    const perms = ROLE_PERMISSIONS[a.role as UserRole] ?? [];
    return withTenantSchema(schema, async (tx) => {
      const results: unknown[] = [];
      for (const [table, scope, route] of catalog) {
        if (!perms.includes("*") && !perms.includes(scope)) continue;
        const rows = await tx.$queryRawUnsafe<
          Array<{ id: string; title: string }>
        >(
          `SELECT id,title FROM ${table} WHERE deleted_at IS NULL AND title ILIKE $1 ORDER BY title LIMIT 6`,
          "%" + q.trim().slice(0, 120) + "%",
        );
        results.push(
          ...rows.map((r) => ({
            ...r,
            type: table,
            url:
              table === "tasks" || table === "evidence"
                ? `${route}/${r.id}`
                : `${route}?q=${encodeURIComponent(r.title)}&record=${r.id}`,
          })),
        );
      }
      return results;
    });
  },
};
