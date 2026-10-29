import { auditCurrentActor } from '../../lib/audit-context';
import { prisma } from '../../config/database';

export const COMMERCIAL_PRICES = [
  { slug: 'starter', monthly: 40000, onboarding: 1500000 },
  { slug: 'professional', monthly: 85000, onboarding: 2000000 },
  { slug: 'business', monthly: 180000, onboarding: 3500000 },
  { slug: 'enterprise', monthly: 480000, onboarding: 5000000 },
  { slug: 'msp', monthly: 800000, onboarding: 8000000 },
] as const;

export async function initCommercialPricing() {
  await prisma.$executeRawUnsafe(`ALTER TABLE global.subscription_plans ADD COLUMN IF NOT EXISTS onboarding_fee numeric(12,2) NOT NULL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE global.plan_prices ADD COLUMN IF NOT EXISTS onboarding_fee numeric(12,2) NOT NULL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE global.payment_transactions
    ADD COLUMN IF NOT EXISTS onboarding_fee numeric(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subscription_amount numeric(12,2),
    ADD COLUMN IF NOT EXISTS authorization_url text`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS global.tenant_onboarding (
    tenant_id uuid PRIMARY KEY REFERENCES global.tenants(id) ON DELETE CASCADE,
    status text NOT NULL CHECK(status IN ('paid','grandfathered','demo')),
    amount numeric(12,2) NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'NGN',
    payment_reference text UNIQUE, settled_at timestamptz NOT NULL DEFAULT now())`);
  await prisma.$transaction(async tx => {
        await auditCurrentActor(tx);
    const claimed = await tx.$executeRawUnsafe(`INSERT INTO global.schema_migrations(version,description)
      VALUES('014_commercial_pricing_20261023','Commercial onboarding fees and annual ten-month subscription pricing') ON CONFLICT DO NOTHING`);
    if (!claimed) return;
    // Existing paid agreements retain their next_invoice_amount. No old invoice,
    // provider consent, customer card or paid-through date is repriced here.
    await tx.$executeRawUnsafe(`INSERT INTO global.tenant_onboarding(tenant_id,status)
      SELECT DISTINCT s.tenant_id,'grandfathered' FROM global.subscriptions s
      WHERE s.status IN ('active','past_due','paused','cancelled')
        AND (s.next_invoice_amount>0 OR EXISTS(SELECT 1 FROM global.invoices i WHERE i.tenant_id=s.tenant_id AND i.status='paid' AND i.amount_paid>0))
      ON CONFLICT DO NOTHING`);
    for (const p of COMMERCIAL_PRICES) {
      await tx.$executeRawUnsafe(`UPDATE global.subscription_plans SET price_monthly=$2,price_yearly=$3,onboarding_fee=$4,currency='NGN',updated_at=now() WHERE slug=$1`, p.slug,p.monthly,p.monthly*10,p.onboarding);
      await tx.$executeRawUnsafe(`INSERT INTO global.plan_prices(plan_id,currency,price_monthly,price_yearly,onboarding_fee)
        SELECT id,'NGN',$2,$3,$4 FROM global.subscription_plans WHERE slug=$1
        ON CONFLICT(plan_id,currency) DO UPDATE SET price_monthly=EXCLUDED.price_monthly,price_yearly=EXCLUDED.price_yearly,onboarding_fee=EXCLUDED.onboarding_fee,updated_at=now()`,p.slug,p.monthly,p.monthly*10,p.onboarding);
    }
    await tx.$executeRawUnsafe(`UPDATE global.subscription_plans SET features=$1::jsonb WHERE slug='enterprise'`,JSON.stringify(['Unlimited team members','Unlimited compliance frameworks','Everything in Business','Executive assurance reporting','Organisation and workflow setup','Scoped data migration','Dedicated rollout planning','Integration requirements assessed by quotation']));
    await tx.$executeRawUnsafe(`UPDATE global.subscription_plans SET features=$1::jsonb WHERE slug='business'`,JSON.stringify(['100 team members','Unlimited compliance frameworks','250 GB evidence storage','Everything in Professional','Branches and departments','Multiple locations','Analytics and executive reporting','API keys and webhooks','Vendor assessments','Workflow automation','Implementation support by agreed scope']));
    await tx.$executeRawUnsafe(`UPDATE global.subscription_plans SET features=$1::jsonb WHERE slug='msp'`,JSON.stringify(['Multiple client organisations','Portfolio reporting','Organisation switching','Client-scoped access','Client onboarding workflows','Everything in Enterprise','Partner implementation planning','Commercial scope confirmed by quotation']));
  });
}
