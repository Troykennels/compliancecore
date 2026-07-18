import { z } from 'zod';

const MEMBER_ROLES = [
  'admin',
  'compliance_manager',
  'control_owner',
  'auditor',
  'viewer',
] as const;

const API_PERMISSIONS = [
  'controls:read',
  'controls:write',
  'evidence:read',
  'evidence:write',
  'frameworks:read',
  'policies:read',
  'policies:write',
  'risks:read',
  'risks:write',
  'audits:read',
  'reports:read',
] as const;

const WEBHOOK_EVENTS = [
  'control.created',
  'control.updated',
  'control.completed',
  'control.overdue',
  'evidence.uploaded',
  'evidence.requested',
  'framework.assigned',
  'risk.created',
  'risk.updated',
  'audit.started',
  'audit.completed',
  'incident.created',
  'incident.resolved',
  'user.invited',
  'user.removed',
] as const;

// Roles that can be assigned when changing an existing member's role. Unlike
// invitations, this includes 'owner' so ownership can be transferred — the
// service still guards it (only an owner may assign 'owner', last-owner check).
const ASSIGNABLE_ROLES = ['owner', ...MEMBER_ROLES] as const;

export const inviteMemberSchema = z.object({
  email: z.string().email('Must be a valid email address').max(255),
  role: z.enum(MEMBER_ROLES, { errorMap: () => ({ message: 'Invalid role' }) }),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES, { errorMap: () => ({ message: 'Invalid role' }) }),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});

export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  permissions: z
    .array(z.enum(API_PERMISSIONS))
    .min(1, 'At least one permission is required')
    .max(API_PERMISSIONS.length),
  expiresAt: z.coerce.date().min(new Date(), 'Expiry must be in the future').optional().nullable(),
});

export const createWebhookSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  url: z.string().url('Must be a valid URL').max(2048),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, 'Select at least one event')
    .max(WEBHOOK_EVENTS.length),
});

export const updateWebhookSchema = createWebhookSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const updateNotificationSettingsSchema = z.object({
  emailAlerts: z
    .object({
      controlDue: z.boolean(),
      controlOverdue: z.boolean(),
      evidenceRequested: z.boolean(),
      auditStarted: z.boolean(),
      riskCreated: z.boolean(),
      incidentCreated: z.boolean(),
      frameworkAssigned: z.boolean(),
    })
    .optional(),
  digestFrequency: z.enum(['realtime', 'daily', 'weekly', 'never']).optional(),
  slackWebhookUrl: z.string().url('Must be a valid URL').max(2048).optional().nullable(),
  teamsWebhookUrl: z.string().url('Must be a valid URL').max(2048).optional().nullable(),
});

export type InviteMemberInput       = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput   = z.infer<typeof updateMemberRoleSchema>;
export type AcceptInvitationInput   = z.infer<typeof acceptInvitationSchema>;
export type CreateApiKeyInput       = z.infer<typeof createApiKeySchema>;
export type CreateWebhookInput      = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput      = z.infer<typeof updateWebhookSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationSettingsSchema>;

export { WEBHOOK_EVENTS, API_PERMISSIONS };
