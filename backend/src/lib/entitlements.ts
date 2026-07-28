import { prisma } from './prisma';
import * as billingRepo from '../modules/billing/billing.repository';
import type { SubscriptionPlan } from '../modules/billing/billing.types';

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
// Reads are never blocked. This is a compliance product: an organisation's
// audit evidence may be legally required at short notice, and locking a
// customer out of their own records over a failed card is the kind of harm that
// outweighs the payment leverage it buys.

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;
export const TRIAL_PLAN_SLUG = 'professional';

export type EntitlementState = 'trialing' | 'active' | 'grace' | 'read_only';

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
    const trialPlan = await billingRepo.findPlanBySlug(TRIAL_PLAN_SLUG).catch(() => null);
    const anchor = tenant?.createdAt ?? now;
    const expiresAt = new Date(anchor.getTime() + TRIAL_DAYS * DAY_MS);
    return buildFromExpiry(expiresAt, now, trialPlan, trialPlan?.name ?? 'Trial', trialPlan?.slug ?? null);
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

  return buildFromExpiry(expiresAt, now, plan, plan?.name ?? null, plan?.slug ?? null, trialEndsAt);
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
  const limits = limitsFrom(plan);

  if (!expiresAt) {
    // No date to reason about — fail open rather than locking someone out on
    // incomplete data. A missing period is a bug on our side, not the
    // customer's problem.
    return { state: 'active', canWrite: true, expiresAt: null, daysRemaining: null, planName, planSlug, limits };
  }

  const daysRemaining = daysBetween(now, expiresAt);
  const inTrial = Boolean(trialEndsAt && trialEndsAt.getTime() > now.getTime());

  if (now.getTime() < expiresAt.getTime()) {
    return {
      state: inTrial ? 'trialing' : 'active',
      canWrite: true,
      expiresAt,
      daysRemaining,
      planName,
      planSlug,
      limits,
    };
  }

  const graceEnds = new Date(expiresAt.getTime() + GRACE_DAYS * DAY_MS);
  if (now.getTime() < graceEnds.getTime()) {
    return { state: 'grace', canWrite: true, expiresAt, daysRemaining, planName, planSlug, limits };
  }

  return { state: 'read_only', canWrite: false, expiresAt, daysRemaining, planName, planSlug, limits };
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
