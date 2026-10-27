-- 015_invoice_part_payments.sql
--
-- Links a checkout to the open invoice it pays towards, so full or part
-- payments settle on that same invoice (payments/invoice-checkout.ts).
--
-- Applied by the provisioning identity: in production the API role cannot run
-- DDL and initBillingTables() is skipped. On a fresh database the billing
-- tables don't exist yet when migrations run; initBillingTables() then adds
-- the same column through initInvoicePayments().
DO $$
BEGIN
  IF to_regclass('global.payment_transactions') IS NOT NULL AND to_regclass('global.invoices') IS NOT NULL THEN
    ALTER TABLE global.payment_transactions
      ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES global.invoices(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_payment_tx_invoice ON global.payment_transactions (invoice_id) WHERE invoice_id IS NOT NULL;
  END IF;
END $$;
