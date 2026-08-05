-- =============================================================================
-- Migration 012 — Tenant erasure window
-- ComplianceCore | ORION SOFT LIMITED
--
-- There was no way to delete an organisation at all. Nothing ever set
-- tenants.deleted_at, and the foreign keys pointing at tenants are ON DELETE
-- RESTRICT, so a manual DELETE fails outright. A customer who churned — or who
-- exercised their right to erasure under GDPR Art.17 or the NDPA — left their
-- schema and every piece of personal data in it in place, permanently, with no
-- mechanism to comply.
--
-- Erasure is deliberately two-step rather than immediate:
--
--   1. The owner requests deletion. Access stops at once (resolveTenant already
--      excludes a tenant with deleted_at set), and purge_after is stamped.
--   2. A daily job drops the schema and removes the global rows once that date
--      passes.
--
-- The gap is the 30 days the DPA already promises customers to export their
-- data, and it is the difference between a mis-click and an unrecoverable
-- mistake. Anything that destroys a compliance archive should not be a single
-- button with no way back.
--
-- Only a column is added here. The purge itself is code, where it can be
-- ordered, logged and tested.
-- =============================================================================

ALTER TABLE global.tenants
    ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ;

COMMENT ON COLUMN global.tenants.purge_after IS
    'When a soft-deleted tenant becomes eligible for permanent erasure. NULL means never queued for purge.';

-- The purge job scans for due tenants daily; without this it is a full scan of
-- every tenant on the platform.
CREATE INDEX IF NOT EXISTS idx_tenants_purge_due
    ON global.tenants (purge_after)
    WHERE deleted_at IS NOT NULL;
