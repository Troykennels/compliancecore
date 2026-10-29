import { z } from 'zod';
import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { AppError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { assertActiveMembers } from '../../lib/active-member';

export interface PrivacyActor { id: string; email: string; role: string | null }

const text = (max = 5000) => z.string().trim().max(max);
const optionalText = (max = 5000) => text(max).optional().nullable().transform(v => v || null);
const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.');

export const LAWFUL_BASES = ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'] as const;
export const REQUEST_TYPES = ['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection', 'other'] as const;

export const activitySchema = z.object({
  name: text(300).min(3),
  purpose: text().min(10),
  lawfulBasis: z.enum(LAWFUL_BASES),
  dataSubjects: text(1000).min(3),
  dataCategories: text(2000).min(3),
  specialCategories: z.boolean().default(false),
  recipients: optionalText(),
  transfers: optionalText(),
  transferSafeguard: optionalText(),
  retention: text(1000).min(3),
  securityMeasures: optionalText(),
  ownerId: uuid.nullable().optional(),
  status: z.enum(['draft', 'active', 'retired']).default('draft'),
  reviewDate: date.nullable().optional(),
}).superRefine((v, ctx) => {
  if (v.transfers && !v.transferSafeguard) ctx.addIssue({ code: 'custom', path: ['transferSafeguard'], message: 'Record the safeguard used for the international transfer.' });
  if (v.status === 'active' && !v.ownerId) ctx.addIssue({ code: 'custom', path: ['ownerId'], message: 'An active record of processing needs an accountable owner.' });
});

export const requestSchema = z.object({
  requester: text(300).min(2),
  requestType: z.enum(REQUEST_TYPES),
  receivedOn: date,
  dueDate: date.optional(),
  identityVerified: z.boolean().default(false),
  extensionReason: optionalText(),
  status: z.enum(['received', 'verifying', 'in_progress', 'completed', 'refused']).default('received'),
  outcome: optionalText(),
  respondedOn: date.nullable().optional(),
  ownerId: uuid.nullable().optional(),
});

export const assessmentSchema = z.object({
  title: text(300).min(3),
  activityId: uuid.nullable().optional(),
  description: text().min(10),
  necessity: optionalText(),
  risks: optionalText(),
  mitigations: optionalText(),
  residualRisk: z.enum(['not_assessed', 'low', 'medium', 'high']).default('not_assessed'),
  consultationRequired: z.boolean().default(false),
  dpoAdvice: optionalText(),
  ownerId: uuid.nullable().optional(),
  reviewDate: date.nullable().optional(),
});

export const decisionSchema = z.object({ decision: z.enum(['submit', 'approve', 'reject', 'return']), note: text(2000).optional() });

/** Statutory default response period. GDPR allows one month and the NDPA 30 days; the shorter is used unless extended with a reason. */
export const DEFAULT_RESPONSE_DAYS = 30;
function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const today = () => new Date().toISOString().slice(0, 10);

const ACTIVITY_COLUMNS = `id, name, purpose, lawful_basis AS "lawfulBasis", data_subjects AS "dataSubjects", data_categories AS "dataCategories",
  special_categories AS "specialCategories", recipients, transfers, transfer_safeguard AS "transferSafeguard", retention,
  security_measures AS "securityMeasures", owner_id AS "ownerId", status, review_date AS "reviewDate", updated_at AS "updatedAt"`;
const REQUEST_COLUMNS = `id, reference, requester, request_type AS "requestType", received_on AS "receivedOn", due_date AS "dueDate",
  identity_verified AS "identityVerified", extension_reason AS "extensionReason", status, outcome, responded_on AS "respondedOn",
  owner_id AS "ownerId", updated_at AS "updatedAt",
  (status NOT IN ('completed','refused') AND due_date < CURRENT_DATE) AS overdue`;
const ASSESSMENT_COLUMNS = `id, title, activity_id AS "activityId", description, necessity, risks, mitigations, residual_risk AS "residualRisk",
  consultation_required AS "consultationRequired", dpo_advice AS "dpoAdvice", status, owner_id AS "ownerId", reviewed_by AS "reviewedBy",
  created_by AS "createdBy", review_date AS "reviewDate", updated_at AS "updatedAt"`;

export const privacyService = {
  async summary(schema: string) {
    return withTenantSchema(schema, async tx => {
      const [row] = await tx.$queryRawUnsafe<Array<Record<string, number>>>(`SELECT
        (SELECT COUNT(*)::int FROM privacy_processing_activities WHERE deleted_at IS NULL AND status='active') AS "activeActivities",
        (SELECT COUNT(*)::int FROM privacy_requests WHERE deleted_at IS NULL AND status NOT IN ('completed','refused')) AS "openRequests",
        (SELECT COUNT(*)::int FROM privacy_requests WHERE deleted_at IS NULL AND status NOT IN ('completed','refused') AND due_date < CURRENT_DATE) AS "overdueRequests",
        (SELECT COUNT(*)::int FROM privacy_impact_assessments WHERE deleted_at IS NULL AND status IN ('draft','in_review')) AS "openAssessments"`);
      return row;
    });
  },

  // Records of processing -----------------------------------------------------------
  async listActivities(schema: string) {
    return withTenantSchema(schema, tx => tx.$queryRawUnsafe(`SELECT ${ACTIVITY_COLUMNS} FROM privacy_processing_activities WHERE deleted_at IS NULL ORDER BY status, name`));
  },
  async saveActivity(schema: string, input: z.infer<typeof activitySchema>, actor: PrivacyActor, id?: string) {
    await assertActiveMembers(schema, [input.ownerId ?? undefined]);
    return withTenantSchema(schema, async tx => {
      await setAuditSessionVars(tx, actor);
      const values = [input.name, input.purpose, input.lawfulBasis, input.dataSubjects, input.dataCategories, input.specialCategories,
        input.recipients ?? null, input.transfers ?? null, input.transferSafeguard ?? null, input.retention, input.securityMeasures ?? null,
        input.ownerId ?? null, input.status, input.reviewDate ?? null];
      if (id) {
        const rows = await tx.$queryRawUnsafe<unknown[]>(`UPDATE privacy_processing_activities SET name=$2, purpose=$3, lawful_basis=$4, data_subjects=$5,
          data_categories=$6, special_categories=$7, recipients=$8, transfers=$9, transfer_safeguard=$10, retention=$11, security_measures=$12,
          owner_id=$13::uuid, status=$14, review_date=$15::date, updated_at=NOW() WHERE id=$1::uuid AND deleted_at IS NULL RETURNING ${ACTIVITY_COLUMNS}`, id, ...values);
        if (!rows[0]) throw new NotFoundError('Record of processing not found.');
        return rows[0];
      }
      const rows = await tx.$queryRawUnsafe<unknown[]>(`INSERT INTO privacy_processing_activities(name, purpose, lawful_basis, data_subjects, data_categories,
        special_categories, recipients, transfers, transfer_safeguard, retention, security_measures, owner_id, status, review_date, created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::uuid,$13,$14::date,$15::uuid) RETURNING ${ACTIVITY_COLUMNS}`, ...values, actor.id);
      return rows[0];
    });
  },

  // Data subject requests -------------------------------------------------------------
  async listRequests(schema: string) {
    return withTenantSchema(schema, tx => tx.$queryRawUnsafe(`SELECT ${REQUEST_COLUMNS} FROM privacy_requests WHERE deleted_at IS NULL
      ORDER BY (status IN ('completed','refused')), due_date`));
  },
  async saveRequest(schema: string, input: z.infer<typeof requestSchema>, actor: PrivacyActor, id?: string) {
    await assertActiveMembers(schema, [input.ownerId ?? undefined]);
    const due = input.dueDate ?? addDays(input.receivedOn, DEFAULT_RESPONSE_DAYS);
    if (due < input.receivedOn) throw new AppError('The due date cannot be before the request was received.', 422);
    if (due > addDays(input.receivedOn, DEFAULT_RESPONSE_DAYS) && !input.extensionReason)
      throw new AppError('Record why the response period was extended and confirm the requester was told.', 422);
    if (input.receivedOn > today()) throw new AppError('The received date cannot be in the future.', 422);
    if (input.status === 'completed' && (!input.identityVerified || !input.outcome || !input.respondedOn))
      throw new AppError('Before completing, confirm identity, record the outcome and the date of the response.', 422);
    if (input.status === 'refused' && !input.outcome) throw new AppError('Record the reason for refusing the request.', 422);
    return withTenantSchema(schema, async tx => {
      await setAuditSessionVars(tx, actor);
      const values = [input.requester, input.requestType, input.receivedOn, due, input.identityVerified, input.extensionReason ?? null,
        input.status, input.outcome ?? null, input.respondedOn ?? null, input.ownerId ?? null];
      if (id) {
        const rows = await tx.$queryRawUnsafe<unknown[]>(`UPDATE privacy_requests SET requester=$2, request_type=$3, received_on=$4::date, due_date=$5::date,
          identity_verified=$6, extension_reason=$7, status=$8, outcome=$9, responded_on=$10::date, owner_id=$11::uuid, updated_at=NOW()
          WHERE id=$1::uuid AND deleted_at IS NULL RETURNING ${REQUEST_COLUMNS}`, id, ...values);
        if (!rows[0]) throw new NotFoundError('Data subject request not found.');
        return rows[0];
      }
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext(current_schema() || ':privacy-request-reference'))`);
      const year = input.receivedOn.slice(0, 4);
      const [{ next }] = await tx.$queryRawUnsafe<Array<{ next: number }>>(`SELECT COUNT(*)::int + 1 AS next FROM privacy_requests WHERE reference LIKE $1`, `DSR-${year}-%`);
      const reference = `DSR-${year}-${String(next).padStart(4, '0')}`;
      const rows = await tx.$queryRawUnsafe<unknown[]>(`INSERT INTO privacy_requests(reference, requester, request_type, received_on, due_date,
        identity_verified, extension_reason, status, outcome, responded_on, owner_id, created_by)
        VALUES($1,$2,$3,$4::date,$5::date,$6,$7,$8,$9,$10::date,$11::uuid,$12::uuid) RETURNING ${REQUEST_COLUMNS}`, reference, ...values, actor.id);
      return rows[0];
    });
  },

  // Impact assessments ----------------------------------------------------------------
  async listAssessments(schema: string) {
    return withTenantSchema(schema, tx => tx.$queryRawUnsafe(`SELECT ${ASSESSMENT_COLUMNS} FROM privacy_impact_assessments WHERE deleted_at IS NULL ORDER BY status, title`));
  },
  async saveAssessment(schema: string, input: z.infer<typeof assessmentSchema>, actor: PrivacyActor, id?: string) {
    await assertActiveMembers(schema, [input.ownerId ?? undefined]);
    return withTenantSchema(schema, async tx => {
      await setAuditSessionVars(tx, actor);
      if (input.activityId) {
        const found = await tx.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM privacy_processing_activities WHERE id=$1::uuid AND deleted_at IS NULL`, input.activityId);
        if (!found[0]) throw new AppError('Choose a current record of processing.', 422);
      }
      const values = [input.title, input.activityId ?? null, input.description, input.necessity ?? null, input.risks ?? null, input.mitigations ?? null,
        input.residualRisk, input.consultationRequired, input.dpoAdvice ?? null, input.ownerId ?? null, input.reviewDate ?? null];
      if (id) {
        const current = await tx.$queryRawUnsafe<Array<{ status: string }>>(`SELECT status FROM privacy_impact_assessments WHERE id=$1::uuid AND deleted_at IS NULL FOR UPDATE`, id);
        if (!current[0]) throw new NotFoundError('Impact assessment not found.');
        // Changing an approved assessment reopens it, so the approval always matches the reviewed text.
        const rows = await tx.$queryRawUnsafe<unknown[]>(`UPDATE privacy_impact_assessments SET title=$2, activity_id=$3::uuid, description=$4, necessity=$5,
          risks=$6, mitigations=$7, residual_risk=$8, consultation_required=$9, dpo_advice=$10, owner_id=$11::uuid, review_date=$12::date,
          status=CASE WHEN status IN ('approved','rejected') THEN 'draft' ELSE status END,
          reviewed_by=CASE WHEN status IN ('approved','rejected') THEN NULL ELSE reviewed_by END, updated_at=NOW()
          WHERE id=$1::uuid RETURNING ${ASSESSMENT_COLUMNS}`, id, ...values);
        return rows[0];
      }
      const rows = await tx.$queryRawUnsafe<unknown[]>(`INSERT INTO privacy_impact_assessments(title, activity_id, description, necessity, risks, mitigations,
        residual_risk, consultation_required, dpo_advice, owner_id, review_date, created_by)
        VALUES($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10::uuid,$11::date,$12::uuid) RETURNING ${ASSESSMENT_COLUMNS}`, ...values, actor.id);
      return rows[0];
    });
  },
  async decideAssessment(schema: string, id: string, input: z.infer<typeof decisionSchema>, actor: PrivacyActor) {
    return withTenantSchema(schema, async tx => {
      await setAuditSessionVars(tx, actor);
      const [row] = await tx.$queryRawUnsafe<Array<{ status: string; owner_id: string | null; created_by: string | null; residual_risk: string; risks: string | null; mitigations: string | null; necessity: string | null }>>(
        `SELECT status, owner_id, created_by, residual_risk, risks, mitigations, necessity FROM privacy_impact_assessments WHERE id=$1::uuid AND deleted_at IS NULL FOR UPDATE`, id);
      if (!row) throw new NotFoundError('Impact assessment not found.');
      let next: string;
      if (input.decision === 'submit') {
        if (row.status !== 'draft') throw new AppError('Only a draft can be submitted for review.', 409);
        if (!row.necessity || !row.risks || !row.mitigations || row.residual_risk === 'not_assessed')
          throw new AppError('Record necessity, risks, mitigations and the remaining risk before submitting.', 422);
        next = 'in_review';
      } else {
        if (row.status !== 'in_review') throw new AppError('Only an assessment in review can be decided.', 409);
        if (actor.id === row.owner_id || actor.id === row.created_by) throw new ForbiddenError('A different authorised person reviews this impact assessment.');
        if (input.decision !== 'return' && (input.note ?? '').trim().length < 10) throw new AppError('Record the reason for the decision.', 422);
        next = input.decision === 'approve' ? 'approved' : input.decision === 'reject' ? 'rejected' : 'draft';
      }
      const reviewer = ['approve', 'reject'].includes(input.decision) ? actor.id : null;
      const rows = await tx.$queryRawUnsafe<unknown[]>(`UPDATE privacy_impact_assessments SET status=$2, reviewed_by=$3::uuid,
        dpo_advice=CASE WHEN $4::text IS NULL THEN dpo_advice ELSE COALESCE(dpo_advice || E'\\n\\n','') || $4::text END, updated_at=NOW()
        WHERE id=$1::uuid RETURNING ${ASSESSMENT_COLUMNS}`, id, next, reviewer, input.note?.trim() ? `${input.decision === 'submit' ? 'Submitted' : 'Review decision'} (${today()}): ${input.note.trim()}` : null);
      return rows[0];
    });
  },
};
