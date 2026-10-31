-- Encrypted organisation-owned notification connectors. No provider calls in migrations.
CREATE TABLE IF NOT EXISTS global.notification_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES global.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK(provider IN ('slack','teams','email')),
  config jsonb NOT NULL DEFAULT '{}',
  encrypted_secrets text NOT NULL,
  revision uuid NOT NULL DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz,
  verified_at timestamptz,
  updated_by uuid REFERENCES global.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
  UNIQUE(tenant_id,provider),
  CHECK(NOT enabled OR (verified_at IS NOT NULL AND enabled_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS global.integration_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES global.notification_integrations(id) ON DELETE CASCADE,
  notification_id uuid,
  is_test boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK(status IN ('sending','delivered','failed','unknown')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(integration_id,notification_id)
);
CREATE INDEX IF NOT EXISTS integration_deliveries_recent ON global.integration_deliveries(integration_id,created_at DESC);
