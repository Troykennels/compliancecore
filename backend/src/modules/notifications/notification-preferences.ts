import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { withTenantSchema } from '../../lib/prisma';

export const notificationTypes = [
  'expiry_warning',
  'calendar_reminder',
  'score_drop',
  'evidence_shared',
  'control_overdue',
  'system',
  'reminder',
  'task_assigned',
  'task_comment',
  'approval_requested',
  'approval_decided',
  'approval_deadline_warning',
  'escalation',
] as const;
export const emailTypes = new Set([
  'expiry_warning',
  'task_assigned',
  'approval_decided',
  'escalation',
]);
export const preferencesSchema = z
  .object({
    preferences: z
      .array(
        z.object({
          notificationType: z.enum(notificationTypes),
          inApp: z.boolean(),
          email: z.boolean(),
        }),
      )
      .max(notificationTypes.length),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.preferences.map((p) => p.notificationType)).size !== value.preferences.length)
      ctx.addIssue({ code: 'custom', message: 'Each notification type must appear once.' });
    if (value.preferences.some((p) => p.email && !emailTypes.has(p.notificationType)))
      ctx.addIssue({
        code: 'custom',
        message: 'Email delivery is not available for this notification type.',
      });
  });

export async function emailAllowedInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  type: string,
) {
  // An enabled organisation transport owns these events. Avoid sending a
  // second copy through the platform transport; the connector worker applies
  // the same recipient preference before delivery.
  const own = await tx.$queryRawUnsafe<Array<{ enabled: boolean }>>(
    `SELECT i.enabled FROM global.notification_integrations i
     JOIN global.tenants t ON t.id=i.tenant_id
     WHERE t.schema_name=current_schema() AND i.provider='email' AND i.enabled
       AND i.verified_at IS NOT NULL AND i.config->'events' ? $1`, type,
  );
  if(own.length)return false;
  const rows = await tx.$queryRawUnsafe<Array<{ email: boolean }>>(
    'SELECT email FROM notification_preferences WHERE user_id=$1::uuid AND notification_type=$2',
    userId,
    type,
  );
  return rows[0]?.email !== false;
}
export function emailAllowed(schema: string, userId: string, type: string) {
  return withTenantSchema(schema, (tx) => emailAllowedInTransaction(tx, userId, type));
}
export const notificationPreferences = {
  async get(schema: string, userId: string) {
    return withTenantSchema(schema, async (tx) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{ notification_type: string; in_app: boolean; email: boolean }>
      >(
        'SELECT notification_type,in_app,email FROM notification_preferences WHERE user_id=$1::uuid',
        userId,
      );
      return notificationTypes.map((type) => {
        const p = rows.find((row) => row.notification_type === type);
        return {
          notificationType: type,
          inApp: p?.in_app !== false,
          email: emailTypes.has(type) && p?.email !== false,
          emailAvailable: emailTypes.has(type),
        };
      });
    });
  },
  async save(schema: string, userId: string, input: z.infer<typeof preferencesSchema>) {
    return withTenantSchema(schema, async (tx) => {
      for (const p of input.preferences)
        await tx.$executeRawUnsafe(
          `INSERT INTO notification_preferences(user_id,notification_type,in_app,email)
        VALUES($1::uuid,$2,$3,$4) ON CONFLICT(user_id,notification_type) DO UPDATE SET in_app=EXCLUDED.in_app,email=EXCLUDED.email,updated_at=NOW()`,
          userId,
          p.notificationType,
          p.inApp,
          p.email,
        );
    });
  },
};
