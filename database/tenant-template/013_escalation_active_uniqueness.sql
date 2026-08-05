-- =============================================================================
-- Tenant template 013 — Fix escalation uniqueness
-- ComplianceCore | ORION SOFT LIMITED
--
-- 008 declared UNIQUE(rule_id, entity_type, entity_id, status) on
-- escalation_events, which puts a MUTABLE column in the uniqueness key. The
-- intent was "only one ACTIVE escalation per rule per entity", but what it
-- actually enforces is "only one escalation per rule per entity per status" —
-- and that wedges on the second occurrence:
--
--   1. rule fires on a control   -> row A (status 'active')
--   2. it is dealt with          -> row A becomes 'completed'
--   3. the same rule fires again -> row B (status 'active') — fine so far
--   4. row B is dealt with       -> UPDATE to 'completed' collides with row A
--
-- Step 4 raises 23505, the escalation worker throws, and row B is left 'active'
-- forever. From then on that entity has a permanently open escalation that can
-- never be closed, and step 3 can never happen again either.
--
-- A partial unique index says what was meant: at most one row in the 'active'
-- state, with no constraint at all on the terminal states, which are exactly
-- the ones you expect to accumulate.
-- =============================================================================

-- Postgres names the inline table constraint from its columns. Dropped by that
-- generated name, guarded so a tenant provisioned after this file exists — and
-- therefore never had the constraint — is unaffected.
ALTER TABLE {{SCHEMA}}.escalation_events
    DROP CONSTRAINT IF EXISTS escalation_events_rule_id_entity_type_entity_id_status_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_escalation_events_active
    ON {{SCHEMA}}.escalation_events (rule_id, entity_type, entity_id)
    WHERE status = 'active';
