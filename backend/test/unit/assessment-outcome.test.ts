import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), state: vi.fn(), followup: vi.fn() }));
vi.mock('../../src/lib/prisma', () => ({ withTenantSchema: async (_schema: string, fn: (tx: unknown) => unknown) => fn({ $queryRawUnsafe: m.query, $executeRawUnsafe: m.execute }) }));
vi.mock('../../src/middleware/audit.middleware', () => ({ setAuditSessionVars: vi.fn() }));
vi.mock('../../src/modules/frameworks/implementation.service', () => ({ implementationForReview: m.state }));
vi.mock('../../src/modules/frameworks/compliance-followup', () => ({ complianceFollowup: m.followup }));
import { assessmentOutcomeService, outcomeSchema } from '../../src/modules/frameworks/assessment-outcome.service';

const actor = { id: '11111111-1111-4111-8111-111111111111', email: 'reviewer@example.invalid', role: 'auditor', tenantId: '22222222-2222-4222-8222-222222222222' };
const input = { kind: 'recorded' as const, authority: 'Independent assessor', reference: 'REPORT-01', note: 'The recorded report covers the agreed assessment scope and conditions.', issuedOn: '2026-01-01', nextReviewOn: '2099-01-01', evidenceId: '33333333-3333-4333-8333-333333333333' };
const state = () => ({ status: 'implemented', hash: 'current', profile: { outcome: 'certification' }, framework: { name: 'Example framework', short_name: null }, plan: { owner_id: 'other', submitted_by: 'preparer' }, outcome: { id: 'outcome', reference: 'REPORT-01', recorded_by: 'preparer', assessment_hash: 'current', proof_current: true, next_review_on: '2099-01-01', valid_until: null } });
beforeEach(() => { vi.clearAllMocks(); m.query.mockResolvedValue([]); m.execute.mockResolvedValue(1); m.state.mockResolvedValue(state()); });

describe('assessment outcome', () => {
  it('requires a valid report, actual issue date and ordered review dates', () => {
    expect(outcomeSchema.safeParse(input).success).toBe(true);
    expect(outcomeSchema.safeParse({ ...input, evidenceId: undefined }).success).toBe(false);
    expect(outcomeSchema.safeParse({ ...input, issuedOn: '2099-01-01' }).success).toBe(false);
    expect(outcomeSchema.safeParse({ ...input, nextReviewOn: '2025-01-01' }).success).toBe(false);
    expect(outcomeSchema.safeParse({ ...input, kind: 'not_sought', evidenceId: null }).success).toBe(true);
  });
  it('refuses an unreviewed assessment and an auditor attempting to prepare its outcome', async () => {
    await expect(assessmentOutcomeService.save('schema', 'framework', input, actor)).rejects.toThrow();
    m.state.mockResolvedValue({ ...state(), status: 'in_progress' });
    await expect(assessmentOutcomeService.save('schema', 'framework', input, { ...actor, role: 'admin' })).rejects.toMatchObject({ statusCode: 409 });
    expect(m.execute).not.toHaveBeenCalled();
  });
  it('refuses self-review, stale evidence and changed assessment records', async () => {
    m.state.mockResolvedValue({ ...state(), outcome: { ...state().outcome, recorded_by: actor.id } });
    await expect(assessmentOutcomeService.review('schema', 'framework', actor)).rejects.toThrow('different reviewer');
    m.state.mockResolvedValue({ ...state(), outcome: { ...state().outcome, proof_current: false } });
    await expect(assessmentOutcomeService.review('schema', 'framework', actor)).rejects.toThrow('need updating');
    m.state.mockResolvedValue({ ...state(), hash: 'changed' });
    await expect(assessmentOutcomeService.review('schema', 'framework', actor)).rejects.toThrow('need updating');
    expect(m.followup).not.toHaveBeenCalled();
  });
  it('creates the owned calendar follow-up only after independent outcome review', async () => {
    await expect(assessmentOutcomeService.review('schema', 'framework', actor)).resolves.toEqual({ reviewed: true });
    expect(m.followup).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'assessment_outcome', ownerId: 'other', due: '2099-01-01', url: '/frameworks?framework=framework&step=outcome' }));
    expect(m.execute).toHaveBeenCalledWith(expect.stringContaining('reviewed_by'), 'framework', actor.id);
  });
});
