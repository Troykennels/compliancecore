-- =============================================================================
-- Migration 010 — Naira pricing and the Business tier
-- ComplianceCore | ORION SOFT LIMITED
--
-- DATA ONLY. No table, column, constraint or index is created, altered or
-- dropped here. This sets commercial prices and adds one plan row; subscription
-- logic, entitlements, multi-tenancy and payment integrations are untouched.
--
-- Why a migration rather than the boot-time seed: the seed uses
-- ON CONFLICT DO NOTHING so it never overwrites an existing row, which is
-- correct — it must not stamp on prices an owner has since edited in the
-- console. But that also means it can never correct the placeholder NGN figures
-- (USD x 1600) already sitting in plan_prices. A tracked migration applies the
-- real prices exactly once and is then never repeated.
--
-- Annual is 10x monthly throughout, i.e. two months free.
-- =============================================================================

-- ── Business tier ────────────────────────────────────────────────────────────
-- Sits between Professional and Enterprise. Inserted only if absent, so
-- re-running against a database that already has it is harmless.
INSERT INTO global.subscription_plans
    (name, slug, description, price_monthly, price_yearly, currency,
     max_users, max_frameworks, max_evidence_gb, max_branches, max_departments,
     features, sort_order, is_active, is_public)
SELECT
    'Business', 'business',
    'For established organisations running several frameworks at once',
    180000, 1800000, 'NGN',
    50, NULL, 50, 15, 50,
    '["Unlimited compliance frameworks","50 team members","50 GB evidence storage","Priority email support","Full audit trail","Custom controls","Scheduled reports","AI tools","Approval workflows","Digital signatures"]'::jsonb,
    3, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM global.subscription_plans WHERE slug = 'business');

-- ── Naira prices for the self-service tiers ─────────────────────────────────
-- Starter was seeded at 0/0 as a free tier. It is now a paid entry plan. The
-- free trial is unaffected: it is anchored on 'professional'
-- (see backend/src/lib/entitlements.ts TRIAL_PLAN_SLUG), not on Starter.
UPDATE global.subscription_plans
   SET price_monthly = v.monthly,
       price_yearly  = v.yearly,
       currency      = 'NGN',
       sort_order    = v.sort_order,
       updated_at    = NOW()
  FROM (VALUES
        ('starter',       25000::numeric,   250000::numeric, 1),
        ('professional',  85000::numeric,   850000::numeric, 2),
        ('business',     180000::numeric,  1800000::numeric, 3)
       ) AS v(slug, monthly, yearly, sort_order)
 WHERE global.subscription_plans.slug = v.slug;

-- Enterprise and MSP: presented as "Contact Sales", but still priced.
--
-- Two rules matter here and both are about safety rather than commerce:
--
--  1. The price must stay ABOVE ZERO. createSubscription/updateSubscription
--     treat a zero-priced plan as free, so zeroing these would let anyone
--     assign themselves Enterprise without paying.
--
--  2. The currency must match the other plans. The upgrade guard compares
--     target price against current price numerically; leaving these in USD
--     while the self-service tiers moved to naira made "299" look cheaper than
--     "85,000", so Enterprise read as a downgrade and was granted for free.
--     billing.service.ts now also refuses to compare across currencies, but the
--     data should not set that trap in the first place.
--
-- Values carry over the naira figures already in plan_prices, which keep both
-- comfortably above the Business tier.
UPDATE global.subscription_plans p
   SET currency      = 'NGN',
       price_monthly = COALESCE(pp.price_monthly, p.price_monthly * 1600),
       price_yearly  = COALESCE(pp.price_yearly,  p.price_yearly  * 1600),
       sort_order    = CASE p.slug WHEN 'enterprise' THEN 4 WHEN 'msp' THEN 5 END,
       updated_at    = NOW()
  FROM (SELECT plan_id, price_monthly, price_yearly
          FROM global.plan_prices WHERE currency = 'NGN') pp
 WHERE p.slug IN ('enterprise', 'msp')
   AND pp.plan_id = p.id;

-- ── plan_prices (what checkout actually charges) ────────────────────────────
-- Checkout reads this table, not the columns above, so the two must agree or a
-- customer is charged something different from the price they were shown.
INSERT INTO global.plan_prices (plan_id, currency, price_monthly, price_yearly)
SELECT p.id, 'NGN', v.monthly, v.yearly
  FROM global.subscription_plans p
  JOIN (VALUES
        ('starter',       25000::numeric,   250000::numeric),
        ('professional',  85000::numeric,   850000::numeric),
        ('business',     180000::numeric,  1800000::numeric)
       ) AS v(slug, monthly, yearly) ON v.slug = p.slug
ON CONFLICT (plan_id, currency) DO UPDATE
   SET price_monthly = EXCLUDED.price_monthly,
       price_yearly  = EXCLUDED.price_yearly,
       is_active     = TRUE,
       updated_at    = NOW();

-- Retire the placeholder USD rows for the self-service tiers. Selling in USD
-- requires Paystack to enable it per merchant; until then an active USD price
-- only offers a customer a checkout that fails at the provider. Deactivated
-- rather than deleted so the figures are recoverable when USD is switched on.
UPDATE global.plan_prices
   SET is_active  = FALSE,
       updated_at = NOW()
 WHERE currency = 'USD'
   AND plan_id IN (SELECT id FROM global.subscription_plans
                    WHERE slug IN ('starter', 'professional', 'business'));
