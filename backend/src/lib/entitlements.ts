import { prisma } from './prisma';
import * as billingRepo from '../modules/billing/billing.repository';
import type { SubscriptionPlan } from '../modules/billing/billing.types';
import { lockedModulesFrom } from './plan-modules';

// ─── Entitlement model ───────────────────────────────────────────────────────
//
// Plans and limits existed in the database but were never checked anywhere:
// every organisation had unlimited access to every feature, forever, whether or
// not it had a subscription. This module is the layer that makes a plan mean
// something.
//
// States, in order of decreasing access:
//   trialing   in the free trial            — full access
//   active     paid and inside its period   — full access
//   grace      just lapsed, within GRACE_DAYS — full access, prompt to pay
//   read_only  past grace                   — reads allowed, writes blocked
//
// Added with catalogue 2026.2 (prompt section 8), without changing the above:
//   expiring   paid, 14 days or less left   — full access, renewal prompted
//   suspended  paused by Orion Soft         — reads allowed, writes blocked
//   cancelled  cancelled and past grace     — as read_only (reads allowed)
//
// Reads are never blocked. This is a compliance product: an organisation's
// audit evidence may be legally required at short notice, and locking a
// customer out of their own records over a failed card is the kind of harm that
// outweighs the payment leverage it buys.

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;
export const TRIAL_PLAN_SLUG = 'professional';
/** Trials start on the current Professional plan; the earlier one if it is missing. */
export const TRIAL_PLAN_SLUGS = ['professional_2026', TRIAL_PLAN_SLUG] as const;
export const EXPIRING_DAYS = 14;

export async function findTrialPlan(): Promise<SubscriptionPlan | null> {
  for (const slug of TRIAL_PLAN_SLUGS) {
    const plan = await billingRepo.findPlanBySlug(slug).catch(() => null);
    if (plan?.isActive) return plan;
  }
  return null;
}

export type EntitlementState = 'trialing' | 'active' | 'expiring' | 'grace' | 'read_only' | 'suspended' | 'cancelled';

export interface Entitlement {
  state: EntitlementState;
  /** Writes are permitted. False only in read_only. */
  canWrite: boolean;
  /** When the current trial or paid period ends (null if unknown). */
  expiresAt: Date | null;
  /** Whole days until expiry; negative once lapsed. */
  daysRemaining: number | null;
  planName: string | null;
  planSlug: string | null;
  /** Hours until expiry (the countdown); negative once lapsed. */
  hoursRemaining: number | null;
  /** Modules the plan switches off (explicit false only); [] = every module. */
  lockedModules: string[];
  catalogVersion: string | null;
  /** AI requests a month on this plan; null = no plan limit. */
  aiRequestsMonthly: number | null;
  /** Limits that apply right now; null for a given metric means unlimited. */
  limits: {
    users: number | null;
    frameworks: number | null;
    evidenceGb: number | null;
    branches: number | null;
    departments: number | null;
  };
}

const DAY_MS = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

function limitsFrom(plan: SubscriptionPlan | null): Entitlement['limits'] {
  return {
    users:       plan?.maxUsers ?? null,
    frameworks:  plan?.maxFrameworks ?? null,
    evidenceGb:  plan?.maxEvidenceGb ?? null,
    branches:    plan?.maxBranches ?? null,
    departments: plan?.maxDepartments ?? null,
  };
}

/**
 * Resolves what a tenant is currently entitled to.
 *
 * Handles the no-subscription case deliberately rather than denying it: every
 * organisation created before entitlements existed has no subscription row, and
 * treating those as expired would lock out existing customers on deploy. They
 * are instead given the same trial, anchored to when the organisation was
 * created — so an org made today gets its full trial, and one made two months
 * ago is already past it and lands in read_only, which is the correct answer.
 */
export async function getEntitlement(tenantId: string): Promise<Entitlement> {
  const sub = await billingRepo.findSubscriptionByTenant(tenantId);
  const now = new Date();

  if (!sub) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { createdAt: true },
    });
    const trialPlan = await findTrialPlan();
    const anchor = tenant?.createdAt ?? now;
    const expiresAt = new Date(anchor.getTime() + TRIAL_DAYS * DAY_MS);
    return withPlan(buildFromExpiry(expiresAt, now, trialPlan, trialPlan?.name ?? 'Trial', trialPlan?.slug ?? null), trialPlan);
  }

  const plan = await billingRepo.findPlanById(sub.planId);

  // Subscription dates come back as strings from the raw-SQL repository, so
  // parse before comparing. An invalid date yields NaN, which would silently
  // make every comparison false — toDate returns null instead so the caller
  // falls into the explicit "no date" branch and fails open.
  const trialEndsAt = toDate(sub.trialEndsAt);
  const periodEnd = toDate(sub.currentPeriodEnd);

  // A cancelled subscription still runs to the end of the period already paid for.
  const expiresAt =
    trialEndsAt && trialEndsAt.getTime() > now.getTime() ? trialEndsAt : periodEnd;

  const ent = withPlan(buildFromExpiry(expiresAt, now, plan, plan?.name ?? null, plan?.slug ?? null, trialEndsAt), plan);
  // Suspended by Orion Soft (status paused): records stay viewable, no changes.
  if (sub.status === 'paused') return { ...ent, state: 'suspended', canWrite: false };
  if (ent.state === 'read_only' && sub.status === 'cancelled') return { ...ent, state: 'cancelled' };
  return ent;
}

/** Adds the plan's module locks and AI allowance, and the expiring state. */
function withPlan(ent: Entitlement, plan: SubscriptionPlan | null): Entitlement {
  const out: Entitlement = {
    ...ent,
    // PLAN_MODULE_LOCKS=off turns module locks off without a code change (staged
    // rollout or an instant rollback, prompt section 14). Limits and states are unaffected.
    lockedModules: process.env.PLAN_MODULE_LOCKS === 'off' ? [] : lockedModulesFrom(plan?.modules),
    catalogVersion: plan?.catalogVersion ?? null,
    aiRequestsMonthly: plan?.maxAiRequestsMonthly ?? null,
  };
  if (out.state === 'active' && out.daysRemaining !== null && out.daysRemaining <= EXPIRING_DAYS) out.state = 'expiring';
  return out;
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildFromExpiry(
  expiresAt: Date | null,
  now: Date,
  plan: SubscriptionPlan | null,
  planName: string | null,
  planSlug: string | null,
  trialEndsAt?: Date | null,
): Entitlement {
  const base = {
    planName, planSlug, limits: limitsFrom(plan),
    lockedModules: [] as string[], catalogVersion: null, aiRequestsMonthly: null,
  };

  if (!expiresAt) {
    // No date to reason about — fail open rather than locking someone out on
    // incomplete data. A missing period is a bug on our side, not the
    // customer's problem.
    return { ...base, state: 'active', canWrite: true, expiresAt: null, daysRemaining: null, hoursRemaining: null };
  }

  const daysRemaining = daysBetween(now, expiresAt);
  // The server's clock decides; the browser only displays this countdown.
  const hoursRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / 3_600_000);
  const inTrial = Boolean(trialEndsAt && trialEndsAt.getTime() > now.getTime());
  const dates = { expiresAt, daysRemaining, hoursRemaining };

  if (now.getTime() < expiresAt.getTime()) {
    return { ...base, ...dates, state: inTrial ? 'trialing' : 'active', canWrite: true };
  }

  const graceEnds = new Date(expiresAt.getTime() + GRACE_DAYS * DAY_MS);
  if (now.getTime() < graceEnds.getTime()) {
    return { ...base, ...dates, state: 'grace', canWrite: true };
  }

  return { ...base, ...dates, state: 'read_only', canWrite: false };
}
// ─── Plan limits ─────────────────────────────────────────────────────────────

export type LimitMetric = keyof Entitlement['limits'];

export const LIMIT_LABELS: Record<LimitMetric, string> = {
  users: 'team members',
  frameworks: 'frameworks',
  evidenceGb: 'GB of evidence storage',
  branches: 'branches',
  departments: 'departments',
};

/**
 * True when adding `increment` more of `metric` would exceed the plan.
 * A null limit means unlimited, so nothing is ever over it.
 */
export function exceedsLimit(
  ent: Entitlement,
  metric: LimitMetric,
  currentCount: number,
  increment = 1,
): boolean {
  const limit = ent.limits[metric];
  if (limit === null) return false;
  return currentCount + increment > limit;
}

/**
 * Background jobs run only for modules the organisation's plan includes
 * (prompt section 4: every background task follows the plan too). Fails
 * SAFELY: a lookup problem skips this run of a paid module's job (the next
 * run picks it up) rather than running it unpaid (prompt section 6).
 */
export async function moduleAllowed(tenantId: string, module: string): Promise<boolean> {
  try {
    return !(await getEntitlement(tenantId)).lockedModules.includes(module);
  } catch {
    return false;
  }
}