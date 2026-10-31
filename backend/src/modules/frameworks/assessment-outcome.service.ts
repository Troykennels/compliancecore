import { z } from 'zod';
import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { AppError, ForbiddenError } from '../../lib/errors';
import { implementationForReview } from './implementation.service';
import { complianceFollowup } from './compliance-followup';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };
export const outcomeSchema = z
  .object({
    kind: z.enum(['recorded', 'not_sought']),
    authority: z.string().trim().min(2).max(500),
    reference: z.string().trim().min(2).max(500),
    note: z.string().trim().min(30).max(10000),
    issuedOn: z.string().date(),
    nextReviewOn: z.string().date(),
    validUntil: z.string().date().nullable().optional(),
    evidenceId: z.string().uuid().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.nextReviewOn < v.issuedOn || (v.validUntil && v.validUntil < v.issuedOn))
      ctx.addIssue({
        code: 'custom',
        message: 'Review and validity dates must follow the issue date.',
      });
    if (v.kind === 'recorded' && !v.evidenceId)
      ctx.addIssue({ code: 'custom', message: 'Attach the issued document or final report.' });
    if (v.issuedOn > new Date().toISOString().slice(0, 10))
      ctx.addIssue({ code: 'custom', message: 'The outcome issue date cannot be in the future.' });
  });

export const assessmentOutcomeService = {
  async save(
    schema: string,
    frameworkId: string,
    input: z.infer<typeof outcomeSchema>,
    actor: Actor,
  ) {
    if (!['owner', 'admin', 'compliance_manager', 'msp_admin'].includes(actor.role ?? ''))
      throw new ForbiddenError();
    return withTenantSchema(
      schema,
      async (tx) => {
        await tx.$queryRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))::text',
          'framework-implementation:' + frameworkId,
        );
        const state = await implementationForReview(tx, frameworkId, actor);
        if (state.status !== 'implemented')
          throw new AppError(
            'Complete the assessment and its independent sign-off before recording the final outcome.',
            409,
            'ASSESSMENT_REVIEW_REQUIRED',
          );
        if (input.kind === 'not_sought' && state.profile.outcome !== 'certification')
          throw new AppError(
            'This outcome requires a report or assurance record. The optional certification decision does not apply.',
            422,
          );
        let versionId: string | null = null;
        if (input.kind === 'recorded') {
          const rows = await tx.$queryRawUnsafe<Array<{ current_version_id: string }>>(
            `SELECT e.current_version_id FROM evidence e JOIN evidence_versions v ON v.id=e.current_version_id
          WHERE e.id=$1::uuid AND e.deleted_at IS NULL AND e.status='active' AND v.upload_status='completed' AND (e.retention_date IS NULL OR e.retention_date>NOW())`,
            input.evidenceId,
          );
          if (!rows[0])
            throw new AppError(
              'Choose active evidence with a completed upload and a current retention period.',
              422,
            );
          versionId = rows[0].current_version_id;
        }
        await setAuditSessionVars(tx, actor);
        const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `INSERT INTO assessment_outcomes(framework_id,kind,authority,reference,note,issued_on,next_review_on,valid_until,evidence_id,evidence_version_id,assessment_hash,recorded_by)
        VALUES($1::uuid,$2,$3,$4,$5,$6::date,$7::date,$8::date,$9::uuid,$10::uuid,$11,$12::uuid)
        ON CONFLICT(framework_id) DO UPDATE SET kind=EXCLUDED.kind,authority=EXCLUDED.authority,reference=EXCLUDED.reference,note=EXCLUDED.note,
        issued_on=EXCLUDED.issued_on,next_review_on=EXCLUDED.next_review_on,valid_until=EXCLUDED.valid_until,evidence_id=EXCLUDED.evidence_id,
        evidence_version_id=EXCLUDED.evidence_version_id,assessment_hash=EXCLUDED.assessment_hash,recorded_by=EXCLUDED.recorded_by,reviewed_by=NULL,reviewed_at=NULL,updated_at=NOW() RETURNING id`,
          frameworkId,
          input.kind,
          input.authority,
          input.reference,
          input.note,
          input.issuedOn,
          input.nextReviewOn,
          input.validUntil ?? null,
          input.kind === 'recorded' ? input.evidenceId : null,
          versionId,
          state.hash,
          actor.id,
        );
        await tx.$executeRawUnsafe(
          "UPDATE compliance_calendar_events SET status='cancelled',updated_at=NOW() WHERE source_key=$1",
          'compliance:assessment_outcome:' + rows[0].id,
        );
        await tx.$executeRawUnsafe(
          'INSERT INTO framework_implementation_events(framework_id,actor_id,action,note) VALUES($1::uuid,$2::uuid,$3,$4)',
          frameworkId,
          actor.id,
          'outcome_recorded',
          input.reference,
        );
        return rows[0];
      },
      { timeout: 20000 },
    );
  },
  async review(schema: string, frameworkId: string, actor: Actor) {
    if (
      !['owner', 'admin', 'compliance_manager', 'auditor', 'msp_admin'].includes(actor.role ?? '')
    )
      throw new ForbiddenError();
    return withTenantSchema(
      schema,
      async (tx) => {
        await tx.$queryRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))::text',
          'framework-implementation:' + frameworkId,
        );
        const state = await implementationForReview(tx, frameworkId, actor);
        const outcome = state.outcome;
        if (!outcome) throw new AppError('Record an outcome before requesting review.', 409);
        if (
          outcome.recorded_by === actor.id ||
          state.plan?.owner_id === actor.id ||
          state.plan?.submitted_by === actor.id
        )
          throw new AppError(
            'A different reviewer must verify this outcome.',
            409,
            'INDEPENDENT_REVIEW_REQUIRED',
          );
        if (
          state.status !== 'implemented' ||
          outcome.assessment_hash !== state.hash ||
          !outcome.proof_current ||
          new Date(outcome.next_review_on).getTime() <= Date.now() ||
          (outcome.valid_until && new Date(outcome.valid_until).getTime() <= Date.now())
        )
          throw new AppError(
            'The assessment, evidence or review dates need updating before this outcome can be confirmed.',
            409,
          );
        await setAuditSessionVars(tx, actor);
        await tx.$executeRawUnsafe(
          'UPDATE assessment_outcomes SET reviewed_by=$2::uuid,reviewed_at=NOW(),updated_at=NOW() WHERE framework_id=$1::uuid',
          frameworkId,
          actor.id,
        );
        await complianceFollowup(tx, {
          kind: 'assessment_outcome',
          id: outcome.id,
          title: `Review assessment outcome: ${state.framework.short_name || state.framework.name}`,
          due: new Date(outcome.next_review_on).toISOString().slice(0, 10),
          ownerId: state.plan!.owner_id,
          actorId: actor.id,
          url: `/frameworks?framework=${frameworkId}&step=outcome`,
        });
        await tx.$executeRawUnsafe(
          'INSERT INTO framework_implementation_events(framework_id,actor_id,action,note) VALUES($1::uuid,$2::uuid,$3,$4)',
          frameworkId,
          actor.id,
          'outcome_reviewed',
          outcome.reference,
        );
        return { reviewed: true };
      },
      { timeout: 20000 },
    );
  },
};
