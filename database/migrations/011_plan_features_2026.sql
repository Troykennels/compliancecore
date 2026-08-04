-- 011_plan_features_2026.sql
--
-- INTENTIONALLY A NO-OP, for the same reason as 010 and 007: it wrote to
-- global.subscription_plans, which the migration runner does not create.
--
-- The plan allowances and advertised feature lists now live in
-- initBillingTables() in src/modules/billing/billing.repository.ts — in the
-- seed for a fresh database, and in the one-time correction block for a
-- database that predates them.

SELECT 1;
