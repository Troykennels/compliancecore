-- 008_payment_transactions.sql
--
-- INTENTIONALLY A NO-OP. Kept so the migration version stays recorded on
-- databases where an earlier version of this file already ran.
--
-- global.payment_transactions has foreign keys to global.subscription_plans and
-- global.tenants. subscription_plans is created by initBillingTables() at app
-- boot rather than by the migration runner, and migrations run before the app
-- starts — so defining this table here failed on any fresh database.
--
-- The table now lives in initBillingTables() in
-- src/modules/billing/billing.repository.ts. See 007 for the full explanation.

SELECT 1;
