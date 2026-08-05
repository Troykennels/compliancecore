import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission, requireRole } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { enforceEntitlement, enforceLimit } from '../../middleware/entitlement.middleware';
import { countUsers } from '../../lib/usage-counts';
import { settingsController } from './settings.controller';
import {
  inviteMemberSchema,
  acceptInvitationSchema,
  updateMemberRoleSchema,
  createApiKeySchema,
  createWebhookSchema,
  updateWebhookSchema,
  updateNotificationSettingsSchema,
} from './settings.schema';

const router = Router();

router.use(authenticate());
// An expired organisation could still invite team members, mint API keys and
// create webhooks, because this router was one of only two that never applied
// the subscription check. Reads stay open, as everywhere else, and accepting an
// invitation is exempt (see ALWAYS_ALLOWED).
router.use(enforceEntitlement());

// ── Team ─────────────────────────────────────────────────────────────────────
router.get('/team/members', settingsController.listMembers);

router.post(
  '/team/members/invite',
  requirePermission('team:write'),
  // Counts existing members, so the limit blocks the invite that would take the
  // organisation over its plan rather than failing later at acceptance.
  enforceLimit('users', countUsers),
  validate(inviteMemberSchema),
  settingsController.inviteMember,
);

// The invited user accepts their own invitation — no tenant permission is
// required (they are not yet a member), only a valid session.
router.post(
  '/team/members/accept-invite',
  validate(acceptInvitationSchema),
  settingsController.acceptInvitation,
);

router.patch(
  '/team/members/:membershipId/role',
  requirePermission('team:write'),
  validate(updateMemberRoleSchema),
  settingsController.updateMemberRole,
);

router.delete(
  '/team/members/:membershipId',
  requirePermission('team:write'),
  settingsController.removeMember,
);

// ── API Keys ──────────────────────────────────────────────────────────────────
router.get('/api-keys', requirePermission('settings:read'), settingsController.listApiKeys);

router.post(
  '/api-keys',
  requirePermission('settings:write'),
  validate(createApiKeySchema),
  settingsController.createApiKey,
);

router.delete(
  '/api-keys/:id',
  requirePermission('settings:write'),
  settingsController.revokeApiKey,
);

// ── Webhooks ──────────────────────────────────────────────────────────────────
router.get('/webhooks', requirePermission('settings:read'), settingsController.listWebhooks);

router.post(
  '/webhooks',
  requirePermission('settings:write'),
  validate(createWebhookSchema),
  settingsController.createWebhook,
);

router.patch(
  '/webhooks/:id',
  requirePermission('settings:write'),
  validate(updateWebhookSchema),
  settingsController.updateWebhook,
);

router.delete(
  '/webhooks/:id',
  requirePermission('settings:write'),
  settingsController.deleteWebhook,
);

router.post(
  '/webhooks/:id/rotate-secret',
  requirePermission('settings:write'),
  settingsController.rotateWebhookSecret,
);

// ── Email diagnostics ─────────────────────────────────────────────────────────
// Every email in the app is fire-and-forget and swallows its own errors, so a
// broken mail setup has no symptom except customers not receiving anything.
// These two make it answerable in seconds instead of requiring log access:
// what transport is configured, and what the provider says when we actually
// try. Owner only — it reveals configuration and can send mail.
router.get('/email/status', requireRole('owner'), settingsController.getEmailStatus);
router.post('/email/test', requireRole('owner'), settingsController.sendTestEmail);

// ── Notifications ─────────────────────────────────────────────────────────────
router.get(
  '/notifications',
  requirePermission('settings:read'),
  settingsController.getNotificationSettings,
);

router.patch(
  '/notifications',
  requirePermission('settings:write'),
  validate(updateNotificationSettingsSchema),
  settingsController.updateNotificationSettings,
);

export default router;
