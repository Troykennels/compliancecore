import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission, requireRole } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { settingsController } from './settings.controller';
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  createApiKeySchema,
  createWebhookSchema,
  updateWebhookSchema,
  updateNotificationSettingsSchema,
} from './settings.schema';

const router = Router();

router.use(authenticate());

// ── Team ─────────────────────────────────────────────────────────────────────
router.get('/team/members', settingsController.listMembers);

router.post(
  '/team/members/invite',
  requirePermission('team:write'),
  validate(inviteMemberSchema),
  settingsController.inviteMember,
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

// ── Notifications ─────────────────────────────────────────────────────────────
router.get('/notifications', settingsController.getNotificationSettings);

router.patch(
  '/notifications',
  validate(updateNotificationSettingsSchema),
  settingsController.updateNotificationSettings,
);

export default router;
