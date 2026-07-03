import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { TeamMember, ApiKeyPublic, WebhookPublic } from './settings.types';

export const settingsRepository = {
  // ── Team Members ──────────────────────────────────────────────────────────

  async listMembers(tenantId: string): Promise<TeamMember[]> {
    const rows = await prisma.$queryRaw<TeamMember[]>`
      SELECT
        tm.id,
        tm.user_id       as "userId",
        u.email,
        u.first_name     as "firstName",
        u.last_name      as "lastName",
        u.avatar_url     as "avatarUrl",
        tm.role,
        tm.is_active     as "isActive",
        u.email_verified_at as "emailVerifiedAt",
        tm.joined_at     as "joinedAt",
        tm.invited_by    as "invitedBy",
        inv.email        as "inviterEmail",
        tm.created_at    as "createdAt"
      FROM global.tenant_memberships tm
      JOIN global.users u ON u.id = tm.user_id
      LEFT JOIN global.users inv ON inv.id = tm.invited_by
      WHERE tm.tenant_id = ${tenantId}::uuid
        AND tm.deleted_at IS NULL
        AND u.deleted_at IS NULL
      ORDER BY tm.created_at ASC
    `;
    return rows;
  },

  async findMembership(tenantId: string, membershipId: string) {
    return prisma.tenantMembership.findFirst({
      where: { id: membershipId, tenantId, deletedAt: null },
      include: { user: { select: { id: true, email: true } } },
    });
  },

  async findMembershipByUserId(tenantId: string, userId: string) {
    return prisma.tenantMembership.findFirst({
      where: { tenantId, userId, deletedAt: null },
    });
  },

  async createMembership(
    tenantId: string,
    userId: string,
    role: string,
    invitedBy: string,
  ) {
    return prisma.tenantMembership.create({
      data: {
        tenantId,
        userId,
        role: role as never,
        invitedBy,
        isActive: false, // active after they accept the invite
      },
    });
  },

  async updateMemberRole(membershipId: string, role: string) {
    return prisma.tenantMembership.update({
      where: { id: membershipId },
      data: { role: role as never },
    });
  },

  async deactivateMember(membershipId: string) {
    return prisma.tenantMembership.update({
      where: { id: membershipId },
      data: { isActive: false, deletedAt: new Date() },
    });
  },

  async countActiveOwners(tenantId: string): Promise<number> {
    return prisma.tenantMembership.count({
      where: {
        tenantId,
        role: 'owner',
        isActive: true,
        deletedAt: null,
      },
    });
  },

  // ── API Keys ──────────────────────────────────────────────────────────────

  async listApiKeys(tenantId: string): Promise<ApiKeyPublic[]> {
    return prisma.apiKey.findMany({
      where: { tenantId, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createApiKey(data: {
    tenantId: string;
    createdBy: string;
    name: string;
    keyHash: string;
    keyPrefix: string;
    permissions: string[];
    expiresAt: Date | null;
  }) {
    return prisma.apiKey.create({ data });
  },

  async findApiKeyByHash(keyHash: string) {
    return prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        tenantId: true,
        permissions: true,
        revokedAt: true,
        expiresAt: true,
      },
    });
  },

  async revokeApiKey(id: string, tenantId: string): Promise<boolean> {
    const result = await prisma.apiKey.updateMany({
      where: { id, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  },

  async touchApiKeyLastUsed(id: string) {
    await prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  },

  // ── Webhooks ──────────────────────────────────────────────────────────────

  async listWebhooks(tenantId: string): Promise<WebhookPublic[]> {
    return prisma.webhook.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        lastTriggeredAt: true,
        lastStatusCode: true,
        failureCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createWebhook(data: {
    tenantId: string;
    createdBy: string;
    name: string;
    url: string;
    secretHash: string;
    events: string[];
  }) {
    return prisma.webhook.create({ data });
  },

  async updateWebhook(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      url?: string;
      events?: string[];
      isActive?: boolean;
      secretHash?: string;
    },
  ) {
    return prisma.webhook.updateMany({
      where: { id, tenantId },
      data,
    });
  },

  async deleteWebhook(id: string, tenantId: string): Promise<boolean> {
    const result = await prisma.webhook.deleteMany({ where: { id, tenantId } });
    return result.count > 0;
  },

  // ── Notification Settings ─────────────────────────────────────────────────

  async getNotificationSettings(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { notificationSettings: true },
    });
  },

  async updateNotificationSettings(tenantId: string, settings: Record<string, unknown>) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { notificationSettings: settings as Prisma.InputJsonValue },
      select: { notificationSettings: true },
    });
  },
};
