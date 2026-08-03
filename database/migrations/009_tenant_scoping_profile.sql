-- =============================================================================
-- Migration 009 — Tenant compliance scoping profile
-- ComplianceCore | ORION SOFT LIMITED
--
-- Captures how an organisation actually operates (where it trades, whose data it
-- holds, whether it takes card payments, how it hosts, whether it builds
-- software) so the platform can recommend the frameworks that genuinely apply
-- instead of showing every customer the same undifferentiated catalogue.
--
-- Stored as JSONB rather than 20 columns: the question set will change as new
-- regulations are added, and a schema migration per question would be a poor
-- trade. Answers are read by the framework recommendation engine only.
-- Idempotent.
-- =============================================================================

ALTER TABLE global.tenants
  ADD COLUMN IF NOT EXISTS scoping_profile      JSONB,
  ADD COLUMN IF NOT EXISTS scoping_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN global.tenants.scoping_profile IS
  'Answers to the onboarding compliance-scoping questionnaire. Drives framework recommendations.';
