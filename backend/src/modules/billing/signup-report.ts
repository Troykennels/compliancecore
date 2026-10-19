import type { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../../lib/errors';

const testPattern = /^(?:maildiag\d+|(?:e2e|fix|mail|admin|victim)\d{10,})@example\.com$/i;
export function signupEvidence(email: string, owner: boolean) {
  if (owner) return { category: 'platform_owner', explanation: 'Platform-owner flag is set on this account.' };
  if (email.toLowerCase() === 'admin@demo.com') return { category: 'demo', explanation: 'Matches the default account in scripts/seed-demo.mjs. Confirm before deleting.' };
  if (testPattern.test(email)) return { category: 'test_pattern', explanation: 'Matches a diagnostic or automation email pattern on the reserved example.com domain. Who created it is not recorded.' };
  return { category: 'unclassified', explanation: 'No recorded test provenance. Do not assume this is a test or a genuine prospect from its name alone.' };
}

const stages: Record<string, string> = {
  all: 'TRUE',
  unverified: 'u.email_verified_at IS NULL',
  incomplete: "u.email_verified_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM global.tenant_memberships m JOIN global.tenants t ON t.id=m.tenant_id WHERE m.user_id=u.id AND m.deleted_at IS NULL AND t.deleted_at IS NULL)",
  trial: "EXISTS (SELECT 1 FROM global.tenant_memberships m JOIN global.tenants t ON t.id=m.tenant_id JOIN global.subscriptions s ON s.tenant_id=t.id WHERE m.user_id=u.id AND m.deleted_at IS NULL AND t.deleted_at IS NULL AND s.status='trial' AND s.trial_ends_at>NOW())",
  expired_trial: "EXISTS (SELECT 1 FROM global.tenant_memberships m JOIN global.tenants t ON t.id=m.tenant_id JOIN global.subscriptions s ON s.tenant_id=t.id WHERE m.user_id=u.id AND m.deleted_at IS NULL AND t.deleted_at IS NULL AND s.status='trial' AND s.trial_ends_at<=NOW() AND (s.current_period_end IS NULL OR s.current_period_end<=NOW()))",
};
export async function listSignups(query: Record<string, unknown>) {
  const page = Number(query.page ?? 1), pageSize = Number(query.pageSize ?? 50);
  const stage = String(query.stage ?? 'all'), search = String(query.search ?? '').trim();
  if (!Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || !Object.hasOwn(stages, stage) || search.length > 160) throw new ValidationError('Invalid signup search or page.');
  const followup = String(query.followup ?? 'all');
  if (!['all','new','contacted','interested','converted','not_interested','test'].includes(followup)) throw new ValidationError('Invalid follow-up status.');
  const days = Number(query.days ?? 0);
  if (![0,7,30,90].includes(days)) throw new ValidationError('Invalid signup date range.');
  const term = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  // Every value is bound; the only SQL fragment comes from the fixed stage map.
  const where = `u.deleted_at IS NULL AND ($3::int=0 OR u.created_at>=NOW()-make_interval(days=>$3::int)) AND ($2='all' OR COALESCE(f.status,'new')=$2) AND (${stages[stage]}) AND ($1='%%' OR u.email ILIKE $1 OR concat_ws(' ',u.first_name,u.last_name) ILIKE $1 OR EXISTS (SELECT 1 FROM global.tenant_memberships ms JOIN global.tenants ts ON ts.id=ms.tenant_id WHERE ms.user_id=u.id AND ms.deleted_at IS NULL AND ts.deleted_at IS NULL AND ts.name ILIKE $1))`;
  const counts = await prisma.$queryRawUnsafe<Array<{ total: number; unverified: number; active_trials: number; expired_trials: number; followups_due: number }>>(`SELECT COUNT(*)::int total, COUNT(*) FILTER(WHERE u.email_verified_at IS NULL)::int unverified, COUNT(*) FILTER(WHERE ${stages.trial})::int active_trials, COUNT(*) FILTER(WHERE ${stages.expired_trial})::int expired_trials, COUNT(*) FILTER(WHERE f.follow_up_on<=CURRENT_DATE AND f.status NOT IN ('test','converted','not_interested'))::int followups_due FROM global.users u LEFT JOIN global.signup_followups f ON f.user_id=u.id WHERE ${where}`, term, followup, days);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, any>>>(`
    SELECT u.id,u.email,u.first_name,u.last_name,u.created_at,u.email_verified_at,u.onboarding_completed_at,u.is_active,u.is_superadmin,f.status AS followup_status,f.notes,f.follow_up_on,f.updated_at AS followup_updated_at,
      (SELECT MAX(created_at) FROM global.sessions WHERE user_id=u.id) AS last_sign_in_at,
      (SELECT MAX(last_active_at) FROM global.sessions WHERE user_id=u.id) AS last_activity_at,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'role',m.role,'joinedAt',m.joined_at,'createdAt',t.created_at,'phone',t.phone,'country',t.country,'industry',t.industry,'plan',p.name,'subscriptionStatus',s.status,'trialEndsAt',s.trial_ends_at,'paidThrough',s.current_period_end) ORDER BY m.created_at) FROM global.tenant_memberships m JOIN global.tenants t ON t.id=m.tenant_id LEFT JOIN global.subscriptions s ON s.tenant_id=t.id LEFT JOIN global.subscription_plans p ON p.id=s.plan_id WHERE m.user_id=u.id AND m.deleted_at IS NULL AND t.deleted_at IS NULL),'[]'::jsonb) AS organisations
    FROM global.users u LEFT JOIN global.signup_followups f ON f.user_id=u.id WHERE ${where} ORDER BY u.created_at DESC,u.id LIMIT $4 OFFSET $5`, term, followup, days, pageSize, (page - 1) * pageSize);
  return {
    total: counts[0]?.total ?? 0, page, pageSize, summary: { unverified: counts[0]?.unverified ?? 0, activeTrials: counts[0]?.active_trials ?? 0, expiredTrials: counts[0]?.expired_trials ?? 0, followupsDue: counts[0]?.followups_due ?? 0 },
    records: rows.map(row => ({ id: row.id, email: row.email, name: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Name not supplied', joinedAt: row.created_at, emailVerifiedAt: row.email_verified_at, onboardingCompletedAt: row.onboarding_completed_at, isActive: row.is_active, lastSignInAt: row.last_sign_in_at, lastActivityAt: row.last_activity_at, evidence: signupEvidence(row.email, row.is_superadmin), followup: { status: row.followup_status || 'new', notes: row.notes || '', followUpOn: row.follow_up_on, updatedAt: row.followup_updated_at }, organisations: row.organisations })),
  };
}
export async function adminSignups(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ success: true, data: await listSignups(req.query) });
}

const followupSchema = z.object({
  status: z.enum(['new','contacted','interested','converted','not_interested','test']),
  notes: z.string().max(4000).default(''),
  followUpOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value, 'Enter a real follow-up date').nullable().default(null),
}).strict();
export async function updateSignupFollowup(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  const parsed = followupSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Check the follow-up status, notes and date.');
  const person = await prisma.user.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true } });
  if (!person) throw new NotFoundError('Signup');
  const value = parsed.data;
  await prisma.$executeRawUnsafe(`INSERT INTO global.signup_followups(user_id,status,notes,follow_up_on,updated_by) VALUES ($1::uuid,$2,$3,$4::date,$5::uuid)
    ON CONFLICT(user_id) DO UPDATE SET status=EXCLUDED.status,notes=EXCLUDED.notes,follow_up_on=EXCLUDED.follow_up_on,updated_by=EXCLUDED.updated_by,updated_at=NOW()`, req.params.id, value.status, value.notes, value.followUpOn, req.user!.id);
  res.json({ success: true, data: { saved: true } });
}
