import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { withTenantSchema } from '../../lib/prisma';
import { AppError, NotFoundError, ForbiddenError } from '../../lib/errors';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import {
  implementationGates,
  implementationSnapshot,
  effectiveImplementationStatus,
  type ImplementationControl,
  type ImplementationPolicy,
} from './implementation-rules';
import { complianceProfile } from './compliance-profiles';
import {
  riskAssessed,
  treatmentPlanned,
  residualReviewed,
  type AssessmentRisk,
} from './assessment-rules';

type Tx = Prisma.TransactionClient;
type Actor = { id: string; email: string; role: string | null; tenantId: string | null };
interface Preparation {
  baseline?: string;
  risks?: string;
  managementReview?: string;
  internalAuditId?: string | null;
  trainingProgramId?: string | null;
  obligations?: string;
  riskMethod?: string;
  assessmentPeriod?: string;
  monitoring?: string;
}
interface Plan {
  owner_active: boolean;
  framework_id: string;
  scope: string;
  objective: string;
  owner_id: string;
  target_date: Date;
  status: string;
  review_hash: string | null;
  review_due_at: Date | null;
  submitted_by: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  review_note: string | null;
  preparation: Preparation;
}
interface Framework {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  library_count: number;
  library_refs: string[];
}
type Control = ImplementationControl & { framework_id: string; updated_at: Date };
type Policy = ImplementationPolicy & { framework_ids: string[]; updated_at: Date };
export const implementationPlanSchema = z.object({
  scope: z.string().trim().min(30).max(5000),
  objective: z.string().trim().min(20).max(3000),
  ownerId: z.string().uuid(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
      'Enter a valid date.',
    ),
});
function manager(actor: Actor) {
  if (!['owner', 'admin', 'compliance_manager', 'msp_admin'].includes(actor.role ?? ''))
    throw new ForbiddenError(
      'Only an owner, administrator or compliance manager can change an implementation plan.',
    );
}
async function lock(tx: Tx, id: string) {
  await tx.$queryRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1))::text',
    'framework-implementation:' + id,
  );
}
async function event(tx: Tx, id: string, actor: Actor, action: string, note: string | null = null) {
  await tx.$executeRawUnsafe(
    'INSERT INTO framework_implementation_events(framework_id,actor_id,action,note) VALUES($1::uuid,$2::uuid,$3,$4)',
    id,
    actor.id,
    action,
    note,
  );
}
async function load(tx: Tx, tenantId: string | null) {
  const frameworks = await tx.$queryRawUnsafe<Framework[]>(
    `SELECT f.id,f.code,f.name,f.short_name,(SELECT count(*)::int FROM framework_data.framework_controls l WHERE l.framework_id=f.id) library_count,ARRAY(SELECT l.control_ref FROM framework_data.framework_controls l WHERE l.framework_id=f.id ORDER BY l.control_ref) library_refs FROM framework_data.frameworks f WHERE f.deleted_at IS NULL ORDER BY f.name`,
  );
  const plans = await tx.$queryRawUnsafe<Plan[]>(
    "SELECT p.*,COALESCE(NULLIF(concat_ws(' ',u.first_name,u.last_name),''),u.email) owner_name,EXISTS(SELECT 1 FROM global.tenant_memberships m WHERE m.tenant_id=$1::uuid AND m.user_id=p.owner_id AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL) owner_active FROM framework_implementations p LEFT JOIN global.users u ON u.id=p.owner_id",
    tenantId,
  );
  const controls = await tx.$queryRawUnsafe<Control[]>(
    `SELECT c.*, EXISTS(SELECT 1 FROM global.tenant_memberships m JOIN global.users u ON u.id=m.user_id WHERE m.tenant_id=$1::uuid AND m.user_id=c.owner_id AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL) owner_active,
 (SELECT count(*)::int FROM evidence_links l JOIN evidence e ON e.id=l.evidence_id JOIN evidence_versions v ON v.id=e.current_version_id WHERE l.linked_type='control' AND l.linked_id=c.id AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()) AND v.upload_status='completed') current_evidence
 ,(SELECT COALESCE(NULLIF(concat_ws(' ',u.first_name,u.last_name),''),u.email) FROM global.users u WHERE u.id=c.owner_id) owner_name
 FROM controls c WHERE c.deleted_at IS NULL ORDER BY c.control_ref,c.id`,
    tenantId,
  );
  const policies = await tx.$queryRawUnsafe<Policy[]>(
    `SELECT p.*,EXISTS(SELECT 1 FROM global.tenant_memberships m JOIN global.users u ON u.id=m.user_id WHERE m.tenant_id=$1::uuid AND m.user_id=p.owner_id AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL) owner_active FROM policies p WHERE p.deleted_at IS NULL ORDER BY p.id`,
    tenantId,
  );
  const evidence = await tx.$queryRawUnsafe<Array<{ linked_id: string; [key: string]: unknown }>>(
    `SELECT l.linked_id,l.id link_id,e.id,e.status,e.retention_date,e.current_version_id,v.checksum_sha256,v.upload_status FROM evidence_links l JOIN evidence e ON e.id=l.evidence_id LEFT JOIN evidence_versions v ON v.id=e.current_version_id WHERE l.linked_type='control' AND e.deleted_at IS NULL ORDER BY l.id`,
  );
  const soa = await tx.$queryRawUnsafe<
    Array<{
      control_id: string;
      applicable: boolean;
      justification: string;
      decided_by: string;
      decided_at: Date;
    }>
  >('SELECT * FROM framework_control_applicability ORDER BY control_id');
  const audits = await tx.$queryRawUnsafe<
    Array<{
      id: string;
      title: string;
      framework_ref: string | null;
      audit_type: string;
      status: string;
      summary: string | null;
      scope: string | null;
      end_date: Date | null;
      updated_at: Date;
      reviewed_by: string | null;
      report_current: boolean;
    }>
  >(
    "SELECT a.*,EXISTS(SELECT 1 FROM evidence e JOIN evidence_versions v ON v.id=e.current_version_id WHERE e.id=a.report_evidence_id AND e.current_version_id=a.report_evidence_version_id AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()) AND v.upload_status='completed') report_current FROM audits a WHERE a.deleted_at IS NULL ORDER BY a.id",
  );
  const findings = await tx.$queryRawUnsafe<
    Array<{ audit_id: string; status: string; verification_current: boolean }>
  >(
    "SELECT f.*,EXISTS(SELECT 1 FROM evidence e WHERE e.id=f.closure_evidence_id AND e.current_version_id=f.closure_evidence_version_id AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW())) verification_current FROM audit_findings f ORDER BY f.id",
  );
  const training = await tx.$queryRawUnsafe<Array<{ id: string; title: string; status: string }>>(
    'SELECT id,title,status FROM training_programs WHERE deleted_at IS NULL ORDER BY id',
  );
  const trainingRecords = await tx.$queryRawUnsafe<
    Array<{ program_id: string; user_id: string; status: string; completed_at: Date | null }>
  >('SELECT * FROM training_records ORDER BY id');
  const tasks = await tx.$queryRawUnsafe<
    Array<{ id: string; framework_id: string; status: string }>
  >(
    'SELECT id,framework_id,status FROM tasks WHERE deleted_at IS NULL AND framework_id IS NOT NULL ORDER BY id',
  );
  const engagements = await tx.$queryRawUnsafe<
    Array<{ framework_id: string; status: string; answers: Record<string, string> }>
  >('SELECT * FROM scope_engagements ORDER BY id');
  const risks = await tx.$queryRawUnsafe<
    Array<AssessmentRisk & { framework_id: string; updated_at: Date }>
  >(
    `SELECT r.*,EXISTS(SELECT 1 FROM global.tenant_memberships m JOIN global.users u ON u.id=m.user_id WHERE m.tenant_id=$1::uuid AND m.user_id=r.owner_id AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL) owner_active FROM risks r WHERE r.deleted_at IS NULL AND (r.framework_id IS NOT NULL OR EXISTS(SELECT 1 FROM risk_control_links l WHERE l.risk_id=r.id)) ORDER BY r.id`,
    tenantId,
  );
  const controlTests = await tx.$queryRawUnsafe<
    Array<{
      control_id: string;
      status: string;
      result: string;
      tested_at: Date;
      reviewed_at: Date | null;
      stale: boolean;
    }>
  >(
    `SELECT DISTINCT ON(t.control_id) t.control_id,t.status,t.result,t.tested_at,t.reviewed_at,(c.updated_at>t.tested_at OR EXISTS(SELECT 1 FROM jsonb_array_elements(t.evidence_versions) s LEFT JOIN evidence e ON e.id=(s->>'id')::uuid WHERE e.id IS NULL OR e.deleted_at IS NOT NULL OR e.status<>'active' OR (e.retention_date IS NOT NULL AND e.retention_date<=NOW()) OR e.current_version_id IS DISTINCT FROM (s->>'current_version_id')::uuid)) stale FROM control_tests t JOIN controls c ON c.id=t.control_id ORDER BY t.control_id,t.tested_at DESC`,
  );
  const riskReviews = await tx.$queryRawUnsafe<
    Array<{ risk_id: string; decision: string; expires_on: Date; reviewed_at: Date }>
  >(
    'SELECT DISTINCT ON(risk_id) risk_id,decision,expires_on,reviewed_at FROM risk_reviews ORDER BY risk_id,reviewed_at DESC,id DESC',
  );
  const riskLinks = await tx.$queryRawUnsafe<
    Array<{ risk_id: string; control_id: string; framework_id: string }>
  >(
    'SELECT l.risk_id,l.control_id,c.framework_id FROM risk_control_links l JOIN controls c ON c.id=l.control_id WHERE c.deleted_at IS NULL',
  );
  const obligations = await tx.$queryRawUnsafe<
    Array<{
      id: string;
      status: string;
      review_date: Date;
      control_ids: string[];
      revision: number;
    }>
  >('SELECT id,status,review_date,control_ids,revision FROM compliance_obligations ORDER BY id');
  const outcomes = await tx.$queryRawUnsafe<
    Array<{
      id: string;
      framework_id: string;
      kind: string;
      authority: string;
      reference: string;
      note: string;
      issued_on: Date;
      next_review_on: Date;
      valid_until: Date | null;
      evidence_id: string | null;
      evidence_version_id: string | null;
      assessment_hash: string;
      recorded_by: string;
      reviewed_by: string | null;
      reviewed_at: Date | null;
      proof_current: boolean;
    }>
  >(
    "SELECT o.*,(o.kind='not_sought' OR EXISTS(SELECT 1 FROM evidence e JOIN evidence_versions v ON v.id=e.current_version_id WHERE e.id=o.evidence_id AND e.current_version_id=o.evidence_version_id AND e.deleted_at IS NULL AND e.status='active' AND v.upload_status='completed' AND (e.retention_date IS NULL OR e.retention_date>NOW()))) proof_current FROM assessment_outcomes o",
  );
  return {
    frameworks,
    plans,
    controls,
    policies,
    evidence,
    soa,
    audits,
    findings,
    training,
    trainingRecords,
    tasks,
    engagements,
    risks,
    controlTests,
    riskReviews,
    obligations,
    riskLinks,
    outcomes,
  };
}
type Loaded = Awaited<ReturnType<typeof load>>;
function state(data: Loaded, id: string) {
  const framework = data.frameworks.find((f) => f.id === id);
  if (!framework) throw new NotFoundError('Framework not found.');
  const plan = data.plans.find((p) => p.framework_id === id) ?? null;
  const controls = data.controls.filter((c) => c.framework_id === id);
  const policies = data.policies.filter(
    (p) => (p.framework_ids ?? []).includes(id) || (p.framework_ids ?? []).includes(framework.code),
  );
  const ids = new Set(controls.map((c) => c.id));
  const baseGates = implementationGates(plan, controls, policies);
  const soa = data.soa.filter((s) => ids.has(s.control_id));
  const prep = plan?.preparation ?? {};
  const audit = data.audits.find((a) => a.id === prep.internalAuditId);
  const findings = data.findings.filter((f) => f.audit_id === audit?.id);
  const tasks = data.tasks.filter((t) => t.framework_id === id);
  const completeLibrary =
    framework.library_count > 0 &&
    framework.library_refs.every((ref) => controls.some((c) => c.control_ref === ref));
  const profile = complianceProfile(framework.code);
  const engagements = data.engagements.filter((e) => e.framework_id === id);
  const risks = data.risks
    .filter(
      (r) =>
        r.framework_id === id ||
        data.riskLinks.some((l) => l.risk_id === r.id && l.framework_id === id),
    )
    .map((r) => ({
      ...r,
      control_ids: [
        ...new Set([
          ...r.control_ids.filter((c) => ids.has(c)),
          ...data.riskLinks
            .filter((l) => l.risk_id === r.id && l.framework_id === id)
            .map((l) => l.control_id),
        ]),
      ],
    }));
  const applicableControls = controls.filter((c) => c.implementation_status !== 'not_applicable');
  const operatingTestsDone =
    applicableControls.length > 0 &&
    applicableControls.every((c) => {
      const t = data.controlTests.find((t) => t.control_id === c.id);
      return (
        t?.status === 'approved' &&
        t.result === 'pass' &&
        !t.stale &&
        t.reviewed_at &&
        new Date(t.reviewed_at).getTime() + c.review_frequency_days * 86400000 > Date.now()
      );
    });
  const riskReviewsDone =
    risks.length > 0 &&
    risks.every((r) => {
      const v = data.riskReviews.find((v) => v.risk_id === r.id);
      return (
        v?.decision === 'approve' &&
        new Date(v.expires_on).getTime() + 86400000 > Date.now() &&
        new Date(v.reviewed_at).getTime() >= new Date(r.updated_at).getTime()
      );
    });
  const obligationsReviewed = data.obligations.some(
    (o) =>
      o.status === 'active' &&
      new Date(o.review_date).getTime() + 86400000 > Date.now() &&
      (!o.control_ids.length || o.control_ids.some((c) => ids.has(c))),
  );
  const risksDone =
    Boolean(prep.riskMethod?.trim() && prep.assessmentPeriod?.trim()) &&
    risks.length > 0 &&
    risks.every(riskAssessed);
  const treatmentsDone =
    risksDone &&
    risks.every(
      (r) =>
        treatmentPlanned(r) &&
        (r.treatment !== 'mitigate' ||
          r.control_ids.every((id) =>
            controls.some((c) => c.id === id && c.implementation_status !== 'not_applicable'),
          )),
    );
  const gates = [
    {
      ...baseGates[0],
      title: 'Scope and stakeholder engagement',
      done: Boolean(plan?.owner_active) && engagements.some((e) => e.status === 'confirmed'),
      detail:
        'Agree boundaries, responsibility and target date. Record and confirm consultations with the relevant stakeholders; review whether every affected department is represented.',
    },
    {
      key: 'obligations',
      title: 'Confirm applicable obligations',
      done: Boolean(prep.obligations?.trim()) && obligationsReviewed,
      detail:
        'Record the legal, contractual and framework requirements, official source and edition, reporting deadlines and scope decisions. Confirm the published library against the full current requirements.',
      href: '/frameworks',
    },
    {
      key: 'risk_assessment',
      title: 'Risk assessment: assets, events and consequences',
      done: risksDone,
      detail: `${risks.filter(riskAssessed).length}/${risks.length} risks assessed. Confirm the assessment period, scoring basis, responsible owners and likelihood/impact. Suggestions remain draft until reviewed.`,
      href: `/risks?frameworkId=${id}`,
    },
    {
      key: 'risk_treatment',
      title: 'Decide risk treatment and control mapping',
      done: treatmentsDone,
      detail:
        'For each risk record the response, action, owner and due date. Mitigation needs selected controls; acceptance needs a documented decision. A risk score never waives an applicable obligation.',
      href: `/risks?frameworkId=${id}`,
    },
    {
      key: 'soa',
      title: profile.applicabilityLabel,
      done:
        treatmentsDone &&
        completeLibrary &&
        controls.length > 0 &&
        controls.every((c) =>
          soa.some(
            (s) =>
              s.control_id === c.id &&
              s.justification.trim().length >= 20 &&
              s.applicable === (c.implementation_status !== 'not_applicable') &&
              (profile.outcome !== 'validation' || s.applicable || Number(c.current_evidence) > 0),
          ),
        ),
      detail: `After stakeholder scoping, risk assessment and treatment selection, record inclusion or justified non-applicability for each requirement. ${soa.length}/${controls.length} decisions recorded.`,
      href: '/frameworks',
    },
    { ...baseGates[1], title: 'Confirm responsible control owners' },
    baseGates[2],
    { ...baseGates[4], title: 'Collect current compliance evidence' },
    {
      ...baseGates[5],
      title: 'Verify control operation',
      done: operatingTestsDone && baseGates[3].done,
      detail:
        'Verify operating safeguards using current independently approved passing test records. A status or note alone is insufficient. Remediation belongs to corrective actions, not a separate implementation project stage.',
    },
    {
      key: 'corrective_actions',
      title: 'Resolve findings and review remaining risk',
      done:
        tasks.every((t) => ['completed', 'cancelled'].includes(t.status)) &&
        findings.every(
          (f) => ['resolved', 'accepted'].includes(f.status) && f.verification_current,
        ) &&
        risks.length > 0 &&
        risks.every(residualReviewed) &&
        riskReviewsDone,
      detail:
        'Close corrective actions, resolve or formally accept findings, and explain the remaining risk after the selected response. Projected residual ratings are not proof that a safeguard works.',
      href: '/tasks',
    },
    ...(profile.internalAudit
      ? [
          {
            key: 'internal_audit',
            title: 'Complete the required internal audit',
            done: Boolean(
              audit?.audit_type === 'internal' &&
                audit.status === 'completed' &&
                audit.reviewed_by &&
                audit.report_current &&
                audit.scope?.trim() &&
                audit.summary?.trim() &&
                audit.end_date &&
                new Date(audit.end_date).getTime() <= Date.now() &&
                [id, framework.code].includes(audit.framework_ref ?? '') &&
                findings.every(
                  (f) => ['resolved', 'accepted'].includes(f.status) && f.verification_current,
                ),
            ),
            detail:
              'Link the completed framework-specific internal audit and its findings. Keep independence and the full management-system requirements in view.',
            href: '/audits',
          },
        ]
      : []),
    ...(profile.managementReview
      ? [
          {
            key: 'management_review',
            title: 'Record management review',
            done: Boolean(prep.managementReview?.trim()),
            detail:
              'Record management review of assessment results, remaining risks, resources and required improvements.',
            href: '/frameworks',
          },
        ]
      : []),
    {
      key: 'monitoring',
      title: 'Plan reporting and continuing reviews',
      done: Boolean(prep.monitoring?.trim()),
      detail:
        'Record the next review, accountable person, change triggers, outstanding obligations and any regulatory or contractual reporting dates. External certification applies only where a relevant scheme is sought.',
      href: '/frameworks',
    },
  ];
  const hash = implementationSnapshot({
    scope: plan?.scope,
    objective: plan?.objective,
    owner: plan?.owner_id,
    target: plan?.target_date,
    prep,
    soa,
    controls,
    policies,
    audit,
    findings,
    tasks,
    engagements,
    risks,
    controlTests: data.controlTests.filter((t) => ids.has(t.control_id)),
    riskReviews: data.riskReviews.filter((v) => risks.some((r) => r.id === v.risk_id)),
    obligations: data.obligations,
    evidence: data.evidence.filter((e) => ids.has(e.linked_id)),
  });
  const status = effectiveImplementationStatus(plan, hash, gates);
  const applicable = controls.filter((c) => c.implementation_status !== 'not_applicable');
  const outcome = data.outcomes.find((o) => o.framework_id === id) ?? null;
  const outcomeCurrent = Boolean(
    outcome?.reviewed_by &&
      outcome.reviewed_at &&
      outcome.proof_current &&
      outcome.assessment_hash === hash &&
      status === 'implemented' &&
      new Date(outcome.next_review_on).getTime() > Date.now() &&
      (!outcome.valid_until || new Date(outcome.valid_until).getTime() > Date.now()),
  );
  return {
    framework,
    profile,
    plan,
    status,
    gates,
    hash,
    controls,
    policies,
    soa,
    outcome,
    outcomeCurrent,
    progress: Math.round((gates.filter((g) => g.done).length / gates.length) * 100),
    stats: {
      controls: controls.length,
      applicable: applicable.length,
      implemented: applicable.filter((c) => c.implementation_status === 'implemented').length,
      evidenced: applicable.filter((c) => Number(c.current_evidence) > 0).length,
      unassigned: applicable.filter((c) => !c.owner_id || !c.owner_active).length,
      overdue: applicable.filter(
        (c) =>
          c.due_date &&
          new Date(c.due_date).getTime() < Date.now() &&
          c.implementation_status !== 'implemented',
      ).length,
    },
  };
}
export async function implementationForReview(tx: Tx, id: string, actor: Actor) {
  return state(await load(tx, actor.tenantId), id);
}
function publicState(s: ReturnType<typeof state>) {
  const { hash: _hash, controls, policies, ...rest } = s;
  return {
    ...rest,
    controls: controls.map((c) => ({
      id: c.id,
      controlRef: c.control_ref,
      title: c.title,
      status: c.implementation_status,
      ownerId: c.owner_id,
      ownerName: (c as Control & { owner_name?: string }).owner_name ?? null,
      hasEvidence: Number(c.current_evidence) > 0,
      reviewedAt: c.last_reviewed_at,
    })),
    policies: policies.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      reviewDueDate: p.review_due_date,
    })),
  };
}
export const implementationService = {
  async overview(schema: string, actor: Actor) {
    return withTenantSchema(
      schema,
      async (tx) => {
        const data = await load(tx, actor.tenantId);
        return data.frameworks
          .filter(
            (f) =>
              data.plans.some((p) => p.framework_id === f.id) ||
              data.controls.some((c) => c.framework_id === f.id),
          )
          .map((f) => publicState(state(data, f.id)));
      },
      { timeout: 20000 },
    );
  },
  async get(schema: string, id: string, actor: Actor) {
    return withTenantSchema(
      schema,
      async (tx) => {
        const data = await load(tx, actor.tenantId);
        const s = publicState(state(data, id));
        const events = await tx.$queryRawUnsafe(
          'SELECT action,actor_id,created_at,note FROM framework_implementation_events WHERE framework_id=$1::uuid ORDER BY created_at DESC LIMIT 30',
          id,
        );
        return {
          ...s,
          events,
          auditOptions: data.audits
            .filter((a) => [id, s.framework.code].includes(a.framework_ref ?? ''))
            .map((a) => ({ id: a.id, title: a.title, status: a.status })),
          trainingOptions: data.training,
        };
      },
      { timeout: 20000 },
    );
  },
  async preparation(schema: string, id: string, input: Preparation, actor: Actor) {
    manager(actor);
    return withTenantSchema(schema, async (tx) => {
      await lock(tx, id);
      await setAuditSessionVars(tx, actor);
      const result = await tx.$executeRawUnsafe(
        "UPDATE framework_implementations SET preparation=preparation || $2::jsonb,status=CASE WHEN status='planning' THEN 'planning' ELSE 'in_progress' END,review_hash=NULL,updated_at=NOW() WHERE framework_id=$1::uuid",
        id,
        JSON.stringify(input),
      );
      if (!result) throw new AppError('Save the assessment scope first.', 409, 'SCOPE_REQUIRED');
      await event(tx, id, actor, 'preparation_updated');
      return { saved: true };
    });
  },
  async soa(
    schema: string,
    id: string,
    controlId: string,
    applicable: boolean,
    justification: string,
    actor: Actor,
    evidenceId?: string | null,
  ) {
    manager(actor);
    return withTenantSchema(schema, async (tx) => {
      await lock(tx, id);
      await setAuditSessionVars(tx, actor);
      const current = state(await load(tx, actor.tenantId), id);
      if (
        current.gates
          .filter((g) =>
            ['scope', 'obligations', 'risk_assessment', 'risk_treatment'].includes(g.key),
          )
          .some((g) => !g.done)
      )
        throw new AppError(
          'Complete stakeholder scoping, obligations, risk assessment and treatment decisions before finalising applicability.',
          409,
          'ASSESSMENT_REQUIRED',
        );
      if (!applicable && current.profile.outcome === 'validation' && !evidenceId)
        throw new AppError(
          'PCI non-applicability needs current uploaded supporting evidence, not a low risk score.',
          422,
          'APPLICABILITY_EVIDENCE_REQUIRED',
        );
      if (evidenceId) {
        const ev = await tx.$queryRawUnsafe<unknown[]>(
          "SELECT 1 FROM evidence e JOIN evidence_versions v ON v.id=e.current_version_id WHERE e.id=$1::uuid AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()) AND v.upload_status='completed'",
          evidenceId,
        );
        if (!ev.length)
          throw new AppError(
            'Choose a current evidence file with a completed upload.',
            422,
            'INVALID_EVIDENCE',
          );
      }
      if (!applicable) {
        const mapped = await tx.$queryRawUnsafe<unknown[]>(
          "SELECT 1 FROM risks WHERE framework_id=$1::uuid AND $2::uuid=ANY(control_ids) AND treatment='mitigate' AND deleted_at IS NULL",
          id,
          controlId,
        );
        if (mapped.length)
          throw new AppError(
            'This control is selected to treat a risk. Review its risk mapping before excluding it.',
            409,
            'CONTROL_TREATS_RISK',
          );
      }
      const c = await tx.$queryRawUnsafe<unknown[]>(
        'SELECT 1 FROM controls WHERE id=$1::uuid AND framework_id=$2::uuid AND deleted_at IS NULL',
        controlId,
        id,
      );
      if (!c.length) throw new NotFoundError('Control not found in this framework.');
      await tx.$executeRawUnsafe(
        'INSERT INTO framework_control_applicability(control_id,applicable,justification,decided_by,supporting_evidence_id) VALUES($1::uuid,$2,$3,$4::uuid,$5::uuid) ON CONFLICT(control_id) DO UPDATE SET applicable=$2,justification=$3,decided_by=$4::uuid,decided_at=NOW(),supporting_evidence_id=$5::uuid',
        controlId,
        applicable,
        justification,
        actor.id,
        evidenceId ?? null,
      );
      if (evidenceId)
        await tx.$executeRawUnsafe(
          "INSERT INTO evidence_links(evidence_id,linked_type,linked_id) SELECT $1::uuid,'control',$2::uuid WHERE NOT EXISTS(SELECT 1 FROM evidence_links WHERE evidence_id=$1::uuid AND linked_type='control' AND linked_id=$2::uuid)",
          evidenceId,
          controlId,
        );
      await tx.$executeRawUnsafe(
        "UPDATE controls SET implementation_status=CASE WHEN NOT $2 THEN 'not_applicable' WHEN implementation_status='not_applicable' THEN 'not_assessed' ELSE implementation_status END,implementation_notes=CASE WHEN NOT $2 THEN $3 ELSE implementation_notes END,last_reviewed_at=NULL,updated_by=$4::uuid,updated_at=NOW() WHERE id=$1::uuid",
        controlId,
        applicable,
        justification,
        actor.id,
      );
      await event(
        tx,
        id,
        actor,
        'soa_decision',
        controlId + ': ' + (applicable ? 'included' : 'excluded'),
      );
      return { saved: true };
    });
  },
  async members(schema: string, actor: Actor) {
    return withTenantSchema(schema, (tx) =>
      tx.$queryRawUnsafe(
        `SELECT u.id,m.role,COALESCE(NULLIF(concat_ws(' ',u.first_name,u.last_name),''),u.email) name FROM global.tenant_memberships m JOIN global.users u ON u.id=m.user_id WHERE m.tenant_id=$1::uuid AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL ORDER BY name`,
        actor.tenantId,
      ),
    );
  },
  async save(
    schema: string,
    id: string,
    input: z.infer<typeof implementationPlanSchema>,
    actor: Actor,
  ) {
    manager(actor);
    if (input.targetDate < new Date().toISOString().slice(0, 10))
      throw new AppError('Choose a current or future target date.', 422, 'INVALID_TARGET_DATE');
    return withTenantSchema(schema, async (tx) => {
      await lock(tx, id);
      await setAuditSessionVars(tx, actor);
      const f = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT id FROM framework_data.frameworks WHERE id=$1::uuid AND deleted_at IS NULL AND is_active',
        id,
      );
      if (!f.length) throw new NotFoundError('Active framework not found.');
      const owner = await tx.$queryRawUnsafe<unknown[]>(
        `SELECT 1 FROM global.tenant_memberships m JOIN global.users u ON u.id=m.user_id WHERE m.user_id=$1::uuid AND m.tenant_id=$2::uuid AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL`,
        input.ownerId,
        actor.tenantId,
      );
      if (!owner.length)
        throw new AppError(
          'Choose an active member of this organisation as owner.',
          422,
          'INVALID_OWNER',
        );
      await tx.$executeRawUnsafe(
        `INSERT INTO framework_implementations(framework_id,scope,objective,owner_id,target_date,created_by) VALUES($1::uuid,$2,$3,$4::uuid,$5::date,$6::uuid) ON CONFLICT(framework_id) DO UPDATE SET scope=$2,objective=$3,owner_id=$4::uuid,target_date=$5::date,status=CASE WHEN framework_implementations.status='planning' THEN 'planning' ELSE 'in_progress' END,review_hash=NULL,submitted_by=NULL,submitted_at=NULL,approved_by=NULL,approved_at=NULL,review_due_at=NULL,updated_at=NOW()`,
        id,
        input.scope,
        input.objective,
        input.ownerId,
        input.targetDate,
        actor.id,
      );
      await event(tx, id, actor, 'scope_saved');
      return { saved: true };
    });
  },
  async review(
    schema: string,
    id: string,
    action: 'submit' | 'approve' | 'return',
    note: string,
    actor: Actor,
  ) {
    if (action === 'submit') manager(actor);
    if (
      action !== 'submit' &&
      !['owner', 'admin', 'compliance_manager', 'auditor', 'msp_admin'].includes(actor.role ?? '')
    )
      throw new ForbiddenError('An authorised independent reviewer is required.');
    return withTenantSchema(
      schema,
      async (tx) => {
        await lock(tx, id);
        await setAuditSessionVars(tx, actor);
        const s = state(await load(tx, actor.tenantId), id);
        if (!s.plan)
          throw new AppError('Define the assessment scope first.', 409, 'SCOPE_REQUIRED');
        if (action === 'return') {
          if (note.trim().length < 10)
            throw new AppError(
              'Explain the changes needed before returning this plan.',
              422,
              'REVIEW_NOTE_REQUIRED',
            );
          await tx.$executeRawUnsafe(
            `UPDATE framework_implementations SET status='in_progress',review_hash=NULL,submitted_by=NULL,submitted_at=NULL,updated_at=NOW() WHERE framework_id=$1::uuid`,
            id,
          );
        } else {
          if (s.gates.some((g) => !g.done))
            throw new AppError(
              'Complete every compliance assessment check before review or sign-off.',
              409,
              'IMPLEMENTATION_INCOMPLETE',
              { gates: s.gates },
            );
          if (action === 'submit') {
            if (s.plan.status === 'planning')
              throw new AppError(
                'Prepare the assessment register before requesting review.',
                409,
                'IMPLEMENTATION_NOT_STARTED',
              );
            await tx.$executeRawUnsafe(
              `UPDATE framework_implementations SET status='in_review',submitted_by=$2::uuid,submitted_at=NOW(),review_hash=$3,updated_at=NOW() WHERE framework_id=$1::uuid`,
              id,
              actor.id,
              s.hash,
            );
          } else {
            if (s.plan.status !== 'in_review' || s.plan.review_hash !== s.hash)
              throw new AppError(
                'The records changed or are not awaiting review. Submit the current assessment again.',
                409,
                'STALE_IMPLEMENTATION',
              );
            if (s.plan.owner_id === actor.id || s.plan.submitted_by === actor.id)
              throw new ForbiddenError(
                'The assessment owner and submitter cannot approve their own assessment.',
              );
            if (note.trim().length < 20)
              throw new AppError(
                'Record the review performed and the sign-off conclusion.',
                422,
                'REVIEW_NOTE_REQUIRED',
              );
            await tx.$executeRawUnsafe(
              `UPDATE framework_implementations SET status='implemented',approved_by=$2::uuid,approved_at=NOW(),review_due_at=NOW()+INTERVAL '90 days',review_note=$3,updated_at=NOW() WHERE framework_id=$1::uuid`,
              id,
              actor.id,
              note,
            );
          }
        }
        await event(tx, id, actor, action, note);
        return { saved: true };
      },
      { timeout: 20000 },
    );
  },
  async actions(schema: string, id: string, actor: Actor) {
    manager(actor);
    return withTenantSchema(
      schema,
      async (tx) => {
        await lock(tx, id);
        await setAuditSessionVars(tx, actor);
        const s = state(await load(tx, actor.tenantId), id);
        if (!s.plan || s.plan.status === 'planning')
          throw new AppError('Prepare a scoped assessment register first.', 409, 'SCOPE_REQUIRED');
        let created = 0;
        for (const c of s.controls) {
          const needsWork =
            c.implementation_status !== 'not_applicable' &&
            (c.implementation_status !== 'implemented' ||
              !c.owner_active ||
              !c.implementation_notes?.trim() ||
              !c.testing_notes?.trim() ||
              !c.last_reviewed_at ||
              new Date(c.last_reviewed_at).getTime() + c.review_frequency_days * 86400000 <
                Date.now() ||
              Number(c.current_evidence) === 0);
          if (needsWork)
            created += await tx.$executeRawUnsafe(
              `INSERT INTO tasks(title,description,assigned_to,assigned_by,due_date,priority,status,entity_type,entity_id,framework_id,tags,created_by) SELECT $1,$2,$3::uuid,$4::uuid,$5::date,'high','todo','control',$6::uuid,$7::uuid,ARRAY['framework-implementation'],$4::uuid WHERE NOT EXISTS(SELECT 1 FROM tasks WHERE entity_type='control' AND entity_id=$6::uuid AND framework_id=$7::uuid AND 'framework-implementation'=ANY(tags) AND deleted_at IS NULL AND status NOT IN ('completed','cancelled'))`,
              'Review and resolve ' + c.control_ref,
              `Compliance follow-up for ${s.framework.name}: confirm applicability, assign responsibility, describe the operating safeguard, attach current evidence, record the check result and request review.`,
              c.owner_active ? c.owner_id : s.plan.owner_id,
              actor.id,
              s.plan.target_date,
              c.id,
              id,
            );
          else
            await tx.$executeRawUnsafe(
              `UPDATE tasks SET status='completed',completed_at=NOW(),updated_at=NOW() WHERE entity_type='control' AND entity_id=$1::uuid AND framework_id=$2::uuid AND 'framework-implementation'=ANY(tags) AND deleted_at IS NULL AND status NOT IN ('completed','cancelled')`,
              c.id,
              id,
            );
        }
        await event(tx, id, actor, 'actions_synchronised', `${created} new control actions`);
        return { created };
      },
      { timeout: 30000 },
    );
  },
};
