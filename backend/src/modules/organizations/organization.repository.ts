import { prisma } from '../../lib/prisma';
import { UpdateOrganizationDto } from './organization.types';

export const organizationRepository = {
  async findById(tenantId: string) {
    return prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        isActive: true,
        onboardingDoneAt: true,
        industry: true,
        website: true,
        phone: true,
        country: true,
        city: true,
        address: true,
        postalCode: true,
        size: true,
        logoUrl: true,
        timezone: true,
        dateFormat: true,
        dataResidencyRegion: true,
        notificationSettings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async update(tenantId: string, dto: UpdateOrganizationDto) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name          !== undefined && { name: dto.name }),
        ...(dto.industry      !== undefined && { industry: dto.industry }),
        ...(dto.website       !== undefined && { website: dto.website }),
        ...(dto.phone         !== undefined && { phone: dto.phone }),
        ...(dto.country       !== undefined && { country: dto.country }),
        ...(dto.city          !== undefined && { city: dto.city }),
        ...(dto.address       !== undefined && { address: dto.address }),
        ...(dto.postalCode    !== undefined && { postalCode: dto.postalCode }),
        ...(dto.size          !== undefined && { size: dto.size }),
        ...(dto.logoUrl       !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.timezone      !== undefined && { timezone: dto.timezone }),
        ...(dto.dateFormat    !== undefined && { dateFormat: dto.dateFormat }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        isActive: true,
        onboardingDoneAt: true,
        industry: true,
        website: true,
        phone: true,
        country: true,
        city: true,
        address: true,
        postalCode: true,
        size: true,
        logoUrl: true,
        timezone: true,
        dateFormat: true,
        dataResidencyRegion: true,
        notificationSettings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async markOnboardingComplete(tenantId: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardingDoneAt: new Date() },
      select: { id: true, onboardingDoneAt: true },
    });
  },
};
