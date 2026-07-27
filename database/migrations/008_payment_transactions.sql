-- 008_payment_transactions.sql
--
-- Records every checkout attempt so a payment can be tied back to the tenant,
-- plan, currency and billing cycle it was for.
--
-- This table is what makes webhook handling safe. Paystack retries webhooks
-- until it gets a 2xx, and also delivers events that may race the browser
-- redirect, so the same reference can arrive several times. `status` plus the
-- UNIQUE reference lets the handler claim a transaction exactly once and make
-- every later delivery a no-op, instead of upgrading a plan or writing an
-- invoice twice.

CREATE TABLE IF NOT EXISTS global.payment_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Our own idempotency key, sent to Paystack as `reference` and echoed back on
  -- both the redirect and the webhook.
  reference      VARCHAR(100) NOT NULL UNIQUE,
  tenant_id      UUID NOT NULL REFERENCES global.tenants(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES global.users(id) ON DELETE SET NULL,
  plan_id        UUID NOT NULL REFERENCES global.subscription_plans(id),
  billing_cycle  VARCHAR(20) NOT NULL,
  currency       CHAR(3) NOT NULL,
  -- Major units (naira, dollars) to match plan_prices. The conversion to
  -- kobo/cents happens only at the Paystack boundary.
  amount         NUMERIC(12, 2) NOT NULL,
  provider       VARCHAR(20) NOT NULL DEFAULT 'paystack',
  -- pending -> success | failed | abandoned
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Set when the subscription was actually activated, so a replayed webhook can
  -- tell "already processed" apart from "paid but not yet applied".
  processed_at   TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  provider_ref   VARCHAR(120),
  failure_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_tx_currency_upper CHECK (currency = UPPER(currency)),
  CONSTRAINT payment_tx_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT payment_tx_cycle CHECK (billing_cycle IN ('monthly', 'yearly')),
  CONSTRAINT payment_tx_status CHECK (status IN ('pending', 'success', 'failed', 'abandoned'))
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_tenant  ON global.payment_transactions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status  ON global.payment_transactions (status) WHERE status = 'pending';
