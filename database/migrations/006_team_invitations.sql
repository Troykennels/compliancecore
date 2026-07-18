-- =============================================================================
-- Migration 006 — Team Invitations
-- Creates global.team_invitations so team invites are persisted (with a hashed
-- one-time token) and can be accepted, rather than only firing an email.
-- =============================================================================

CREATE TABLE IF NOT EXISTS global.team_invitations (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID          NOT NULL REFERENCES global.tenants(id) ON DELETE CASCADE,
  email        VARCHAR(255)  NOT NULL,
  role         VARCHAR(50)   NOT NULL,
  token_hash   VARCHAR(64)   NOT NULL UNIQUE,
  invited_by   UUID          REFERENCES global.users(id) ON DELETE SET NULL,
  status       VARCHAR(20)   NOT NULL DEFAULT 'pending',  -- pending | accepted | revoked
  expires_at   TIMESTAMPTZ   NOT NULL,
  accepted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_tenant ON global.team_invitations(tenant_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_invitations_hash   ON global.team_invitations(token_hash);

INSERT INTO global.schema_migrations (version, description)
VALUES ('006', 'Add team_invitations table')
ON CONFLICT (version) DO NOTHING;
