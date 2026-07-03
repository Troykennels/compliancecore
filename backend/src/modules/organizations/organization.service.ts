import { randomUUID } from 'node:crypto';
import { organizationRepository } from './organization.repository';
import { UpdateOrganizationInput, CreateOrganizationInput } from './organization.schema';
import { AppError, NotFoundError } from '../../lib/errors';
import { invalidateTenantCache } from '../../middleware/tenant.middleware';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { prisma, tenantSchemaName } from '../../lib/prisma';
import { provisionTenantSchema, dropTenantSchema } from '../../lib/provisioning';

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
    const existing = await prisma.tenantMembership.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new AppError('You already belong to an organization.', 409, 'ALREADY_ONBOARDED');
    }

    const id = randomUUID();
    const schemaName = tenantSchemaName(id);
    const slug = makeSlug(input.name, id);

    // Provision the tenant schema + tables first. If the subsequent global
    // writes fail, tear the schema back down so we never orphan one.
    await provisionTenantSchema(schemaName);

    try {
      return await prisma.$transaction(async (tx) => {
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
};
