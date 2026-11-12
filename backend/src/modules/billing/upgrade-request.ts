import type { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../lib/errors';
import { MODULE_LABEL, PLAN_MODULE_KEYS } from '../../lib/plan-modules';
import { notificationService } from '../notifications/notification.service';
import { logger } from '../../lib/logger';

// ─── Request an upgrade (prompt section 5) ──────────────────────────────────
//
// Users without billing authority cannot start a charge; they can ask the
// organisation's owners and administrators instead. Each request becomes an
// in-app notification for them, and is recorded. The same person asking again
// for the same module within a day notifies nobody twice.

export async function initUpgradeRequests(): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS global.upgrade_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES global.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES global.users(id) ON DELETE CASCADE,
    module VARCHAR(40),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_upgrade_requests_tenant ON global.upgrade_requests (tenant_id, created_at DESC)`);
}

export async function requestUpgrade(req: Request, res: Response): Promise<void> {
  // The organisation is always the caller's own (from the sign-in token),
  // never a client-supplied id.
  const tenantId = req.user?.tenantId;
  if (!tenantId) throw new AppError('Choose an organisation first.', 400, 'NO_TENANT');
  const module = req.body?.module == null ? null : String(req.body.module);
  if (module !== null && !PLAN_MODULE_KEYS.includes(module)) throw new AppError('Unknown module', 400, 'VALIDATION_ERROR');
  const note = req.body?.note == null ? null : String(req.body.note).trim().slice(0, 500) || null;

  const recent = await prisma.$queryRawUnsafe<unknown[]>(
    `SELECT 1 FROM global.upgrade_requests
      WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND module IS NOT DISTINCT FROM $3
        AND created_at > NOW() - INTERVAL '1 day' LIMIT 1`,
    tenantId, req.user.id, module);
  if (recent.length) {
    res.json({ success: true, data: { sent: false, message: 'Your administrators were already asked today.' } });
    return;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO global.upgrade_requests (tenant_id, user_id, module, note) VALUES ($1::uuid, $2::uuid, $3, $4)`,
    tenantId, req.user.id, module, note);

  const [tenant] = await prisma.$queryRawUnsafe<Array<{ schema_name: string | null }>>(
    `SELECT schema_name FROM global.tenants WHERE id = $1::uuid AND deleted_at IS NULL`, tenantId);
  const admins = await prisma.$queryRawUnsafe<Array<{ user_id: string }>>(
    `SELECT user_id FROM global.tenant_memberships
      WHERE tenant_id = $1::uuid AND role IN ('owner', 'admin') AND deleted_at IS NULL AND user_id <> $2::uuid`,
    tenantId, req.user.id);
  const what = module ? MODULE_LABEL[module] : 'a higher plan';
  const who = req.user.email;
  let notified = 0;
  if (tenant?.schema_name) {
    for (const a of admins) {
      try {
        await notificationService.createForUser(tenant.schema_name, {
          userId: a.user_id,
          title: `Upgrade requested: ${what}`,
          body: `${who} asked for ${what}.${note ? ` Note: ${note}` : ''} Review plans in Plans and upgrade.`,
          notificationType: 'system',
          priority: 'medium',
          referenceType: 'upgrade_request',
          actionUrl: '/billing/plans',
        });
        notified += 1;
      } catch (err) {
        logger.warn({ err, tenantId }, 'Could not notify an administrator of an upgrade request');
      }
    }
  }
  res.status(201).json({ success: true, data: { sent: true, notified, message: notified ? 'Your administrators have been asked.' : 'Your request was recorded.' } });
}
