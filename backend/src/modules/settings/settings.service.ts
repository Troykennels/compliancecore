import crypto from 'crypto';
import { settingsRepository } from './settings.repository';
import { prisma } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../../lib/errors';
import {
  InviteMemberInput,
  UpdateMemberRoleInput,
  CreateApiKeyInput,
  CreateWebhookInput,
  UpdateWebhookInput,
  UpdateNotificationInput,
  AcceptInvitationInput,
} from './settings.schema';
import { email as emailClient } from '../../lib/email';
import { generateSecureToken, sha256 } from '../../lib/crypto';
import { revokeUserTokens } from '../../lib/token-revocation';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

// ── Team Members ────────────────────────────────────────────────────────────

const teamService = {
  async listMembers(tenantId: string) {
    return settingsRepository.listMembers(tenantId);
  },

  async inviteMember(tenantId: string, input: InviteMemberInput, actor: Actor) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) {
      const alreadyMember = await settingsRepository.findMembershipByUserId(
        tenantId,
        existing.id,
      );
      if (alreadyMember && alreadyMember.deletedAt === null) {
        throw new ConflictError('This user is already a member of your organisation.');
      }
    }

    // Generate a one-time invite token (same pattern as email verification):
    // the raw token goes in the email, only its hash is persisted.
    const { raw: inviteToken, hash: tokenHash } = generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await settingsRepository.createInvitation({
      tenantId,
      email: input.email,
      role: input.role,
      tokenHash,
      invitedBy: actor.id,
      expiresAt,
    });

    await emailClient.sendTeamInvitation({
      to: input.email,
      inviterName: actor.email,
      role: input.role,
      inviteToken,
      tenantId,
    });

    return { message: 'Invitation sent.' };
  },

  async acceptInvitation(input: AcceptInvitationInput, actor: Actor) {
    const tokenHash = sha256(input.token);
    const invitation = await settingsRepository.findPendingInvitationByTokenHash(tokenHash);
    if (!invitation) {
      throw new ValidationError('This invitation is invalid or has expired.');
    }

    // The invite is bound to the email it was sent to.
    if (invitation.email.toLowerCase() !== actor.email.toLowerCase()) {
      throw new ForbiddenError('This invitation was issued for a different email address.');
    }

    await settingsRepository.activateMembership(
      invitation.tenantId,
      actor.id,
      invitation.role,
      null,
    );
    await settingsRepository.markInvitationAccepted(invitation.id);

    return { message: 'Invitation accepted.', tenantId: invitation.tenantId };
  },

  async updateMemberRole(tenantId: string, membershipId: string, input: UpdateMemberRoleInput, actor: Actor) {
    const result = await prisma.$transaction(async tx => {
      // One tenant row serialises every ownership change, including removals.
      await tx.$queryRaw`SELECT id FROM global.tenants WHERE id=${tenantId}::uuid FOR UPDATE`;
      const acting = await settingsRepository.findMembershipByUserId(tenantId, actor.id, tx);
      if (!acting?.isActive || acting.role !== actor.role || !['owner','admin','msp_admin'].includes(acting.role)) {
        throw new ForbiddenError('Your team-management access changed. Sign in again before changing membership.');
      }
      await setAuditSessionVars(tx, actor);
      const membership = await settingsRepository.findMembership(tenantId, membershipId, tx);
      if (!membership) throw new NotFoundError('Team member not found.');
      if ((membership.role === 'owner' || input.role === 'owner') && acting.role !== 'owner') {
        throw new ForbiddenError('Only an owner can change ownership.');
      }
      if (membership.role === 'owner' && membership.isActive && membership.user?.isActive !== false && !membership.user?.deletedAt && input.role !== 'owner' && await settingsRepository.countActiveOwners(tenantId, tx) <= 1) {
        throw new ForbiddenError('Cannot change the role of the last owner. Promote another member to owner first.');
      }
      const updated = await settingsRepository.updateMemberRole(membershipId, input.role, tx);
      return {updated, userId: membership.userId};
    });
    await revokeUserTokens(result.userId, `role changed to ${input.role}`);
    return result.updated;
  },

  async removeMember(tenantId: string, membershipId: string, actor: Actor) {
    const userId = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM global.tenants WHERE id=${tenantId}::uuid FOR UPDATE`;
      const acting = await settingsRepository.findMembershipByUserId(tenantId, actor.id, tx);
      if (!acting?.isActive || acting.role !== actor.role || !['owner','admin','msp_admin'].includes(acting.role)) {
        throw new ForbiddenError('Your team-management access changed. Sign in again before changing membership.');
      }
      await setAuditSessionVars(tx, actor);
      const membership = await settingsRepository.findMembership(tenantId, membershipId, tx);
      if (!membership) throw new NotFoundError('Team member not found.');
      if (membership.userId === actor.id) throw new ForbiddenError('You cannot remove yourself. Ask another administrator.');
      if (membership.role === 'owner' && acting.role !== 'owner') throw new ForbiddenError('Only an owner can remove another owner.');
      if (membership.role === 'owner' && membership.isActive && membership.user?.isActive !== false && !membership.user?.deletedAt && await settingsRepository.countActiveOwners(tenantId, tx) <= 1) {
        throw new ForbiddenError('Cannot remove the last owner. Promote another member to owner first.');
      }
      await settingsRepository.deactivateMember(membershipId, tx);
      return membership.userId;
    });
    await revokeUserTokens(userId, 'removed from organisation');
  },
};

// ── API Keys ────────────────────────────────────────────────────────────────

const apiKeysService = {
  async list(tenantId: string) {
    return settingsRepository.listApiKeys(tenantId);
  },

  async create(tenantId: string, input: CreateApiKeyInput, actor: Actor) {
    // Generate 32 random bytes → 64 hex chars
    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = `cc_${rawKey.slice(0, 12)}`; // first 12 chars for display

    const apiKey = await settingsRepository.createApiKey({
      tenantId,
      createdBy: actor.id,
      name: input.name,
      keyHash,
      keyPrefix,
      permissions: input.permissions,
      expiresAt: input.expiresAt ?? null,
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: null,
      createdAt: apiKey.createdAt,
      rawKey: `cc_${rawKey}`, // returned once, never stored
    };
  },

  async revoke(tenantId: string, id: string) {
    const revoked = await settingsRepository.revokeApiKey(id, tenantId);
    if (!revoked) throw new NotFoundError('API key not found or already revoked.');
  },
};

// ── Webhooks ────────────────────────────────────────────────────────────────

const webhooksService = {
  async list(tenantId: string) {
    return settingsRepository.listWebhooks(tenantId);
  },

  async create(tenantId: string, input: CreateWebhookInput, actor: Actor) {
    // Generate HMAC signing secret
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

    const webhook = await settingsRepository.createWebhook({
      tenantId,
      createdBy: actor.id,
      name: input.name,
      url: input.url,
      secretHash,
      events: input.events,
    });

    return {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      lastTriggeredAt: webhook.lastTriggeredAt,
      lastStatusCode: webhook.lastStatusCode,
      failureCount: webhook.failureCount,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      secret, // returned once
    };
  },

  async update(tenantId: string, id: string, input: UpdateWebhookInput) {
    const data: Parameters<typeof settingsRepository.updateWebhook>[2] = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.url !== undefined) data.url = input.url;
    if (input.events !== undefined) data.events = input.events;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const result = await settingsRepository.updateWebhook(id, tenantId, data);
    if (result.count === 0) throw new NotFoundError('Webhook not found.');
  },

  async delete(tenantId: string, id: string) {
    const deleted = await settingsRepository.deleteWebhook(id, tenantId);
    if (!deleted) throw new NotFoundError('Webhook not found.');
  },

  async rotateSecret(tenantId: string, id: string) {
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
    const result = await settingsRepository.updateWebhook(id, tenantId, { secretHash });
    if (result.count === 0) throw new NotFoundError('Webhook not found.');
    return { secret };
  },
};

// ── Notification Settings ────────────────────────────────────────────────────

const notificationsService = {
  async get(tenantId: string) {
    const row = await settingsRepository.getNotificationSettings(tenantId);
    if (!row) throw new NotFoundError('Organization not found.');

    const defaults = {
      emailAlerts: {
        controlDue: true,
        controlOverdue: true,
        evidenceRequested: true,
        auditStarted: true,
        riskCreated: false,
        incidentCreated: true,
        frameworkAssigned: true,
      },
      digestFrequency: 'daily' as const,
      slackWebhookUrl: null,
      teamsWebhookUrl: null,
    };

    return { notificationSettings: { ...defaults, ...(row.notificationSettings as object) } };
  },

  async update(tenantId: string, input: UpdateNotificationInput) {
    const current = await settingsRepository.getNotificationSettings(tenantId);
    if (!current) throw new NotFoundError('Organization not found.');

    const merged = {
      ...(current.notificationSettings as Record<string, unknown>),
      ...input,
      emailAlerts: {
        ...((current.notificationSettings as Record<string, unknown>)?.emailAlerts as object),
        ...(input.emailAlerts ?? {}),
      },
    };

    return settingsRepository.updateNotificationSettings(tenantId, merged);
  },
};

export const settingsService = {
  team: teamService,
  apiKeys: apiKeysService,
  webhooks: webhooksService,
  notifications: notificationsService,
};
