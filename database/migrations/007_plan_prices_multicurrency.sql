-- 007_plan_prices_multicurrency.sql
--
-- INTENTIONALLY A NO-OP. Kept so the migration version stays recorded on
-- databases where an earlier version of this file already ran.
--
-- global.plan_prices has a foreign key to global.subscription_plans, and that
-- table is NOT created by the migration runner — it is created lazily by
-- initBillingTables() in src/modules/billing/billing.repository.ts when the app
-- boots. Migrations all run before the app starts (see railway.json's
-- `migrate.mjs && server.js`), so on a fresh database this file failed with:
--
--   relation "global.subscription_plans" does not exist
--
-- which broke CI on every clean database while passing against an existing one.
-- The table definition, the backfill, and the placeholder NGN seed now live in
-- initBillingTables() alongside the rest of the billing schema, where their
-- dependencies are guaranteed to exist and everything is idempotent.

SELECT 1;
