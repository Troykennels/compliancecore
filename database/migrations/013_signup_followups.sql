-- Owner-only signup follow-up metadata. No existing user or trial is changed.
CREATE TABLE IF NOT EXISTS global.signup_followups (
  user_id UUID PRIMARY KEY REFERENCES global.users(id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','interested','converted','not_interested','test')),
  notes TEXT NOT NULL DEFAULT '',
  follow_up_on DATE NULL,
  updated_by UUID NOT NULL REFERENCES global.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS signup_followups_due_idx
  ON global.signup_followups(follow_up_on) WHERE follow_up_on IS NOT NULL;
INSERT INTO global.schema_migrations(version,description)
VALUES ('013','Owner signup and trial follow-ups') ON CONFLICT(version) DO NOTHING;
