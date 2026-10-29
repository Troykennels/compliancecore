-- A control nobody has assessed yet is "not assessed", not "not operating".
-- Tenant templates re-run on every start, so the one-off conversion is guarded by the column default:
-- it runs once, before the default changes, and never again. Any control a person has worked on keeps its status.
DO $$
BEGIN
  IF COALESCE((SELECT column_default FROM information_schema.columns
               WHERE table_schema = '{{SCHEMA}}' AND table_name = 'controls' AND column_name = 'implementation_status'), '') NOT LIKE '%not_assessed%' THEN
    UPDATE {{SCHEMA}}.controls c SET implementation_status = 'not_assessed'
    WHERE c.implementation_status = 'not_implemented'
      AND c.owner_id IS NULL
      AND c.last_reviewed_at IS NULL
      AND NULLIF(TRIM(COALESCE(c.implementation_notes, '')), '') IS NULL
      AND NULLIF(TRIM(COALESCE(c.testing_notes, '')), '') IS NULL
      AND c.updated_at <= c.created_at + INTERVAL '1 minute'
      AND NOT EXISTS (SELECT 1 FROM {{SCHEMA}}.evidence_links l WHERE l.linked_type = 'control' AND l.linked_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM {{SCHEMA}}.control_tests t WHERE t.control_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM {{SCHEMA}}.risk_control_links r WHERE r.control_id = c.id);
    ALTER TABLE {{SCHEMA}}.controls ALTER COLUMN implementation_status SET DEFAULT 'not_assessed';
  END IF;
END $$;
