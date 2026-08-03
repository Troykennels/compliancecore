import { randomUUID } from 'node:crypto';
import { organizationRepository } from './organization.repository';
import { UpdateOrganizationInput, CreateOrganizationInput } from './organization.schema';
import { AppError, NotFoundError } from '../../lib/errors';
import { invalidateTenantCache } from '../../middleware/tenant.middleware';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { prisma, tenantSchemaName } from '../../lib/prisma';
import { provisionTenantSchema, dropTenantSchema } from '../../lib/provisioning';
import { logger } from '../../lib/logger';
import { TRIAL_DAYS, TRIAL_PLAN_SLUG } from '../../lib/entitlements';
import * as billingRepo from '../billing/billing.repository';
import * as billingService from '../billing/billing.service';
import {
  scopingProfileSchema, recommendFrameworks, type FrameworkRecommendation,
} from './scoping';

// Deterministic, URL-safe, collision-free slug: slugified name + short id suffix.
function makeSlug(name: string, id: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'org';
  return `${base}-${id.replace(/-/g, '').slice(0, 8)}`;
}

export const organizationService = {
  /**
   * Create the caller's first organization: provision its dedicated tenant
   * schema (with all per-tenant tables), then create the tenant row, an owner
   * membership, and mark the user's onboarding complete — atomically for the
   * global writes, with schema teardown if those writes fail.
   */
  async createOrganization(userId: string, input: CreateOrganizationInput) {
    // A user may only belong to one org via this onboarding path.
    //
    // Retrying returns the organisation that already exists instead of a 409.
    // Provisioning a tenant schema is slow enough that a PaaS gateway timeout or
    // an impatient reload can drop the response *after* the tenant was committed
    // — the client then sees a failure for work that actually succeeded. Failing
    // the retry with "you already belong to an organization" strands the user on
    // the onboarding screen with no way forward, which is precisely the reported
    // bug. Onboarding is idempotent from the caller's point of view: same input,
    // same outcome, safe to repeat.
    const existing = await prisma.tenantMembership.findFirst({
      where: { userId, deletedAt: null },
      select: { tenantId: true },
    });
    if (existing) {
      const org = await prisma.tenant.findFirst({
        where: { id: existing.tenantId, deletedAt: null },
        select: {
          id: true, name: true, slug: true, plan: true, onboardingDoneAt: true,
          industry: true, size: true, createdAt: true,
        },
      });
      if (org) {
        logger.info({ userId, tenantId: org.id }, 'Onboarding retried — returning existing organization');
        return org;
      }
      // Membership pointing at a deleted tenant is genuinely inconsistent state;
      // let the caller see it rather than silently provisioning a second org.
      throw new AppError('You already belong to an organization.', 409, 'ALREADY_ONBOARDED');
    }

    const id = randomUUID();
    const schemaName = tenantSchemaName(id);
    const slug = makeSlug(input.name, id);

    // Provision the tenant schema + tables first. If the subsequent global
    // writes fail, tear the schema back down so we never orphan one.
    await provisionTenantSchema(schemaName);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            id,
            name: input.name,
            slug,
            schemaName,
            plan: 'starter',
            ...(input.industry !== undefined && { industry: input.industry }),
            ...(input.size !== undefined && { size: input.size }),
          },
          select: {
            id: true, name: true, slug: true, plan: true, onboardingDoneAt: true,
            industry: true, size: true, createdAt: true,
          },
        });

        await tx.tenantMembership.create({
          data: { tenantId: id, userId, role: 'owner', joinedAt: new Date(), isActive: true },
        });

        await tx.user.update({
          where: { id: userId },
          data: { onboardingCompletedAt: new Date() },
        });

        return tenant;
      });

      // Start the free trial. Deliberately outside the transaction above and
      // non-fatal: billing lives in its own raw-SQL tables, and a failure here
      // must not roll back — or worse, tear down — a tenant that was created
      // successfully. getEntitlement() falls back to a trial anchored on the
      // tenant's createdAt, so an organisation whose subscription row failed to
      // write still gets its full trial rather than being locked out.
      try {
        const plan = await billingRepo.findPlanBySlug(TRIAL_PLAN_SLUG);
        if (plan) {
          await billingService.createSubscription(
            id,
            { planId: plan.id, billingCycle: 'monthly' },
            { trialDays: TRIAL_DAYS },
          );
        }
      } catch (err) {
        logger.error({ err, tenantId: id }, 'Could not start trial subscription — falling back to date-anchored trial');
      }

      return created;
    } catch (err) {
      await dropTenantSchema(schemaName);
      throw err;
    }
  },

  async getProfile(tenantId: string) {
    const org = await organizationRepository.findById(tenantId);
    if (!org) throw new NotFoundError('Organization not found.');
    return org;
  },

  async updateProfile(
    tenantId: string,
    input: UpdateOrganizationInput,
    actor: { id: string; email: string; role: string },
  ) {
    const org = await organizationRepository.findById(tenantId);
    if (!org) throw new NotFoundError('Organization not found.');

    const updated = await prisma.$transaction(async (tx) => {
      await setAuditSessionVars(tx, actor);
      return tx.tenant.update({
        where: { id: tenantId },
        data: {
          ...(input.name       !== undefined && { name: input.name }),
          ...(input.industry   !== undefined && { industry: input.industry }),
          ...(input.website    !== undefined && { website: input.website ?? null }),
          ...(input.phone      !== undefined && { phone: input.phone }),
          ...(input.country    !== undefined && { country: input.country }),
          ...(input.city       !== undefined && { city: input.city }),
          ...(input.address    !== undefined && { address: input.address }),
          ...(input.postalCode !== undefined && { postalCode: input.postalCode }),
          ...(input.size       !== undefined && { size: input.size }),
          ...(input.logoUrl    !== undefined && { logoUrl: input.logoUrl ?? null }),
          ...(input.timezone   !== undefined && { timezone: input.timezone }),
          ...(input.dateFormat !== undefined && { dateFormat: input.dateFormat }),
        },
        select: {
          id: true, name: true, slug: true, plan: true, isActive: true,
          onboardingDoneAt: true, industry: true, website: true, phone: true,
          country: true, city: true, address: true, postalCode: true, size: true,
          logoUrl: true, timezone: true, dateFormat: true, dataResidencyRegion: true,
          notificationSettings: true, createdAt: true, updatedAt: true,
        },
      });
    });

    // Bust the in-memory cache so subsequent requests see the new name/plan
    invalidateTenantCache(tenantId);

    return updated;
  },

  async completeOnboarding(tenantId: string) {
    const org = await organizationRepository.findById(tenantId);
    if (!org) throw new NotFoundError('Organization not found.');
    return organizationRepository.markOnboardingComplete(tenantId);
  },

  /**
   * Returns the saved scoping answers plus the frameworks they imply.
   *
   * Recommendations are recomputed on read rather than stored, so adding a new
   * regulation to the rule set immediately benefits every existing tenant
   * instead of only those who re-answer the questionnaire.
   */
  async getScoping(tenantId: string) {
    const rows = await prisma.$queryRaw<{ scoping_profile: unknown; scoping_completed_at: Date | null }[]>`
      SELECT scoping_profile, scoping_completed_at
      FROM global.tenants WHERE id = ${tenantId}::uuid AND deleted_at IS NULL
    `;
    if (!rows.length) throw new NotFoundError('Organization not found.');

    const raw = rows[0].scoping_profile;
    if (!raw) {
      return { profile: null, completedAt: null, recommendations: [] as FrameworkRecommendation[] };
    }

    // Parse rather than trust: the stored blob predates any later change to the
    // question set, and defaults fill in anything that was not asked back then.
    const parsed = scopingProfileSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn({ tenantId }, 'Stored scoping profile no longer matches the schema — treating as unanswered');
      return { profile: null, completedAt: null, recommendations: [] as FrameworkRecommendation[] };
    }

    return {
      profile: parsed.data,
      completedAt: rows[0].scoping_completed_at?.toISOString() ?? null,
      recommendations: recommendFrameworks(parsed.data),
    };
  },

  async saveScoping(tenantId: string, input: unknown) {
    const profile = scopingProfileSchema.parse(input);

    const updated = await prisma.$executeRaw`
      UPDATE global.tenants
      SET scoping_profile = ${JSON.stringify(profile)}::jsonb,
          scoping_completed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${tenantId}::uuid AND deleted_at IS NULL
    `;
    if (updated === 0) throw new NotFoundError('Organization not found.');

    invalidateTenantCache(tenantId);
    return { profile, recommendations: recommendFrameworks(profile) };
  },
};
