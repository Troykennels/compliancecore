import { prisma } from '../config/database';
import { logger } from './logger';
import { dropTenantSchema } from './provisioning';

/**
 * Erasing an organisation.
 *
 * Two steps on purpose. `requestErasure` stops access immediately and starts a
 * clock; `purgeDueTenants` does the irreversible part once that clock runs out.
 * The gap is the 30 days the DPA already promises customers to export their
 * data, and it is what stands between a mis-click and the permanent loss of a
 * compliance archive.
 *
 * The order of the purge matters. Every table pointing at global.tenants is
 * ON DELETE RESTRICT, so the tenant row cannot go until its children have —
 * and the billing tables carry tenant_id with no foreign key at all, so nothing
 * would have complained if they were simply left behind as orphans.
 */

/** Days between an erasure request and the data actually going. */
export const ERASURE_GRACE_DAYS = 30;

export async function requestErasure(tenantId: string): Promise<{ purgeAfter: Date }> {
  const purgeAfter = new Date(Date.now() + ERASURE_GRACE_DAYS * 86_400_000);

  await prisma.$executeRawUnsafe(
    `UPDATE global.tenants
        SET deleted_at = NOW(), is_active = false, purge_after = $2::timestamptz, updated_at = NOW()
      WHERE id = $1::uuid AND deleted_at IS NULL`,
    tenantId, purgeAfter,
  );

  // Stop billing straight away. Leaving the subscription live would keep the
  // renewal job charging a card for an organisation nobody can log into.
  await prisma.$executeRawUnsafe(
    `UPDATE global.subscriptions
        SET status = 'cancelled', cancelled_at = NOW(), cancel_at_period_end = true, updated_at = NOW()
      WHERE tenant_id = $1::uuid AND status <> 'cancelled'`,
    tenantId,
  );

  logger.warn({ tenantId, purgeAfter }, 'Tenant erasure requested — access revoked, purge scheduled');
  return { purgeAfter };
}

/** Undoes a request, provided the purge has not run. */
export async function cancelErasure(tenantId: string): Promise<boolean> {
  const affected = await prisma.$executeRawUnsafe(
    `UPDATE global.tenants
        SET deleted_at = NULL, is_active = true, purge_after = NULL, updated_at = NOW()
      WHERE id = $1::uuid AND deleted_at IS NOT NULL AND purge_after > NOW()`,
    tenantId,
  );
  if (affected > 0) logger.warn({ tenantId }, 'Tenant erasure cancelled — organisation restored');
  return affected > 0;
}

/**
 * Permanently removes every tenant whose grace period has expired.
 *
 * Each tenant is handled independently: one failure must not stop the rest, and
 * a partial purge is safe to retry because every step is idempotent.
 */
export async function purgeDueTenants(): Promise<{ purged: number; failed: number }> {
  const due = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; schema_name: string }>>(
    `SELECT id, name, schema_name
       FROM global.tenants
      WHERE deleted_at IS NOT NULL
        AND purge_after IS NOT NULL
        AND purge_after <= NOW()`,
  );

  let purged = 0;
  let failed = 0;

  for (const tenant of due) {
    try {
      // The schema first: it holds the overwhelming majority of the personal
      // data, so if anything fails afterwards the important part is already
      // gone rather than still sitting there.
      await dropTenantSchema(tenant.schema_name);

      // Billing rows carry tenant_id with NO foreign key, so nothing would ever
      // have flagged these as orphans. Named explicitly rather than relying on
      // cascade, precisely because there is no cascade to rely on.
      for (const table of [
        'global.subscription_reminders',
        'global.coupon_redemptions',
        'global.usage_records',
        'global.invoices',
        'global.payment_transactions',
        'global.payment_methods',
        'global.subscriptions',
      ]) {
        // subscription_reminders keys on subscription, not tenant.
        const sql = table === 'global.subscription_reminders'
          ? `DELETE FROM global.subscription_reminders
              WHERE subscription_id IN (SELECT id FROM global.subscriptions WHERE tenant_id = $1::uuid)`
          : `DELETE FROM ${table} WHERE tenant_id = $1::uuid`;
        await prisma.$executeRawUnsafe(sql, tenant.id);
      }

      // These DO have restricting foreign keys, so they must go before the
      // tenant row or the final delete fails.
      await prisma.$executeRawUnsafe(`DELETE FROM global.api_keys WHERE tenant_id = $1::uuid`, tenant.id);
      await prisma.$executeRawUnsafe(`DELETE FROM global.webhooks WHERE tenant_id = $1::uuid`, tenant.id);
      await prisma.$executeRawUnsafe(`DELETE FROM global.tenant_memberships WHERE tenant_id = $1::uuid`, tenant.id);
      await prisma.$executeRawUnsafe(`DELETE FROM global.tenant_invitations WHERE tenant_id = $1::uuid`, tenant.id)
        .catch(() => { /* table is optional across versions */ });

      await prisma.$executeRawUnsafe(`DELETE FROM global.tenants WHERE id = $1::uuid`, tenant.id);

      purged++;
      logger.warn({ tenantId: tenant.id, tenant: tenant.name }, 'Tenant permanently erased');
    } catch (err) {
      failed++;
      logger.error({ err, tenantId: tenant.id }, 'Tenant purge failed — will retry on the next run');
    }
  }

  if (due.length) logger.info({ purged, failed }, 'Tenant purge complete');
  return { purged, failed };
}
