-- 007_plan_prices_multicurrency.sql
--
-- Multi-currency plan pricing.
--
-- global.subscription_plans carries a single (currency, price_monthly,
-- price_yearly) triple, so a plan can only ever be sold in one currency. Selling
-- the same plan in NGN via Paystack and USD internationally needs one row per
-- (plan, currency), which is what global.plan_prices provides.
--
-- The legacy columns on subscription_plans are deliberately NOT dropped. They
-- are still read by billing.service (calcBasePrice, renewal invoicing) and by
-- the admin UI, so removing them here would break live billing in the same
-- change that adds the table. They now act as the plan's default/base price;
-- plan_prices is the source of truth for any currency the customer actually
-- checks out in, and a follow-up change moves the readers over.

CREATE TABLE IF NOT EXISTS global.plan_prices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES global.subscription_plans(id) ON DELETE CASCADE,
  -- ISO 4217, uppercase. CHAR(3) rather than free text so 'ngn' and 'NGN'
  -- cannot both exist and silently split a plan's pricing in two.
  currency      CHAR(3) NOT NULL,
  price_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0,
  price_yearly  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  -- Lets a currency be retired without deleting historical rows that invoices
  -- may reference.
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plan_prices_currency_upper CHECK (currency = UPPER(currency)),
  CONSTRAINT plan_prices_non_negative   CHECK (price_monthly >= 0 AND price_yearly >= 0),
  CONSTRAINT plan_prices_plan_currency  UNIQUE (plan_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_plan_prices_plan     ON global.plan_prices (plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_prices_currency ON global.plan_prices (currency) WHERE is_active;

-- Backfill: every existing plan keeps its current price under its current
-- currency, so nothing changes for anyone already on a plan.
INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly)
SELECT id, UPPER(COALESCE(currency, 'USD')), COALESCE(price_monthly, 0), COALESCE(price_yearly, 0)
FROM global.subscription_plans
ON CONFLICT (plan_id, currency) DO NOTHING;

-- Seed NGN so Paystack checkout has prices to charge against.
--
-- PLACEHOLDER RATE: 1 USD = 1600 NGN, rounded to the nearest ₦100. These are a
-- starting point so the payment flow is exercisable end to end — they are NOT a
-- pricing decision. Set real NGN prices in the owner console (Billing Admin →
-- Plans) before going live; they are ordinary rows and safe to edit.
INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly)
SELECT
  id,
  'NGN',
  ROUND(COALESCE(price_monthly, 0) * 1600 / 100) * 100,
  ROUND(COALESCE(price_yearly,  0) * 1600 / 100) * 100
FROM global.subscription_plans
WHERE UPPER(COALESCE(currency, 'USD')) <> 'NGN'
ON CONFLICT (plan_id, currency) DO NOTHING;
