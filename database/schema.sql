-- =============================================================================
-- ComplianceCore — Enterprise PostgreSQL Schema
-- ORION SOFT LIMITED | Version 1.0 | June 2026
-- =============================================================================
-- Execution order:
--   1. Extensions
--   2. Enum types
--   3. Global schema
--   4. Framework data schema
--   5. Tenant template schema (applied per-tenant at provisioning)
--   6. Indexes
--   7. Functions
--   8. Triggers
-- =============================================================================

-- =============================================================================
-- SECTION 1: EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- uuid_generate_v4() fallback
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector for AI embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- trigram indexes for ILIKE search
CREATE EXTENSION IF NOT EXISTS "btree_gin";     -- GIN indexes on scalar types
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- query performance monitoring


-- =============================================================================
-- SECTION 2: ENUM TYPES (defined in global schema, used everywhere)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS global;
SET search_path = global, public;

-- ── Tenant & Subscription ────────────────────────────────────────────────────

CREATE TYPE global.tenant_tier AS ENUM (
    'starter',
    'professional',
    'enterprise',
    'msp'
);

CREATE TYPE global.tenant_status AS ENUM (
    'trial',
    'active',
    'suspended',
    'cancelled'
);

-- ── Users & Access ───────────────────────────────────────────────────────────

CREATE TYPE global.user_role AS ENUM (
    'super_admin',         -- ORION SOFT platform admin
    'tenant_admin',        -- full control within tenant
    'compliance_manager',  -- manages compliance program
    'control_owner',       -- manages assigned controls
    'auditor_internal',    -- read-only — all data
    'auditor_external',    -- read-only — scoped to audit engagement
    'vendor_external',     -- vendor portal access only
    'employee',            -- policy ack + training only
    'executive'            -- dashboard + reports read-only
);

-- ── Controls ─────────────────────────────────────────────────────────────────

CREATE TYPE global.control_status AS ENUM (
    'not_started',
    'in_progress',
    'implemented',
    'not_applicable',
    'failing'
);

CREATE TYPE global.control_test_result AS ENUM (
    'pass',
    'fail',
    'partial',
    'not_tested'
);

CREATE TYPE global.control_ownership_type AS ENUM (
    'primary',
    'secondary',
    'reviewer'
);

CREATE TYPE global.mapping_type AS ENUM (
    'equivalent',     -- controls are fully equivalent
    'partial',        -- one control partially satisfies the other
    'supporting'      -- one control provides supporting evidence for the other
);

CREATE TYPE global.mapping_confidence AS ENUM (
    'high',
    'medium',
    'low'
);

-- ── Evidence ─────────────────────────────────────────────────────────────────

CREATE TYPE global.evidence_source AS ENUM (
    'manual_upload',
    'integration_automated',
    'api_push'
);

CREATE TYPE global.evidence_review_verdict AS ENUM (
    'approved',
    'rejected',
    'needs_update'
);

-- ── Policies ─────────────────────────────────────────────────────────────────

CREATE TYPE global.policy_status AS ENUM (
    'draft',
    'in_review',
    'approved',
    'published',
    'archived',
    'expired'
);

CREATE TYPE global.policy_type AS ENUM (
    'policy',
    'procedure',
    'standard',
    'guideline',
    'charter'
);

CREATE TYPE global.approval_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'delegated'
);

-- ── Risks ────────────────────────────────────────────────────────────────────

CREATE TYPE global.risk_category AS ENUM (
    'operational',
    'regulatory',
    'cybersecurity',
    'vendor',
    'strategic',
    'financial',
    'reputational'
);

CREATE TYPE global.risk_treatment AS ENUM (
    'accept',
    'mitigate',
    'transfer',
    'avoid'
);

CREATE TYPE global.risk_status AS ENUM (
    'open',
    'in_treatment',
    'accepted',
    'resolved',
    'closed'
);

-- ── Vendors ──────────────────────────────────────────────────────────────────

CREATE TYPE global.vendor_criticality AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);

CREATE TYPE global.vendor_data_access AS ENUM (
    'none',
    'limited',
    'standard',
    'elevated',
    'administrative'
);

CREATE TYPE global.vendor_status AS ENUM (
    'active',
    'under_review',
    'suspended',
    'offboarded'
);

CREATE TYPE global.assessment_status AS ENUM (
    'not_started',
    'sent',
    'in_progress',
    'submitted',
    'reviewed',
    'overdue'
);

CREATE TYPE global.vendor_doc_type AS ENUM (
    'soc2_report',
    'iso27001_certificate',
    'penetration_test_report',
    'data_processing_agreement',
    'business_associate_agreement',
    'insurance_certificate',
    'financial_statement',
    'other'
);

-- ── Audits ───────────────────────────────────────────────────────────────────

CREATE TYPE global.audit_type AS ENUM (
    'internal',
    'external',
    'readiness',
    'gap_analysis',
    'surveillance'
);

CREATE TYPE global.audit_status AS ENUM (
    'planning',
    'fieldwork',
    'reporting',
    'remediation',
    'closed'
);

CREATE TYPE global.finding_type AS ENUM (
    'observation',
    'minor_nonconformity',
    'major_nonconformity',
    'critical'
);

CREATE TYPE global.finding_status AS ENUM (
    'open',
    'in_remediation',
    'resolved',
    'risk_accepted',
    'closed'
);

CREATE TYPE global.evidence_request_status AS ENUM (
    'open',
    'in_progress',
    'fulfilled',
    'waived'
);

-- ── Training ─────────────────────────────────────────────────────────────────

CREATE TYPE global.training_content_type AS ENUM (
    'video',
    'pdf',
    'scorm',
    'external_link',
    'quiz'
);

CREATE TYPE global.training_status AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'failed',
    'expired'
);

-- ── Incidents ────────────────────────────────────────────────────────────────

CREATE TYPE global.incident_type AS ENUM (
    'data_breach',
    'policy_violation',
    'control_failure',
    'regulatory_query',
    'security_incident',
    'service_disruption'
);

CREATE TYPE global.incident_severity AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);

CREATE TYPE global.incident_status AS ENUM (
    'reported',
    'under_investigation',
    'contained',
    'resolved',
    'closed'
);

CREATE TYPE global.notification_recipient_type AS ENUM (
    'supervisory_authority',
    'data_subject',
    'internal_stakeholder',
    'board'
);

-- ── Privacy ──────────────────────────────────────────────────────────────────

CREATE TYPE global.dsar_type AS ENUM (
    'access',
    'deletion',
    'rectification',
    'portability',
    'restriction',
    'objection'
);

CREATE TYPE global.dsar_status AS ENUM (
    'received',
    'identity_pending',
    'in_progress',
    'completed',
    'rejected',
    'extended'
);

CREATE TYPE global.legal_basis AS ENUM (
    'consent',
    'contract',
    'legal_obligation',
    'vital_interests',
    'public_task',
    'legitimate_interests'
);

CREATE TYPE global.dpia_status AS ENUM (
    'draft',
    'in_review',
    'approved',
    'rejected'
);

CREATE TYPE global.risk_level AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);

-- ── Integrations ─────────────────────────────────────────────────────────────

CREATE TYPE global.integration_type AS ENUM (
    'aws', 'azure', 'gcp',
    'okta', 'entra_id', 'google_workspace', 'jumpcloud',
    'github', 'gitlab', 'bitbucket',
    'jira', 'linear', 'asana',
    'bamboohr', 'workday', 'rippling', 'hibob',
    'jamf', 'intune',
    'crowdstrike', 'sentinelone', 'qualys',
    'slack', 'microsoft_teams',
    'servicenow', 'zendesk'
);

CREATE TYPE global.run_status AS ENUM (
    'queued',
    'running',
    'completed',
    'failed',
    'partial'
);

-- ── Notifications ────────────────────────────────────────────────────────────

CREATE TYPE global.notification_channel AS ENUM (
    'email',
    'in_app',
    'webhook',
    'slack'
);

CREATE TYPE global.notification_status AS ENUM (
    'pending',
    'sent',
    'delivered',
    'failed',
    'read'
);

-- ── Portal Invitations ───────────────────────────────────────────────────────

CREATE TYPE global.invitation_type AS ENUM (
    'auditor_external',
    'vendor_assessment'
);


-- =============================================================================
-- SECTION 3: GLOBAL SCHEMA
-- =============================================================================

SET search_path = global, public;

-- ── tenants ──────────────────────────────────────────────────────────────────

CREATE TABLE global.tenants (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    name            VARCHAR(255)    NOT NULL,
    slug            VARCHAR(100)    NOT NULL,
    schema_name     VARCHAR(100)    NOT NULL,
    tier            global.tenant_tier  NOT NULL DEFAULT 'trial',
    status          global.tenant_status NOT NULL DEFAULT 'trial',
    region          VARCHAR(20)     NOT NULL DEFAULT 'us-east-1',
    logo_url        VARCHAR(500)    NULL,
    settings        JSONB           NOT NULL DEFAULT '{}',
    trial_ends_at   TIMESTAMPTZ     NULL,
    deleted_at      TIMESTAMPTZ     NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tenants PRIMARY KEY (id),
    CONSTRAINT uq_tenants_slug
        UNIQUE (slug),
    CONSTRAINT uq_tenants_schema_name
        UNIQUE (schema_name),
    CONSTRAINT chk_tenants_slug_format
        CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,98}[a-z0-9]$'),
    CONSTRAINT chk_tenants_region
        CHECK (region IN ('us-east-1', 'eu-central-1', 'af-south-1', 'me-south-1', 'ap-southeast-1'))
);

COMMENT ON TABLE global.tenants IS
    'Organization registry. Each row represents one ComplianceCore customer tenant.';
COMMENT ON COLUMN global.tenants.schema_name IS
    'PostgreSQL schema name for this tenant. Format: tenant_<uuid_nodashes>.';
COMMENT ON COLUMN global.tenants.region IS
    'Data residency region. Determines which S3 bucket and DB cluster stores tenant data.';


-- ── users ────────────────────────────────────────────────────────────────────

CREATE TABLE global.users (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    email               VARCHAR(320)    NOT NULL,
    name                VARCHAR(255)    NOT NULL,
    avatar_url          VARCHAR(500)    NULL,
    password_hash       VARCHAR(255)    NULL,   -- NULL for SSO-only accounts
    email_verified      BOOLEAN         NOT NULL DEFAULT FALSE,
    email_verified_at   TIMESTAMPTZ     NULL,
    last_login_at       TIMESTAMPTZ     NULL,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    deleted_at          TIMESTAMPTZ     NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_email
        UNIQUE (email),
    CONSTRAINT chk_users_email_format
        CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

COMMENT ON TABLE global.users IS
    'Global user identity store. A user may belong to multiple tenants via tenant_memberships.';
COMMENT ON COLUMN global.users.password_hash IS
    'Bcrypt hash (cost=12). NULL for users who authenticate exclusively via SSO.';


-- ── tenant_memberships ───────────────────────────────────────────────────────

CREATE TABLE global.tenant_memberships (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    user_id             UUID            NOT NULL,
    role                global.user_role NOT NULL DEFAULT 'employee',
    is_primary_tenant   BOOLEAN         NOT NULL DEFAULT FALSE,
    invited_at          TIMESTAMPTZ     NULL,
    accepted_at         TIMESTAMPTZ     NULL,
    invited_by          UUID            NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tenant_memberships PRIMARY KEY (id),
    CONSTRAINT uq_tenant_memberships_tenant_user
        UNIQUE (tenant_id, user_id),
    CONSTRAINT fk_tenant_memberships_tenant
        FOREIGN KEY (tenant_id) REFERENCES global.tenants(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_tenant_memberships_user
        FOREIGN KEY (user_id) REFERENCES global.users(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_tenant_memberships_invited_by
        FOREIGN KEY (invited_by) REFERENCES global.users(id)
        ON DELETE SET NULL
);

COMMENT ON TABLE global.tenant_memberships IS
    'Maps users to tenants with a specific role. A user can be a member of multiple tenants.';


-- ── sessions ─────────────────────────────────────────────────────────────────

CREATE TABLE global.sessions (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL,
    tenant_id       UUID            NOT NULL,
    jti             VARCHAR(128)    NOT NULL,   -- JWT ID — unique per access token
    ip_address      INET            NULL,
    user_agent      VARCHAR(500)    NULL,
    last_active_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ     NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_sessions PRIMARY KEY (id),
    CONSTRAINT uq_sessions_jti
        UNIQUE (jti),
    CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES global.users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_sessions_tenant
        FOREIGN KEY (tenant_id) REFERENCES global.tenants(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE global.sessions IS
    'Active authentication sessions. Pruned by a nightly job after expiry.';


-- ── refresh_tokens ───────────────────────────────────────────────────────────

CREATE TABLE global.refresh_tokens (
    id          UUID            NOT NULL DEFAULT gen_random_uuid(),
    session_id  UUID            NOT NULL,
    token_hash  VARCHAR(64)     NOT NULL,   -- SHA-256 of the opaque token value
    is_revoked  BOOLEAN         NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ     NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT uq_refresh_tokens_token_hash
        UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_session
        FOREIGN KEY (session_id) REFERENCES global.sessions(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE global.refresh_tokens IS
    'Opaque refresh tokens (stored as SHA-256 hashes). One active token per session.';


-- ── mfa_credentials ──────────────────────────────────────────────────────────

CREATE TABLE global.mfa_credentials (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL,
    totp_secret     VARCHAR(64)     NOT NULL,   -- AES-256 encrypted TOTP secret
    backup_codes    TEXT[]          NOT NULL DEFAULT '{}', -- hashed backup codes
    is_enabled      BOOLEAN         NOT NULL DEFAULT FALSE,
    enabled_at      TIMESTAMPTZ     NULL,
    last_used_at    TIMESTAMPTZ     NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_mfa_credentials PRIMARY KEY (id),
    CONSTRAINT uq_mfa_credentials_user
        UNIQUE (user_id),
    CONSTRAINT fk_mfa_credentials_user
        FOREIGN KEY (user_id) REFERENCES global.users(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE global.mfa_credentials IS
    'TOTP MFA credentials per user. totp_secret is encrypted at the application layer before storage.';


-- ── sso_configurations ───────────────────────────────────────────────────────

CREATE TABLE global.sso_configurations (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL,
    provider_type       VARCHAR(20)     NOT NULL DEFAULT 'saml',
    idp_entity_id       VARCHAR(500)    NOT NULL,
    idp_sso_url         VARCHAR(500)    NOT NULL,
    idp_x509_cert       TEXT            NOT NULL,
    attribute_mappings  JSONB           NOT NULL DEFAULT '{}',
    scim_enabled        BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_sso_configurations PRIMARY KEY (id),
    CONSTRAINT uq_sso_configurations_tenant
        UNIQUE (tenant_id),
    CONSTRAINT fk_sso_configurations_tenant
        FOREIGN KEY (tenant_id) REFERENCES global.tenants(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_sso_provider_type
        CHECK (provider_type IN ('saml', 'oidc'))
);

COMMENT ON TABLE global.sso_configurations IS
    'Per-tenant SSO configuration (SAML 2.0 or OIDC). One config per tenant maximum.';


-- ── scim_tokens ──────────────────────────────────────────────────────────────

CREATE TABLE global.scim_tokens (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id       UUID            NOT NULL,
    token_hash      VARCHAR(64)     NOT NULL,
    description     VARCHAR(255)    NOT NULL DEFAULT 'SCIM provisioning token',
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    last_used_at    TIMESTAMPTZ     NULL,
    expires_at      TIMESTAMPTZ     NULL,
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_scim_tokens PRIMARY KEY (id),
    CONSTRAINT uq_scim_tokens_hash
        UNIQUE (token_hash),
    CONSTRAINT fk_scim_tokens_tenant
        FOREIGN KEY (tenant_id) REFERENCES global.tenants(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_scim_tokens_created_by
        FOREIGN KEY (created_by) REFERENCES global.users(id)
        ON DELETE RESTRICT
);


-- ── subscriptions ────────────────────────────────────────────────────────────

CREATE TABLE global.subscriptions (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID            NOT NULL,
    plan                    global.tenant_tier NOT NULL,
    stripe_subscription_id  VARCHAR(100)    NULL,
    stripe_customer_id      VARCHAR(100)    NULL,
    seat_limit              INT             NOT NULL DEFAULT 10,
    framework_limit         INT             NOT NULL DEFAULT 1,
    vendor_limit            INT             NOT NULL DEFAULT 0,
    storage_gb_limit        INT             NOT NULL DEFAULT 10,
    current_period_start    TIMESTAMPTZ     NULL,
    current_period_end      TIMESTAMPTZ     NULL,
    cancelled_at            TIMESTAMPTZ     NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_subscriptions PRIMARY KEY (id),
    CONSTRAINT uq_subscriptions_tenant
        UNIQUE (tenant_id),
    CONSTRAINT fk_subscriptions_tenant
        FOREIGN KEY (tenant_id) REFERENCES global.tenants(id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_subscriptions_seat_limit
        CHECK (seat_limit > 0),
    CONSTRAINT chk_subscriptions_storage_limit
        CHECK (storage_gb_limit > 0)
);

COMMENT ON TABLE global.subscriptions IS
    'Billing plan and entitlements per tenant. Seat/framework/vendor limits enforced at API layer.';


-- ── msp_relationships ────────────────────────────────────────────────────────

CREATE TABLE global.msp_relationships (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    msp_tenant_id       UUID            NOT NULL,
    client_tenant_id    UUID            NOT NULL,
    white_label_enabled BOOLEAN         NOT NULL DEFAULT FALSE,
    custom_domain       VARCHAR(255)    NULL,
    custom_logo_url     VARCHAR(500)    NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_msp_relationships PRIMARY KEY (id),
    CONSTRAINT uq_msp_relationships_pair
        UNIQUE (msp_tenant_id, client_tenant_id),
    CONSTRAINT fk_msp_relationships_msp
        FOREIGN KEY (msp_tenant_id) REFERENCES global.tenants(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_msp_relationships_client
        FOREIGN KEY (client_tenant_id) REFERENCES global.tenants(id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_msp_no_self_reference
        CHECK (msp_tenant_id != client_tenant_id)
);

COMMENT ON TABLE global.msp_relationships IS
    'Links an MSP tenant to the client tenants it manages. Enables the MSP console portfolio view.';


-- ── portal_invitations ───────────────────────────────────────────────────────

CREATE TABLE global.portal_invitations (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               UUID            NOT NULL,
    invitation_type         global.invitation_type NOT NULL,
    email                   VARCHAR(320)    NOT NULL,
    token_hash              VARCHAR(64)     NOT NULL,
    audit_engagement_id     UUID            NULL,   -- set for auditor_external type
    vendor_id               UUID            NULL,   -- set for vendor_assessment type
    scoped_permissions      JSONB           NOT NULL DEFAULT '{}',
    invited_by              UUID            NOT NULL,
    expires_at              TIMESTAMPTZ     NOT NULL,
    accepted_at             TIMESTAMPTZ     NULL,
    revoked_at              TIMESTAMPTZ     NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_portal_invitations PRIMARY KEY (id),
    CONSTRAINT uq_portal_invitations_token
        UNIQUE (token_hash),
    CONSTRAINT fk_portal_invitations_tenant
        FOREIGN KEY (tenant_id) REFERENCES global.tenants(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_portal_invitations_invited_by
        FOREIGN KEY (invited_by) REFERENCES global.users(id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE global.portal_invitations IS
    'Scoped, time-limited invitations for external auditors and vendor contacts.';


-- ── global_audit_log ─────────────────────────────────────────────────────────

CREATE TABLE global.global_audit_log (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    actor_user_id   UUID            NULL,
    actor_email     VARCHAR(320)    NULL,
    tenant_id       UUID            NULL,
    action          VARCHAR(100)    NOT NULL,
    entity_type     VARCHAR(100)    NULL,
    entity_id       UUID            NULL,
    old_value       JSONB           NULL,
    new_value       JSONB           NULL,
    ip_address      INET            NULL,
    user_agent      VARCHAR(500)    NULL,
    request_id      VARCHAR(128)    NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_global_audit_log PRIMARY KEY (id)
    -- No FK constraints — denormalized for immutability and historical accuracy
    -- Records must remain even if the referenced user/tenant is deleted
) PARTITION BY RANGE (created_at);

-- Create initial partitions (monthly)
CREATE TABLE global.global_audit_log_2027_01
    PARTITION OF global.global_audit_log
    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

CREATE TABLE global.global_audit_log_2027_02
    PARTITION OF global.global_audit_log
    FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

COMMENT ON TABLE global.global_audit_log IS
    'Immutable platform-level event log. Partitioned by month for archival. No UPDATE or DELETE permitted.';


-- =============================================================================
-- SECTION 4: FRAMEWORK DATA SCHEMA (read-only reference data)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS framework_data;
SET search_path = framework_data, global, public;

-- ── frameworks ───────────────────────────────────────────────────────────────

CREATE TABLE framework_data.frameworks (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    code                VARCHAR(50)     NOT NULL,   -- e.g., 'ISO27001', 'SOC2', 'NDPR'
    name                VARCHAR(255)    NOT NULL,
    short_name          VARCHAR(50)     NOT NULL,
    version             VARCHAR(20)     NOT NULL,   -- e.g., '2022', 'Type II'
    jurisdiction        VARCHAR(100)    NOT NULL,   -- e.g., 'International', 'Nigeria', 'EU'
    issuing_body        VARCHAR(255)    NOT NULL,   -- e.g., 'ISO', 'AICPA', 'NDPC'
    description         TEXT            NOT NULL,
    documentation_url   VARCHAR(500)    NULL,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    effective_date      DATE            NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_frameworks PRIMARY KEY (id),
    CONSTRAINT uq_frameworks_code_version
        UNIQUE (code, version)
);

COMMENT ON TABLE framework_data.frameworks IS
    'Master registry of supported compliance frameworks. Managed by ORION SOFT — read-only at runtime.';


-- ── framework_versions ───────────────────────────────────────────────────────

CREATE TABLE framework_data.framework_versions (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    framework_id        UUID            NOT NULL,
    version             VARCHAR(20)     NOT NULL,
    previous_version    VARCHAR(20)     NULL,
    change_summary      TEXT            NOT NULL,
    is_current          BOOLEAN         NOT NULL DEFAULT FALSE,
    published_at        DATE            NOT NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_framework_versions PRIMARY KEY (id),
    CONSTRAINT uq_framework_versions_framework_version
        UNIQUE (framework_id, version),
    CONSTRAINT fk_framework_versions_framework
        FOREIGN KEY (framework_id) REFERENCES framework_data.frameworks(id)
        ON DELETE CASCADE
);


-- ── framework_categories ─────────────────────────────────────────────────────

CREATE TABLE framework_data.framework_categories (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    framework_id    UUID            NOT NULL,
    code            VARCHAR(20)     NOT NULL,   -- e.g., 'A.5', 'CC1', 'SP-1'
    name            VARCHAR(255)    NOT NULL,
    description     TEXT            NULL,
    sort_order      INT             NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_framework_categories PRIMARY KEY (id),
    CONSTRAINT uq_framework_categories_code
        UNIQUE (framework_id, code),
    CONSTRAINT fk_framework_categories_framework
        FOREIGN KEY (framework_id) REFERENCES framework_data.frameworks(id)
        ON DELETE CASCADE
);


-- ── framework_controls ───────────────────────────────────────────────────────

CREATE TABLE framework_data.framework_controls (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    framework_id            UUID            NOT NULL,
    category_id             UUID            NOT NULL,
    version_id              UUID            NOT NULL,
    control_ref             VARCHAR(50)     NOT NULL,   -- e.g., 'A.5.1.1', 'CC6.1', 'Art.30'
    title                   VARCHAR(500)    NOT NULL,
    description             TEXT            NOT NULL,
    guidance                TEXT            NULL,
    test_procedures         TEXT[]          NOT NULL DEFAULT '{}',
    control_type            VARCHAR(50)     NOT NULL DEFAULT 'operational', -- preventive, detective, corrective
    implementation_group    VARCHAR(10)     NULL,   -- for CIS Controls IG1/IG2/IG3
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    sort_order              INT             NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_framework_controls PRIMARY KEY (id),
    CONSTRAINT uq_framework_controls_ref
        UNIQUE (framework_id, control_ref),
    CONSTRAINT fk_framework_controls_framework
        FOREIGN KEY (framework_id) REFERENCES framework_data.frameworks(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_framework_controls_category
        FOREIGN KEY (category_id) REFERENCES framework_data.framework_categories(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_framework_controls_version
        FOREIGN KEY (version_id) REFERENCES framework_data.framework_versions(id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_framework_controls_type
        CHECK (control_type IN ('preventive', 'detective', 'corrective', 'operational', 'technical', 'administrative'))
);

COMMENT ON TABLE framework_data.framework_controls IS
    'Individual control requirements for each framework. The Universal Control Framework (UCF) source of truth.';


-- ── ucf_mappings ─────────────────────────────────────────────────────────────

CREATE TABLE framework_data.ucf_mappings (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    source_control_id   UUID            NOT NULL,
    target_control_id   UUID            NOT NULL,
    mapping_type        global.mapping_type NOT NULL DEFAULT 'equivalent',
    confidence_level    global.mapping_confidence NOT NULL DEFAULT 'high',
    rationale           TEXT            NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_ucf_mappings PRIMARY KEY (id),
    CONSTRAINT uq_ucf_mappings_pair
        UNIQUE (source_control_id, target_control_id),
    CONSTRAINT fk_ucf_mappings_source
        FOREIGN KEY (source_control_id) REFERENCES framework_data.framework_controls(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_ucf_mappings_target
        FOREIGN KEY (target_control_id) REFERENCES framework_data.framework_controls(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_ucf_no_self_mapping
        CHECK (source_control_id != target_control_id)
);

COMMENT ON TABLE framework_data.ucf_mappings IS
    'Cross-framework control equivalency map. Enables gap analysis and evidence reuse across frameworks.';


-- ── framework_tags ───────────────────────────────────────────────────────────

CREATE TABLE framework_data.framework_tags (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    framework_control_id    UUID            NOT NULL,
    tag                     VARCHAR(100)    NOT NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_framework_tags PRIMARY KEY (id),
    CONSTRAINT uq_framework_tags_control_tag
        UNIQUE (framework_control_id, tag),
    CONSTRAINT fk_framework_tags_control
        FOREIGN KEY (framework_control_id) REFERENCES framework_data.framework_controls(id)
        ON DELETE CASCADE
);


-- =============================================================================
-- SECTION 5: TENANT TEMPLATE SCHEMA
-- Applied once per tenant at provisioning via: SET search_path = tenant_{uuid}
-- All tables below are relative to the active tenant schema.
-- =============================================================================

-- ── tenant_settings ──────────────────────────────────────────────────────────

CREATE TABLE tenant_settings (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    key             VARCHAR(100)    NOT NULL,
    value           JSONB           NOT NULL,
    description     TEXT            NULL,
    updated_by      UUID            NULL,   -- references global.users(id) — not FK enforced across schemas
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_tenant_settings PRIMARY KEY (id),
    CONSTRAINT uq_tenant_settings_key
        UNIQUE (key)
);

-- ── controls ─────────────────────────────────────────────────────────────────

CREATE TABLE controls (
    id                      UUID                    NOT NULL DEFAULT gen_random_uuid(),
    framework_control_id    UUID                    NOT NULL,   -- references framework_data.framework_controls
    status                  global.control_status   NOT NULL DEFAULT 'not_started',
    implementation_notes    TEXT                    NULL,
    custom_title            VARCHAR(500)            NULL,   -- override the framework control title
    custom_description      TEXT                    NULL,
    is_automated            BOOLEAN                 NOT NULL DEFAULT FALSE,
    risk_score              INT                     NOT NULL DEFAULT 0,
    last_tested_at          TIMESTAMPTZ             NULL,
    next_review_date        DATE                    NULL,
    created_by              UUID                    NOT NULL,
    updated_by              UUID                    NOT NULL,
    deleted_at              TIMESTAMPTZ             NULL,
    created_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_controls PRIMARY KEY (id),
    CONSTRAINT chk_controls_risk_score
        CHECK (risk_score BETWEEN 0 AND 100)
);

COMMENT ON TABLE controls IS
    'Tenant''s instantiated compliance controls, linked to the UCF framework_controls reference.';
COMMENT ON COLUMN controls.framework_control_id IS
    'FK to framework_data.framework_controls — enforced at application layer (cross-schema FKs not supported in PostgreSQL).';
COMMENT ON COLUMN controls.is_automated IS
    'True when at least one integration is providing automated evidence for this control.';

-- Partial unique index: one active control instance per framework control
CREATE UNIQUE INDEX uq_controls_framework_control_active
    ON controls(framework_control_id)
    WHERE deleted_at IS NULL;


-- ── control_owners ───────────────────────────────────────────────────────────

CREATE TABLE control_owners (
    id              UUID                            NOT NULL DEFAULT gen_random_uuid(),
    control_id      UUID                            NOT NULL,
    user_id         UUID                            NOT NULL,
    ownership_type  global.control_ownership_type   NOT NULL DEFAULT 'primary',
    assigned_at     TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
    assigned_by     UUID                            NOT NULL,
    created_at      TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_control_owners PRIMARY KEY (id),
    CONSTRAINT uq_control_owners_control_user
        UNIQUE (control_id, user_id),
    CONSTRAINT fk_control_owners_control
        FOREIGN KEY (control_id) REFERENCES controls(id)
        ON DELETE CASCADE
);


-- ── control_framework_links ──────────────────────────────────────────────────

CREATE TABLE control_framework_links (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    control_id              UUID            NOT NULL,
    framework_control_id    UUID            NOT NULL,   -- the additional framework control satisfied
    is_primary              BOOLEAN         NOT NULL DEFAULT FALSE,
    linked_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    linked_by               UUID            NOT NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_control_framework_links PRIMARY KEY (id),
    CONSTRAINT uq_control_framework_links_pair
        UNIQUE (control_id, framework_control_id),
    CONSTRAINT fk_control_framework_links_control
        FOREIGN KEY (control_id) REFERENCES controls(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE control_framework_links IS
    'Records which additional framework controls this tenant control satisfies beyond its primary link.';


-- ── control_tests ────────────────────────────────────────────────────────────

CREATE TABLE control_tests (
    id          UUID                        NOT NULL DEFAULT gen_random_uuid(),
    control_id  UUID                        NOT NULL,
    test_type   VARCHAR(50)                 NOT NULL DEFAULT 'manual',
    result      global.control_test_result  NOT NULL,
    notes       TEXT                        NULL,
    test_data   JSONB                       NULL,
    tested_by   UUID                        NOT NULL,
    tested_at   TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_control_tests PRIMARY KEY (id),
    CONSTRAINT fk_control_tests_control
        FOREIGN KEY (control_id) REFERENCES controls(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_control_tests_type
        CHECK (test_type IN ('manual', 'automated', 'walthrough', 'inspection', 'observation'))
);


-- ── control_comments ─────────────────────────────────────────────────────────

CREATE TABLE control_comments (
    id          UUID            NOT NULL DEFAULT gen_random_uuid(),
    control_id  UUID            NOT NULL,
    body        TEXT            NOT NULL,
    author_id   UUID            NOT NULL,
    deleted_at  TIMESTAMPTZ     NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_control_comments PRIMARY KEY (id),
    CONSTRAINT fk_control_comments_control
        FOREIGN KEY (control_id) REFERENCES controls(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_control_comments_body_not_empty
        CHECK (LENGTH(TRIM(body)) > 0)
);


-- ── evidence_items ───────────────────────────────────────────────────────────

CREATE TABLE evidence_items (
    id              UUID                    NOT NULL DEFAULT gen_random_uuid(),
    title           VARCHAR(500)            NOT NULL,
    description     TEXT                    NULL,
    source          global.evidence_source  NOT NULL DEFAULT 'manual_upload',
    storage_key     VARCHAR(1000)           NOT NULL,
    storage_bucket  VARCHAR(255)            NOT NULL,
    storage_region  VARCHAR(30)             NOT NULL,
    file_type       VARCHAR(20)             NULL,   -- pdf, png, json, xlsx, etc.
    mime_type       VARCHAR(100)            NULL,
    file_size_bytes BIGINT                  NOT NULL DEFAULT 0,
    sha256_hash     VARCHAR(64)             NOT NULL,
    expires_at      DATE                    NULL,
    is_expired      BOOLEAN                 NOT NULL DEFAULT FALSE,
    metadata        JSONB                   NOT NULL DEFAULT '{}',
    uploaded_by     UUID                    NOT NULL,
    deleted_at      TIMESTAMPTZ             NULL,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_evidence_items PRIMARY KEY (id),
    CONSTRAINT uq_evidence_items_storage_key
        UNIQUE (storage_key),
    CONSTRAINT chk_evidence_file_size
        CHECK (file_size_bytes >= 0 AND file_size_bytes <= 524288000),
    CONSTRAINT chk_evidence_sha256_format
        CHECK (sha256_hash ~ '^[a-f0-9]{64}$')
);

COMMENT ON TABLE evidence_items IS
    'Evidence artifacts uploaded manually or collected by integrations. The file lives in S3; this table stores metadata.';


-- ── control_evidence ─────────────────────────────────────────────────────────

CREATE TABLE control_evidence (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    control_id      UUID            NOT NULL,
    evidence_id     UUID            NOT NULL,
    relevance_note  TEXT            NULL,
    linked_by       UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_control_evidence PRIMARY KEY (id),
    CONSTRAINT uq_control_evidence_pair
        UNIQUE (control_id, evidence_id),
    CONSTRAINT fk_control_evidence_control
        FOREIGN KEY (control_id) REFERENCES controls(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_control_evidence_evidence
        FOREIGN KEY (evidence_id) REFERENCES evidence_items(id)
        ON DELETE CASCADE
);


-- ── evidence_reviews ─────────────────────────────────────────────────────────

CREATE TABLE evidence_reviews (
    id              UUID                            NOT NULL DEFAULT gen_random_uuid(),
    evidence_id     UUID                            NOT NULL,
    verdict         global.evidence_review_verdict  NOT NULL,
    notes           TEXT                            NULL,
    reviewed_by     UUID                            NOT NULL,
    reviewed_at     TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_evidence_reviews PRIMARY KEY (id),
    CONSTRAINT fk_evidence_reviews_evidence
        FOREIGN KEY (evidence_id) REFERENCES evidence_items(id)
        ON DELETE CASCADE
);


-- ── policies ─────────────────────────────────────────────────────────────────

CREATE TABLE policies (
    id                      UUID                    NOT NULL DEFAULT gen_random_uuid(),
    title                   VARCHAR(500)            NOT NULL,
    document_type           global.policy_type      NOT NULL DEFAULT 'policy',
    current_version         INT                     NOT NULL DEFAULT 0,
    status                  global.policy_status    NOT NULL DEFAULT 'draft',
    owner_id                UUID                    NOT NULL,
    review_due_date         DATE                    NULL,
    review_frequency_days   INT                     NOT NULL DEFAULT 365,
    framework_ids           VARCHAR(50)[]           NOT NULL DEFAULT '{}',
    deleted_at              TIMESTAMPTZ             NULL,
    created_by              UUID                    NOT NULL,
    updated_by              UUID                    NOT NULL,
    created_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_policies PRIMARY KEY (id),
    CONSTRAINT chk_policies_review_frequency
        CHECK (review_frequency_days > 0),
    CONSTRAINT chk_policies_current_version
        CHECK (current_version >= 0)
);

CREATE UNIQUE INDEX uq_policies_title_active
    ON policies(LOWER(title)) WHERE deleted_at IS NULL;


-- ── policy_versions ──────────────────────────────────────────────────────────

CREATE TABLE policy_versions (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    policy_id           UUID            NOT NULL,
    version_number      INT             NOT NULL,
    content_json        TEXT            NOT NULL,   -- TipTap/ProseMirror JSON
    content_text        TEXT            NOT NULL,   -- plain text for search
    change_summary      VARCHAR(500)    NULL,
    authored_by         UUID            NOT NULL,
    published_at        TIMESTAMPTZ     NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_policy_versions PRIMARY KEY (id),
    CONSTRAINT uq_policy_versions_policy_version
        UNIQUE (policy_id, version_number),
    CONSTRAINT fk_policy_versions_policy
        FOREIGN KEY (policy_id) REFERENCES policies(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_policy_version_number_positive
        CHECK (version_number > 0)
);

COMMENT ON TABLE policy_versions IS
    'Immutable snapshots of each policy version. New edits create a new version row — never UPDATE content.';


-- ── policy_approvals ─────────────────────────────────────────────────────────

CREATE TABLE policy_approvals (
    id                  UUID                    NOT NULL DEFAULT gen_random_uuid(),
    policy_version_id   UUID                    NOT NULL,
    approver_id         UUID                    NOT NULL,
    stage_number        INT                     NOT NULL,
    status              global.approval_status  NOT NULL DEFAULT 'pending',
    comments            TEXT                    NULL,
    approved_at         TIMESTAMPTZ             NULL,
    due_at              TIMESTAMPTZ             NULL,
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_policy_approvals PRIMARY KEY (id),
    CONSTRAINT uq_policy_approvals_version_approver_stage
        UNIQUE (policy_version_id, approver_id, stage_number),
    CONSTRAINT fk_policy_approvals_version
        FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_policy_approval_stage
        CHECK (stage_number > 0)
);


-- ── policy_acknowledgments ───────────────────────────────────────────────────

CREATE TABLE policy_acknowledgments (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    policy_id           UUID            NOT NULL,
    policy_version_id   UUID            NOT NULL,
    user_id             UUID            NOT NULL,
    ip_address          INET            NULL,
    user_agent          VARCHAR(500)    NULL,
    acknowledged_at     TIMESTAMPTZ     NULL,   -- NULL = not yet acknowledged
    due_at              TIMESTAMPTZ     NULL,
    reminder_sent_at    TIMESTAMPTZ     NULL,
    escalation_sent_at  TIMESTAMPTZ     NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_policy_acknowledgments PRIMARY KEY (id),
    CONSTRAINT uq_policy_acknowledgments_version_user
        UNIQUE (policy_id, policy_version_id, user_id),
    CONSTRAINT fk_policy_acknowledgments_policy
        FOREIGN KEY (policy_id) REFERENCES policies(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_policy_acknowledgments_version
        FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE policy_acknowledgments IS
    'Compliance records — never deleted. Records whether each user acknowledged each policy version.';


-- ── policy_control_links ─────────────────────────────────────────────────────

CREATE TABLE policy_control_links (
    id          UUID            NOT NULL DEFAULT gen_random_uuid(),
    policy_id   UUID            NOT NULL,
    control_id  UUID            NOT NULL,
    linked_by   UUID            NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_policy_control_links PRIMARY KEY (id),
    CONSTRAINT uq_policy_control_links_pair
        UNIQUE (policy_id, control_id),
    CONSTRAINT fk_policy_control_links_policy
        FOREIGN KEY (policy_id) REFERENCES policies(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_policy_control_links_control
        FOREIGN KEY (control_id) REFERENCES controls(id)
        ON DELETE CASCADE
);


-- ── risks ────────────────────────────────────────────────────────────────────

CREATE TABLE risks (
    id                      UUID                    NOT NULL DEFAULT gen_random_uuid(),
    title                   VARCHAR(500)            NOT NULL,
    description             TEXT                    NOT NULL,
    category                global.risk_category    NOT NULL DEFAULT 'operational',
    inherent_likelihood     INT                     NOT NULL,
    inherent_impact         INT                     NOT NULL,
    inherent_score          INT                     NOT NULL,
    treatment               global.risk_treatment   NOT NULL DEFAULT 'mitigate',
    residual_likelihood     INT                     NOT NULL,
    residual_impact         INT                     NOT NULL,
    residual_score          INT                     NOT NULL,
    status                  global.risk_status      NOT NULL DEFAULT 'open',
    owner_id                UUID                    NOT NULL,
    review_date             DATE                    NULL,
    next_review_date        DATE                    NULL,
    deleted_at              TIMESTAMPTZ             NULL,
    created_by              UUID                    NOT NULL,
    updated_by              UUID                    NOT NULL,
    created_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_risks PRIMARY KEY (id),
    CONSTRAINT chk_risks_inherent_likelihood
        CHECK (inherent_likelihood BETWEEN 1 AND 5),
    CONSTRAINT chk_risks_inherent_impact
        CHECK (inherent_impact BETWEEN 1 AND 5),
    CONSTRAINT chk_risks_inherent_score
        CHECK (inherent_score = inherent_likelihood * inherent_impact),
    CONSTRAINT chk_risks_residual_likelihood
        CHECK (residual_likelihood BETWEEN 1 AND 5),
    CONSTRAINT chk_risks_residual_impact
        CHECK (residual_impact BETWEEN 1 AND 5),
    CONSTRAINT chk_risks_residual_score
        CHECK (residual_score = residual_likelihood * residual_impact)
);


-- ── risk_treatment_plans ─────────────────────────────────────────────────────

CREATE TABLE risk_treatment_plans (
    id                  UUID                    NOT NULL DEFAULT gen_random_uuid(),
    risk_id             UUID                    NOT NULL,
    description         TEXT                    NOT NULL,
    treatment_type      global.risk_treatment   NOT NULL,
    target_date         DATE                    NOT NULL,
    completed_date      DATE                    NULL,
    status              VARCHAR(30)             NOT NULL DEFAULT 'in_progress',
    owner_id            UUID                    NOT NULL,
    estimated_cost_usd  INT                     NULL,
    created_by          UUID                    NOT NULL,
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_risk_treatment_plans PRIMARY KEY (id),
    CONSTRAINT fk_risk_treatment_plans_risk
        FOREIGN KEY (risk_id) REFERENCES risks(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_risk_treatment_status
        CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled'))
);


-- ── risk_control_links ───────────────────────────────────────────────────────

CREATE TABLE risk_control_links (
    id          UUID            NOT NULL DEFAULT gen_random_uuid(),
    risk_id     UUID            NOT NULL,
    control_id  UUID            NOT NULL,
    link_type   VARCHAR(30)     NOT NULL DEFAULT 'mitigates',
    linked_by   UUID            NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_risk_control_links PRIMARY KEY (id),
    CONSTRAINT uq_risk_control_links_pair
        UNIQUE (risk_id, control_id),
    CONSTRAINT fk_risk_control_links_risk
        FOREIGN KEY (risk_id) REFERENCES risks(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_risk_control_links_control
        FOREIGN KEY (control_id) REFERENCES controls(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_risk_control_link_type
        CHECK (link_type IN ('mitigates', 'monitors', 'accepts'))
);


-- ── risk_reviews ─────────────────────────────────────────────────────────────

CREATE TABLE risk_reviews (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    risk_id                 UUID            NOT NULL,
    previous_residual_score INT             NOT NULL,
    new_residual_score      INT             NOT NULL,
    review_notes            TEXT            NOT NULL,
    decision                VARCHAR(30)     NOT NULL,
    reviewed_by             UUID            NOT NULL,
    reviewed_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_risk_reviews PRIMARY KEY (id),
    CONSTRAINT fk_risk_reviews_risk
        FOREIGN KEY (risk_id) REFERENCES risks(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_risk_review_decision
        CHECK (decision IN ('score_unchanged', 'score_updated', 'risk_closed', 'treatment_changed'))
);


-- ── vendors ──────────────────────────────────────────────────────────────────

CREATE TABLE vendors (
    id                      UUID                        NOT NULL DEFAULT gen_random_uuid(),
    name                    VARCHAR(255)                NOT NULL,
    legal_name              VARCHAR(255)                NULL,
    website                 VARCHAR(500)                NULL,
    category                VARCHAR(100)                NOT NULL,
    criticality_tier        global.vendor_criticality   NOT NULL DEFAULT 'medium',
    data_access_level       global.vendor_data_access   NOT NULL DEFAULT 'none',
    is_subprocessor         BOOLEAN                     NOT NULL DEFAULT FALSE,
    processes_personal_data BOOLEAN                     NOT NULL DEFAULT FALSE,
    data_categories         VARCHAR(100)[]              NOT NULL DEFAULT '{}',
    service_regions         VARCHAR(30)[]               NOT NULL DEFAULT '{}',
    contract_start_date     DATE                        NULL,
    contract_renewal_date   DATE                        NULL,
    risk_score              INT                         NOT NULL DEFAULT 0,
    status                  global.vendor_status        NOT NULL DEFAULT 'active',
    owner_id                UUID                        NOT NULL,
    deleted_at              TIMESTAMPTZ                 NULL,
    created_by              UUID                        NOT NULL,
    updated_by              UUID                        NOT NULL,
    created_at              TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_vendors PRIMARY KEY (id),
    CONSTRAINT chk_vendor_risk_score
        CHECK (risk_score BETWEEN 0 AND 100)
);

CREATE UNIQUE INDEX uq_vendors_name_active
    ON vendors(LOWER(name)) WHERE deleted_at IS NULL;


-- ── vendor_contacts ──────────────────────────────────────────────────────────

CREATE TABLE vendor_contacts (
    id          UUID            NOT NULL DEFAULT gen_random_uuid(),
    vendor_id   UUID            NOT NULL,
    name        VARCHAR(255)    NOT NULL,
    email       VARCHAR(320)    NOT NULL,
    phone       VARCHAR(50)     NULL,
    role        VARCHAR(100)    NULL,
    is_primary  BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_vendor_contacts PRIMARY KEY (id),
    CONSTRAINT fk_vendor_contacts_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_vendor_contacts_email
        CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);


-- ── vendor_documents ─────────────────────────────────────────────────────────

CREATE TABLE vendor_documents (
    id              UUID                        NOT NULL DEFAULT gen_random_uuid(),
    vendor_id       UUID                        NOT NULL,
    document_type   global.vendor_doc_type      NOT NULL,
    title           VARCHAR(500)                NOT NULL,
    storage_key     VARCHAR(1000)               NOT NULL,
    storage_bucket  VARCHAR(255)                NOT NULL,
    valid_from      DATE                        NULL,
    valid_until     DATE                        NULL,
    is_expired      BOOLEAN                     NOT NULL DEFAULT FALSE,
    uploaded_by     UUID                        NOT NULL,
    created_at      TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_vendor_documents PRIMARY KEY (id),
    CONSTRAINT fk_vendor_documents_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
        ON DELETE RESTRICT
);


-- ── vendor_assessments ───────────────────────────────────────────────────────

CREATE TABLE vendor_assessments (
    id              UUID                        NOT NULL DEFAULT gen_random_uuid(),
    vendor_id       UUID                        NOT NULL,
    assessment_type VARCHAR(50)                 NOT NULL DEFAULT 'security',
    status          global.assessment_status    NOT NULL DEFAULT 'not_started',
    risk_score      INT                         NULL,
    summary         TEXT                        NULL,
    assessor_id     UUID                        NOT NULL,
    sent_at         TIMESTAMPTZ                 NULL,
    submitted_at    TIMESTAMPTZ                 NULL,
    due_at          TIMESTAMPTZ                 NULL,
    completed_at    TIMESTAMPTZ                 NULL,
    created_at      TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_vendor_assessments PRIMARY KEY (id),
    CONSTRAINT fk_vendor_assessments_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_vendor_assessment_type
        CHECK (assessment_type IN ('security', 'data_processing', 'financial', 'business_continuity', 'full')),
    CONSTRAINT chk_vendor_assessment_risk_score
        CHECK (risk_score IS NULL OR risk_score BETWEEN 0 AND 100)
);


-- ── vendor_questionnaire_responses ───────────────────────────────────────────

CREATE TABLE vendor_questionnaire_responses (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    assessment_id   UUID            NOT NULL,
    question_ref    VARCHAR(50)     NOT NULL,
    question_text   TEXT            NOT NULL,
    response_value  VARCHAR(50)     NULL,   -- yes, no, partial, n/a
    response_notes  TEXT            NULL,
    risk_level      global.risk_level NULL,
    sort_order      INT             NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_vendor_questionnaire_responses PRIMARY KEY (id),
    CONSTRAINT uq_vendor_questionnaire_response_question
        UNIQUE (assessment_id, question_ref),
    CONSTRAINT fk_vendor_questionnaire_responses_assessment
        FOREIGN KEY (assessment_id) REFERENCES vendor_assessments(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_vendor_response_value
        CHECK (response_value IS NULL OR response_value IN ('yes', 'no', 'partial', 'not_applicable', 'unknown'))
);


-- ── audit_engagements ────────────────────────────────────────────────────────

CREATE TABLE audit_engagements (
    id                  UUID                    NOT NULL DEFAULT gen_random_uuid(),
    title               VARCHAR(500)            NOT NULL,
    audit_type          global.audit_type       NOT NULL DEFAULT 'internal',
    status              global.audit_status     NOT NULL DEFAULT 'planning',
    framework_ids       VARCHAR(50)[]           NOT NULL DEFAULT '{}',
    scope_definition    JSONB                   NOT NULL DEFAULT '{}',
    planned_start_date  DATE                    NULL,
    planned_end_date    DATE                    NULL,
    actual_start_date   DATE                    NULL,
    actual_end_date     DATE                    NULL,
    lead_auditor_id     UUID                    NOT NULL,
    deleted_at          TIMESTAMPTZ             NULL,
    created_by          UUID                    NOT NULL,
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_audit_engagements PRIMARY KEY (id)
);


-- ── audit_control_selections ─────────────────────────────────────────────────

CREATE TABLE audit_control_selections (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    audit_id            UUID            NOT NULL,
    control_id          UUID            NOT NULL,
    sample_rationale    TEXT            NULL,
    selected_by         UUID            NOT NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_audit_control_selections PRIMARY KEY (id),
    CONSTRAINT uq_audit_control_selections_pair
        UNIQUE (audit_id, control_id),
    CONSTRAINT fk_audit_control_selections_audit
        FOREIGN KEY (audit_id) REFERENCES audit_engagements(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_audit_control_selections_control
        FOREIGN KEY (control_id) REFERENCES controls(id)
        ON DELETE RESTRICT
);


-- ── audit_findings ───────────────────────────────────────────────────────────

CREATE TABLE audit_findings (
    id                      UUID                    NOT NULL DEFAULT gen_random_uuid(),
    audit_id                UUID                    NOT NULL,
    finding_ref             VARCHAR(30)             NOT NULL,   -- e.g., 'F-001', 'F-002'
    finding_type            global.finding_type     NOT NULL,
    status                  global.finding_status   NOT NULL DEFAULT 'open',
    title                   VARCHAR(500)            NOT NULL,
    description             TEXT                    NOT NULL,
    root_cause              TEXT                    NULL,
    recommendation          TEXT                    NULL,
    owner_id                UUID                    NOT NULL,
    target_remediation_date DATE                    NULL,
    actual_remediation_date DATE                    NULL,
    deleted_at              TIMESTAMPTZ             NULL,
    created_by              UUID                    NOT NULL,
    created_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_audit_findings PRIMARY KEY (id),
    CONSTRAINT uq_audit_findings_ref
        UNIQUE (audit_id, finding_ref),
    CONSTRAINT fk_audit_findings_audit
        FOREIGN KEY (audit_id) REFERENCES audit_engagements(id)
        ON DELETE RESTRICT
);


-- ── audit_finding_controls ───────────────────────────────────────────────────

CREATE TABLE audit_finding_controls (
    id          UUID            NOT NULL DEFAULT gen_random_uuid(),
    finding_id  UUID            NOT NULL,
    control_id  UUID            NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_audit_finding_controls PRIMARY KEY (id),
    CONSTRAINT uq_audit_finding_controls_pair
        UNIQUE (finding_id, control_id),
    CONSTRAINT fk_audit_finding_controls_finding
        FOREIGN KEY (finding_id) REFERENCES audit_findings(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_audit_finding_controls_control
        FOREIGN KEY (control_id) REFERENCES controls(id)
        ON DELETE RESTRICT
);


-- ── management_responses ─────────────────────────────────────────────────────

CREATE TABLE management_responses (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid(),
    finding_id          UUID            NOT NULL,
    response_text       TEXT            NOT NULL,
    action_plan         TEXT            NULL,
    committed_date      DATE            NULL,
    responder_id        UUID            NOT NULL,
    submitted_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_management_responses PRIMARY KEY (id),
    CONSTRAINT fk_management_responses_finding
        FOREIGN KEY (finding_id) REFERENCES audit_findings(id)
        ON DELETE RESTRICT
);


-- ── audit_evidence_requests ──────────────────────────────────────────────────

CREATE TABLE audit_evidence_requests (
    id              UUID                                NOT NULL DEFAULT gen_random_uuid(),
    audit_id        UUID                                NOT NULL,
    finding_id      UUID                                NULL,
    control_id      UUID                                NULL,
    title           VARCHAR(500)                        NOT NULL,
    description     TEXT                                NULL,
    status          global.evidence_request_status      NOT NULL DEFAULT 'open',
    requested_by    UUID                                NOT NULL,
    assigned_to     UUID                                NULL,
    due_date        DATE                                NULL,
    fulfilled_at    TIMESTAMPTZ                         NULL,
    created_at      TIMESTAMPTZ                         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ                         NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_audit_evidence_requests PRIMARY KEY (id),
    CONSTRAINT fk_audit_evidence_requests_audit
        FOREIGN KEY (audit_id) REFERENCES audit_engagements(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_audit_evidence_requests_finding
        FOREIGN KEY (finding_id) REFERENCES audit_findings(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_audit_evidence_requests_control
        FOREIGN KEY (control_id) REFERENCES controls(id)
        ON DELETE SET NULL
);


-- ── training_courses ─────────────────────────────────────────────────────────

CREATE TABLE training_courses (
    id                  UUID                            NOT NULL DEFAULT gen_random_uuid(),
    title               VARCHAR(500)                    NOT NULL,
    description         TEXT                            NOT NULL,
    content_type        global.training_content_type    NOT NULL DEFAULT 'pdf',
    storage_key         VARCHAR(1000)                   NULL,
    external_lms_id     VARCHAR(255)                    NULL,
    duration_minutes    INT                             NULL,
    is_mandatory        BOOLEAN                         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN                         NOT NULL DEFAULT TRUE,
    framework_ids       VARCHAR(50)[]                   NOT NULL DEFAULT '{}',
    target_roles        global.user_role[]              NOT NULL DEFAULT '{}',
    created_by          UUID                            NOT NULL,
    deleted_at          TIMESTAMPTZ                     NULL,
    created_at          TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_training_courses PRIMARY KEY (id),
    CONSTRAINT chk_training_courses_duration
        CHECK (duration_minutes IS NULL OR duration_minutes > 0)
);


-- ── training_assignments ─────────────────────────────────────────────────────

CREATE TABLE training_assignments (
    id          UUID                    NOT NULL DEFAULT gen_random_uuid(),
    course_id   UUID                    NOT NULL,
    user_id     UUID                    NOT NULL,
    due_date    DATE                    NULL,
    status      global.training_status  NOT NULL DEFAULT 'not_started',
    assigned_by UUID                    NOT NULL,
    created_at  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_training_assignments PRIMARY KEY (id),
    CONSTRAINT uq_training_assignments_course_user
        UNIQUE (course_id, user_id),
    CONSTRAINT fk_training_assignments_course
        FOREIGN KEY (course_id) REFERENCES training_courses(id)
        ON DELETE CASCADE
);


-- ── training_completions ─────────────────────────────────────────────────────

CREATE TABLE training_completions (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    assignment_id           UUID            NOT NULL,
    course_id               UUID            NOT NULL,
    user_id                 UUID            NOT NULL,
    score_percentage        INT             NULL,
    passed                  BOOLEAN         NOT NULL DEFAULT FALSE,
    certificate_storage_key VARCHAR(1000)   NULL,
    completed_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ     NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_training_completions PRIMARY KEY (id),
    CONSTRAINT fk_training_completions_assignment
        FOREIGN KEY (assignment_id) REFERENCES training_assignments(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_training_completions_course
        FOREIGN KEY (course_id) REFERENCES training_courses(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_training_score_range
        CHECK (score_percentage IS NULL OR score_percentage BETWEEN 0 AND 100)
);


-- ── incidents ────────────────────────────────────────────────────────────────

CREATE TABLE incidents (
    id                                  UUID                        NOT NULL DEFAULT gen_random_uuid(),
    title                               VARCHAR(500)                NOT NULL,
    incident_type                       global.incident_type        NOT NULL,
    severity                            global.incident_severity    NOT NULL DEFAULT 'medium',
    status                              global.incident_status      NOT NULL DEFAULT 'reported',
    description                         TEXT                        NOT NULL,
    affected_data_subjects              INT                         NOT NULL DEFAULT 0,
    affected_data_categories            VARCHAR(100)[]              NOT NULL DEFAULT '{}',
    root_cause                          TEXT                        NULL,
    remediation_summary                 TEXT                        NULL,
    reporter_id                         UUID                        NOT NULL,
    owner_id                            UUID                        NOT NULL,
    discovered_at                       TIMESTAMPTZ                 NOT NULL,
    contained_at                        TIMESTAMPTZ                 NULL,
    resolved_at                         TIMESTAMPTZ                 NULL,
    regulatory_notification_deadline    TIMESTAMPTZ                 NULL,
    regulatory_notification_required    BOOLEAN                     NOT NULL DEFAULT FALSE,
    deleted_at                          TIMESTAMPTZ                 NULL,
    created_by                          UUID                        NOT NULL,
    created_at                          TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    updated_at                          TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_incidents PRIMARY KEY (id),
    CONSTRAINT chk_incidents_affected_subjects
        CHECK (affected_data_subjects >= 0)
);


-- ── incident_actions ─────────────────────────────────────────────────────────

CREATE TABLE incident_actions (
    id          UUID                    NOT NULL DEFAULT gen_random_uuid(),
    incident_id UUID                    NOT NULL,
    title       VARCHAR(500)            NOT NULL,
    description TEXT                    NULL,
    status      global.finding_status   NOT NULL DEFAULT 'open',
    owner_id    UUID                    NOT NULL,
    due_date    DATE                    NULL,
    completed_at TIMESTAMPTZ            NULL,
    created_by  UUID                    NOT NULL,
    created_at  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_incident_actions PRIMARY KEY (id),
    CONSTRAINT fk_incident_actions_incident
        FOREIGN KEY (incident_id) REFERENCES incidents(id)
        ON DELETE CASCADE
);


-- ── breach_notifications ─────────────────────────────────────────────────────

CREATE TABLE breach_notifications (
    id                  UUID                                    NOT NULL DEFAULT gen_random_uuid(),
    incident_id         UUID                                    NOT NULL,
    notification_type   VARCHAR(50)                             NOT NULL DEFAULT 'regulator',
    recipient_type      global.notification_recipient_type      NOT NULL,
    recipient_name      VARCHAR(255)                            NOT NULL,
    recipient_email     VARCHAR(320)                            NULL,
    notification_body   TEXT                                    NOT NULL,
    status              global.notification_status              NOT NULL DEFAULT 'pending',
    sent_at             TIMESTAMPTZ                             NULL,
    sent_by             VARCHAR(255)                            NULL,
    created_at          TIMESTAMPTZ                             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_breach_notifications PRIMARY KEY (id),
    CONSTRAINT fk_breach_notifications_incident
        FOREIGN KEY (incident_id) REFERENCES incidents(id)
        ON DELETE RESTRICT
);


-- ── ropa_entries ─────────────────────────────────────────────────────────────

CREATE TABLE ropa_entries (
    id                              UUID                    NOT NULL DEFAULT gen_random_uuid(),
    processing_activity_name        VARCHAR(500)            NOT NULL,
    purpose                         TEXT                    NOT NULL,
    legal_basis                     global.legal_basis      NOT NULL,
    data_categories                 VARCHAR(100)[]          NOT NULL DEFAULT '{}',
    data_subject_categories         VARCHAR(100)[]          NOT NULL DEFAULT '{}',
    retention_periods               VARCHAR(255)[]          NOT NULL DEFAULT '{}',
    involves_international_transfer BOOLEAN                 NOT NULL DEFAULT FALSE,
    transfer_mechanisms             VARCHAR(100)[]          NOT NULL DEFAULT '{}',
    recipient_categories            VARCHAR(255)[]          NOT NULL DEFAULT '{}',
    requires_dpia                   BOOLEAN                 NOT NULL DEFAULT FALSE,
    status                          VARCHAR(30)             NOT NULL DEFAULT 'active',
    owner_id                        UUID                    NOT NULL,
    deleted_at                      TIMESTAMPTZ             NULL,
    created_by                      UUID                    NOT NULL,
    updated_by                      UUID                    NOT NULL,
    created_at                      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_ropa_entries PRIMARY KEY (id),
    CONSTRAINT chk_ropa_status
        CHECK (status IN ('active', 'under_review', 'archived'))
);


-- ── ropa_third_parties ───────────────────────────────────────────────────────

CREATE TABLE ropa_third_parties (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    ropa_entry_id   UUID            NOT NULL,
    vendor_id       UUID            NULL,   -- optionally links to vendors table
    party_name      VARCHAR(255)    NOT NULL,
    party_role      VARCHAR(100)    NOT NULL DEFAULT 'processor',
    data_shared     VARCHAR(100)[]  NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_ropa_third_parties PRIMARY KEY (id),
    CONSTRAINT fk_ropa_third_parties_ropa
        FOREIGN KEY (ropa_entry_id) REFERENCES ropa_entries(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_ropa_third_parties_vendor
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
        ON DELETE SET NULL,
    CONSTRAINT chk_ropa_party_role
        CHECK (party_role IN ('processor', 'controller', 'joint_controller', 'recipient', 'sub_processor'))
);


-- ── data_subject_requests ────────────────────────────────────────────────────

CREATE TABLE data_subject_requests (
    id                          UUID                NOT NULL DEFAULT gen_random_uuid(),
    request_ref                 VARCHAR(30)         NOT NULL,   -- e.g., 'DSAR-2027-001'
    request_type                global.dsar_type    NOT NULL,
    status                      global.dsar_status  NOT NULL DEFAULT 'received',
    requester_name              VARCHAR(255)        NOT NULL,
    requester_email             VARCHAR(320)        NOT NULL,
    request_description         TEXT                NULL,
    identity_verification_notes TEXT                NULL,
    identity_verified           BOOLEAN             NOT NULL DEFAULT FALSE,
    identity_verified_at        TIMESTAMPTZ         NULL,
    legal_deadline              DATE                NOT NULL,
    completed_at                TIMESTAMPTZ         NULL,
    rejected_at                 TIMESTAMPTZ         NULL,
    rejection_reason            TEXT                NULL,
    assigned_to                 UUID                NULL,
    created_by                  UUID                NOT NULL,
    created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_data_subject_requests PRIMARY KEY (id),
    CONSTRAINT uq_data_subject_requests_ref
        UNIQUE (request_ref)
);

CREATE UNIQUE INDEX uq_dsar_ref_active
    ON data_subject_requests(request_ref);


-- ── dsar_actions ─────────────────────────────────────────────────────────────

CREATE TABLE dsar_actions (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    dsar_id         UUID            NOT NULL,
    action_type     VARCHAR(100)    NOT NULL,
    notes           TEXT            NULL,
    performed_by    UUID            NOT NULL,
    performed_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_dsar_actions PRIMARY KEY (id),
    CONSTRAINT fk_dsar_actions_dsar
        FOREIGN KEY (dsar_id) REFERENCES data_subject_requests(id)
        ON DELETE CASCADE
);


-- ── dpia_assessments ─────────────────────────────────────────────────────────

CREATE TABLE dpia_assessments (
    id                          UUID                NOT NULL DEFAULT gen_random_uuid(),
    ropa_entry_id               UUID                NULL,
    title                       VARCHAR(500)        NOT NULL,
    description                 TEXT                NOT NULL,
    necessity_assessment        TEXT                NULL,
    proportionality_assessment  TEXT                NULL,
    status                      global.dpia_status  NOT NULL DEFAULT 'draft',
    overall_risk_score          INT                 NOT NULL DEFAULT 0,
    dpo_id                      UUID                NULL,
    dpo_approved_at             TIMESTAMPTZ         NULL,
    deleted_at                  TIMESTAMPTZ         NULL,
    created_by                  UUID                NOT NULL,
    created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_dpia_assessments PRIMARY KEY (id),
    CONSTRAINT fk_dpia_assessments_ropa
        FOREIGN KEY (ropa_entry_id) REFERENCES ropa_entries(id)
        ON DELETE SET NULL,
    CONSTRAINT chk_dpia_risk_score
        CHECK (overall_risk_score BETWEEN 0 AND 100)
);


-- ── dpia_risks ───────────────────────────────────────────────────────────────

CREATE TABLE dpia_risks (
    id                  UUID                NOT NULL DEFAULT gen_random_uuid(),
    dpia_id             UUID                NOT NULL,
    risk_description    TEXT                NOT NULL,
    likelihood          global.risk_level   NOT NULL,
    severity            global.risk_level   NOT NULL,
    mitigation_measure  TEXT                NOT NULL,
    residual_risk_level global.risk_level   NOT NULL,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_dpia_risks PRIMARY KEY (id),
    CONSTRAINT fk_dpia_risks_dpia
        FOREIGN KEY (dpia_id) REFERENCES dpia_assessments(id)
        ON DELETE CASCADE
);


-- ── consent_records ──────────────────────────────────────────────────────────

CREATE TABLE consent_records (
    id                          UUID            NOT NULL DEFAULT gen_random_uuid(),
    ropa_entry_id               UUID            NOT NULL,
    data_subject_identifier     VARCHAR(500)    NOT NULL,   -- hashed/pseudonymised identifier
    consent_text_version        TEXT            NOT NULL,
    consent_method              VARCHAR(50)     NOT NULL DEFAULT 'explicit',
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    consented_at                TIMESTAMPTZ     NOT NULL,
    withdrawn_at                TIMESTAMPTZ     NULL,
    ip_address                  INET            NULL,
    metadata                    JSONB           NOT NULL DEFAULT '{}',
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_consent_records PRIMARY KEY (id),
    CONSTRAINT fk_consent_records_ropa
        FOREIGN KEY (ropa_entry_id) REFERENCES ropa_entries(id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_consent_method
        CHECK (consent_method IN ('explicit', 'opt_in_form', 'double_opt_in', 'written', 'verbal'))
);


-- ── notification_preferences ─────────────────────────────────────────────────

CREATE TABLE notification_preferences (
    id                  UUID                            NOT NULL DEFAULT gen_random_uuid(),
    user_id             UUID                            NOT NULL,
    notification_type   VARCHAR(100)                    NOT NULL,
    email_enabled       BOOLEAN                         NOT NULL DEFAULT TRUE,
    in_app_enabled      BOOLEAN                         NOT NULL DEFAULT TRUE,
    webhook_enabled     BOOLEAN                         NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_notification_preferences PRIMARY KEY (id),
    CONSTRAINT uq_notification_preferences_user_type
        UNIQUE (user_id, notification_type)
);


-- ── notifications ────────────────────────────────────────────────────────────

CREATE TABLE notifications (
    id              UUID                            NOT NULL DEFAULT gen_random_uuid(),
    user_id         UUID                            NOT NULL,
    notification_type VARCHAR(100)                  NOT NULL,
    title           VARCHAR(500)                    NOT NULL,
    body            TEXT                            NULL,
    payload         JSONB                           NOT NULL DEFAULT '{}',
    status          global.notification_status      NOT NULL DEFAULT 'pending',
    channel         global.notification_channel     NOT NULL DEFAULT 'in_app',
    read_at         TIMESTAMPTZ                     NULL,
    sent_at         TIMESTAMPTZ                     NULL,
    failed_at       TIMESTAMPTZ                     NULL,
    failure_reason  TEXT                            NULL,
    created_at      TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_notifications PRIMARY KEY (id)
);


-- ── integration_configs ──────────────────────────────────────────────────────

CREATE TABLE integration_configs (
    id                  UUID                        NOT NULL DEFAULT gen_random_uuid(),
    integration_type    global.integration_type     NOT NULL,
    display_name        VARCHAR(255)                NOT NULL,
    is_active           BOOLEAN                     NOT NULL DEFAULT TRUE,
    config_encrypted    JSONB                       NOT NULL DEFAULT '{}',   -- AES-256 encrypted at app layer
    field_mappings      JSONB                       NOT NULL DEFAULT '{}',
    schedule_cron       VARCHAR(100)                NOT NULL DEFAULT '0 2 * * *',
    last_synced_at      TIMESTAMPTZ                 NULL,
    next_sync_at        TIMESTAMPTZ                 NULL,
    last_sync_status    global.run_status           NULL,
    created_by          UUID                        NOT NULL,
    deleted_at          TIMESTAMPTZ                 NULL,
    created_at          TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_integration_configs PRIMARY KEY (id)
);

CREATE UNIQUE INDEX uq_integration_configs_type_active
    ON integration_configs(integration_type) WHERE deleted_at IS NULL;


-- ── integration_runs ─────────────────────────────────────────────────────────

CREATE TABLE integration_runs (
    id                      UUID                NOT NULL DEFAULT gen_random_uuid(),
    integration_config_id   UUID                NULL,   -- SET NULL if config is deleted
    status                  global.run_status   NOT NULL DEFAULT 'queued',
    items_collected         INT                 NOT NULL DEFAULT 0,
    items_failed            INT                 NOT NULL DEFAULT 0,
    error_message           TEXT                NULL,
    run_metadata            JSONB               NOT NULL DEFAULT '{}',
    started_at              TIMESTAMPTZ         NULL,
    completed_at            TIMESTAMPTZ         NULL,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_integration_runs PRIMARY KEY (id),
    CONSTRAINT fk_integration_runs_config
        FOREIGN KEY (integration_config_id) REFERENCES integration_configs(id)
        ON DELETE SET NULL,
    CONSTRAINT chk_integration_runs_items
        CHECK (items_collected >= 0 AND items_failed >= 0)
);


-- ── integration_run_results ──────────────────────────────────────────────────

CREATE TABLE integration_run_results (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    run_id          UUID            NOT NULL,
    evidence_id     UUID            NULL,
    result_type     VARCHAR(30)     NOT NULL DEFAULT 'collected',
    raw_payload     JSONB           NULL,
    error_message   TEXT            NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_integration_run_results PRIMARY KEY (id),
    CONSTRAINT fk_integration_run_results_run
        FOREIGN KEY (run_id) REFERENCES integration_runs(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_integration_run_results_evidence
        FOREIGN KEY (evidence_id) REFERENCES evidence_items(id)
        ON DELETE SET NULL,
    CONSTRAINT chk_integration_result_type
        CHECK (result_type IN ('collected', 'skipped', 'failed', 'duplicate'))
);


-- ── compliance_score_snapshots ───────────────────────────────────────────────

CREATE TABLE compliance_score_snapshots (
    id                      UUID            NOT NULL DEFAULT gen_random_uuid(),
    framework_id            VARCHAR(50)     NOT NULL,
    total_controls          INT             NOT NULL DEFAULT 0,
    implemented_controls    INT             NOT NULL DEFAULT 0,
    failing_controls        INT             NOT NULL DEFAULT 0,
    not_applicable_controls INT             NOT NULL DEFAULT 0,
    not_started_controls    INT             NOT NULL DEFAULT 0,
    in_progress_controls    INT             NOT NULL DEFAULT 0,
    score                   NUMERIC(5,2)    NOT NULL DEFAULT 0,
    category_breakdown      JSONB           NOT NULL DEFAULT '{}',
    snapshot_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_compliance_score_snapshots PRIMARY KEY (id),
    CONSTRAINT chk_score_range
        CHECK (score >= 0 AND score <= 100),
    CONSTRAINT chk_score_counts_non_negative
        CHECK (
            total_controls >= 0
            AND implemented_controls >= 0
            AND failing_controls >= 0
            AND not_applicable_controls >= 0
            AND not_started_controls >= 0
            AND in_progress_controls >= 0
        )
) PARTITION BY RANGE (snapshot_at);

-- Initial partitions
CREATE TABLE compliance_score_snapshots_2027_q1
    PARTITION OF compliance_score_snapshots
    FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');

CREATE TABLE compliance_score_snapshots_2027_q2
    PARTITION OF compliance_score_snapshots
    FOR VALUES FROM ('2027-04-01') TO ('2027-07-01');


-- ── audit_log ────────────────────────────────────────────────────────────────

CREATE TABLE audit_log (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    user_id         UUID            NULL,
    user_email      VARCHAR(320)    NULL,
    user_role       VARCHAR(50)     NULL,
    action          VARCHAR(100)    NOT NULL,
    entity_type     VARCHAR(100)    NULL,
    entity_id       UUID            NULL,
    old_value       JSONB           NULL,
    new_value       JSONB           NULL,
    ip_address      INET            NULL,
    user_agent      VARCHAR(500)    NULL,
    request_id      VARCHAR(128)    NULL,
    hash_chain      VARCHAR(64)     NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_audit_log PRIMARY KEY (id)
    -- No FK constraints — denormalized for immutability
    -- Survives deletion of referenced users/entities
) PARTITION BY RANGE (created_at);

-- Create initial audit log partitions
CREATE TABLE audit_log_2027_01 PARTITION OF audit_log
    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE audit_log_2027_02 PARTITION OF audit_log
    FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE audit_log_2027_03 PARTITION OF audit_log
    FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

COMMENT ON TABLE audit_log IS
    'Immutable tamper-evident log of all data mutations within this tenant. UPDATE and DELETE are revoked.';
COMMENT ON COLUMN audit_log.hash_chain IS
    'SHA-256 of (previous_row.id || previous_row.created_at || previous_row.action || previous_row.hash_chain). Tamper detection.';


-- =============================================================================
-- SECTION 6: INDEXES (TENANT SCHEMA)
-- =============================================================================

-- ── Controls ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_controls_status
    ON controls(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_controls_review_due
    ON controls(next_review_date)
    WHERE deleted_at IS NULL AND status != 'not_applicable';

CREATE INDEX idx_controls_risk_score
    ON controls(risk_score DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_controls_created_at
    ON controls(created_at DESC);

CREATE INDEX idx_control_owners_control
    ON control_owners(control_id);

CREATE INDEX idx_control_owners_user
    ON control_owners(user_id);

CREATE INDEX idx_control_framework_links_framework
    ON control_framework_links(framework_control_id);

CREATE INDEX idx_control_framework_links_control
    ON control_framework_links(control_id);

CREATE INDEX idx_control_tests_control
    ON control_tests(control_id);

CREATE INDEX idx_control_tests_result
    ON control_tests(control_id, result, tested_at DESC);

-- ── Evidence ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_evidence_expires_at
    ON evidence_items(expires_at)
    WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

CREATE INDEX idx_evidence_source
    ON evidence_items(source);

CREATE INDEX idx_evidence_is_expired
    ON evidence_items(is_expired) WHERE deleted_at IS NULL;

CREATE INDEX idx_evidence_uploaded_by
    ON evidence_items(uploaded_by);

CREATE INDEX idx_control_evidence_control
    ON control_evidence(control_id);

CREATE INDEX idx_control_evidence_evidence
    ON control_evidence(evidence_id);

-- ── Policies ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_policies_status
    ON policies(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_policies_owner
    ON policies(owner_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_policies_review_due
    ON policies(review_due_date)
    WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX idx_policy_acks_policy_user
    ON policy_acknowledgments(policy_id, user_id);

CREATE INDEX idx_policy_acks_pending
    ON policy_acknowledgments(policy_id)
    WHERE acknowledged_at IS NULL;

CREATE INDEX idx_policy_acks_due
    ON policy_acknowledgments(due_at)
    WHERE acknowledged_at IS NULL;

CREATE INDEX idx_policy_versions_policy
    ON policy_versions(policy_id, version_number DESC);

CREATE INDEX idx_policy_approvals_version
    ON policy_approvals(policy_version_id);

CREATE INDEX idx_policy_approvals_approver_pending
    ON policy_approvals(approver_id)
    WHERE status = 'pending';

-- ── Risks ────────────────────────────────────────────────────────────────────

CREATE INDEX idx_risks_residual_score
    ON risks(residual_score DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_risks_status
    ON risks(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_risks_owner
    ON risks(owner_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_risks_category
    ON risks(category) WHERE deleted_at IS NULL;

CREATE INDEX idx_risk_control_links_risk
    ON risk_control_links(risk_id);

CREATE INDEX idx_risk_control_links_control
    ON risk_control_links(control_id);

-- ── Vendors ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_vendors_criticality
    ON vendors(criticality_tier) WHERE deleted_at IS NULL;

CREATE INDEX idx_vendors_risk_score
    ON vendors(risk_score DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_vendors_owner
    ON vendors(owner_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_vendors_renewal_date
    ON vendors(contract_renewal_date)
    WHERE deleted_at IS NULL AND contract_renewal_date IS NOT NULL;

CREATE INDEX idx_vendor_docs_expiry
    ON vendor_documents(valid_until)
    WHERE valid_until IS NOT NULL;

CREATE INDEX idx_vendor_assessments_vendor
    ON vendor_assessments(vendor_id);

CREATE INDEX idx_vendor_assessments_status
    ON vendor_assessments(status, due_at);

-- ── Audits ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_audit_engagements_status
    ON audit_engagements(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_audit_findings_audit
    ON audit_findings(audit_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_audit_findings_status
    ON audit_findings(status, target_remediation_date)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_audit_findings_owner
    ON audit_findings(owner_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_mgmt_responses_finding
    ON management_responses(finding_id);

CREATE INDEX idx_audit_evidence_requests_audit
    ON audit_evidence_requests(audit_id);

CREATE INDEX idx_audit_evidence_requests_assignee
    ON audit_evidence_requests(assigned_to)
    WHERE status = 'open';

-- ── Training ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_training_assignments_user
    ON training_assignments(user_id);

CREATE INDEX idx_training_assignments_course
    ON training_assignments(course_id);

CREATE INDEX idx_training_assignments_overdue
    ON training_assignments(due_date)
    WHERE status IN ('not_started', 'in_progress') AND due_date IS NOT NULL;

CREATE INDEX idx_training_completions_user
    ON training_completions(user_id);

CREATE INDEX idx_training_completions_expires
    ON training_completions(expires_at)
    WHERE expires_at IS NOT NULL;

-- ── Incidents ────────────────────────────────────────────────────────────────

CREATE INDEX idx_incidents_status
    ON incidents(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_incidents_severity
    ON incidents(severity) WHERE deleted_at IS NULL;

CREATE INDEX idx_incidents_reg_deadline
    ON incidents(regulatory_notification_deadline)
    WHERE regulatory_notification_required = TRUE
      AND status NOT IN ('resolved', 'closed');

CREATE INDEX idx_incident_actions_incident
    ON incident_actions(incident_id);

CREATE INDEX idx_incident_actions_owner
    ON incident_actions(owner_id)
    WHERE status = 'open';

-- ── Privacy ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_ropa_entries_owner
    ON ropa_entries(owner_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_ropa_entries_legal_basis
    ON ropa_entries(legal_basis) WHERE deleted_at IS NULL;

CREATE INDEX idx_dsar_deadline
    ON data_subject_requests(legal_deadline)
    WHERE status NOT IN ('completed', 'rejected');

CREATE INDEX idx_dsar_status
    ON data_subject_requests(status);

CREATE INDEX idx_dsar_actions_dsar
    ON dsar_actions(dsar_id);

CREATE INDEX idx_dpia_assessments_ropa
    ON dpia_assessments(ropa_entry_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_dpia_assessments_status
    ON dpia_assessments(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_consent_records_ropa
    ON consent_records(ropa_entry_id);

CREATE INDEX idx_consent_records_subject
    ON consent_records(data_subject_identifier);

CREATE INDEX idx_consent_records_active
    ON consent_records(ropa_entry_id)
    WHERE is_active = TRUE;

-- ── Notifications ────────────────────────────────────────────────────────────

CREATE INDEX idx_notifications_user_unread
    ON notifications(user_id, created_at DESC)
    WHERE status NOT IN ('read', 'failed');

CREATE INDEX idx_notifications_pending
    ON notifications(status, created_at)
    WHERE status = 'pending';

-- ── Integrations ─────────────────────────────────────────────────────────────

CREATE INDEX idx_integration_configs_active
    ON integration_configs(is_active) WHERE deleted_at IS NULL;

CREATE INDEX idx_integration_configs_next_sync
    ON integration_configs(next_sync_at)
    WHERE is_active = TRUE AND deleted_at IS NULL;

CREATE INDEX idx_integration_runs_config
    ON integration_runs(integration_config_id, created_at DESC);

CREATE INDEX idx_integration_runs_status
    ON integration_runs(status, created_at DESC);

-- ── Compliance Score Snapshots ────────────────────────────────────────────────

CREATE INDEX idx_score_snapshots_framework_time
    ON compliance_score_snapshots(framework_id, snapshot_at DESC);

-- ── Audit Log ────────────────────────────────────────────────────────────────

CREATE INDEX idx_audit_log_user_time
    ON audit_log USING BRIN (created_at);   -- BRIN for append-only time-series

CREATE INDEX idx_audit_log_user_created
    ON audit_log(user_id, created_at DESC);

CREATE INDEX idx_audit_log_entity
    ON audit_log(entity_type, entity_id, created_at DESC);

-- ── Framework Data Indexes ────────────────────────────────────────────────────

CREATE INDEX idx_framework_controls_framework
    ON framework_data.framework_controls(framework_id);

CREATE INDEX idx_framework_controls_category
    ON framework_data.framework_controls(category_id);

CREATE INDEX idx_framework_controls_active
    ON framework_data.framework_controls(framework_id, is_active);

CREATE INDEX idx_ucf_mappings_source
    ON framework_data.ucf_mappings(source_control_id);

CREATE INDEX idx_ucf_mappings_target
    ON framework_data.ucf_mappings(target_control_id);

-- Full-text search index on framework controls
CREATE INDEX idx_framework_controls_fts
    ON framework_data.framework_controls
    USING GIN (to_tsvector('english', title || ' ' || description));

-- ── Global Schema Indexes ─────────────────────────────────────────────────────

CREATE INDEX idx_tenants_status
    ON global.tenants(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_tenants_tier
    ON global.tenants(tier) WHERE deleted_at IS NULL;

CREATE INDEX idx_tenant_memberships_user
    ON global.tenant_memberships(user_id);

CREATE INDEX idx_tenant_memberships_tenant
    ON global.tenant_memberships(tenant_id);

CREATE INDEX idx_sessions_user
    ON global.sessions(user_id, expires_at);

CREATE INDEX idx_sessions_expires
    ON global.sessions(expires_at);

CREATE INDEX idx_refresh_tokens_session
    ON global.refresh_tokens(session_id);

CREATE INDEX idx_portal_invitations_tenant
    ON global.portal_invitations(tenant_id);

CREATE INDEX idx_portal_invitations_expires
    ON global.portal_invitations(expires_at)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- Global audit log: BRIN on append-only time-ordered table
CREATE INDEX idx_global_audit_log_brin
    ON global.global_audit_log USING BRIN (created_at);

CREATE INDEX idx_global_audit_log_tenant
    ON global.global_audit_log(tenant_id, created_at DESC)
    WHERE tenant_id IS NOT NULL;


-- =============================================================================
-- SECTION 7: FUNCTIONS
-- =============================================================================

-- ── fn_set_updated_at: auto-update updated_at on every UPDATE ────────────────

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_set_updated_at IS
    'Trigger function: sets updated_at = NOW() before every UPDATE operation.';


-- ── fn_write_audit_log: capture mutations in the tenant audit_log ─────────────

CREATE OR REPLACE FUNCTION fn_write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id       UUID;
    v_user_email    TEXT;
    v_user_role     TEXT;
    v_action        TEXT;
    v_old           JSONB;
    v_new           JSONB;
    v_prev_hash     VARCHAR(64);
    v_hash          VARCHAR(64);
BEGIN
    -- Read context variables set by the application layer per transaction
    v_user_id    := current_setting('app.current_user_id', TRUE)::UUID;
    v_user_email := current_setting('app.current_user_email', TRUE);
    v_user_role  := current_setting('app.current_user_role', TRUE);

    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
        v_old    := NULL;
        v_new    := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        -- Detect soft-delete
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            v_action := 'soft_delete';
        ELSE
            v_action := 'update';
        END IF;
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'hard_delete';
        v_old    := to_jsonb(OLD);
        v_new    := NULL;
    END IF;

    -- Get the previous hash for chain integrity
    SELECT hash_chain INTO v_prev_hash
    FROM audit_log
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_prev_hash IS NULL THEN
        v_prev_hash := 'genesis';
    END IF;

    -- Compute hash chain
    v_hash := encode(
        digest(
            COALESCE(v_prev_hash, '') ||
            v_action ||
            TG_TABLE_NAME ||
            COALESCE(CAST(COALESCE(NEW.id, OLD.id) AS TEXT), ''),
            'sha256'
        ),
        'hex'
    );

    INSERT INTO audit_log (
        user_id, user_email, user_role,
        action, entity_type, entity_id,
        old_value, new_value,
        ip_address, user_agent, request_id,
        hash_chain
    ) VALUES (
        v_user_id,
        v_user_email,
        v_user_role,
        v_action,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        v_old,
        v_new,
        current_setting('app.current_ip', TRUE)::INET,
        current_setting('app.current_user_agent', TRUE),
        current_setting('app.current_request_id', TRUE),
        v_hash
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION fn_write_audit_log IS
    'Trigger function: writes a tamper-evident, hash-chained audit log entry for every table mutation.';


-- ── fn_refresh_evidence_expiry: mark expired evidence ────────────────────────

CREATE OR REPLACE FUNCTION fn_refresh_evidence_expiry()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE evidence_items
    SET is_expired = TRUE, updated_at = NOW()
    WHERE expires_at < CURRENT_DATE
      AND is_expired = FALSE
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION fn_refresh_evidence_expiry IS
    'Marks evidence items past their expiry date. Called nightly by the scheduler.';


-- ── fn_calculate_compliance_score: compute and snapshot score ─────────────────

CREATE OR REPLACE FUNCTION fn_calculate_compliance_score(p_framework_id VARCHAR)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
    v_total             INT;
    v_implemented       INT;
    v_failing           INT;
    v_not_applicable    INT;
    v_not_started       INT;
    v_in_progress       INT;
    v_score             NUMERIC(5,2);
    v_category_breakdown JSONB;
BEGIN
    SELECT
        COUNT(*)                                                        AS total,
        COUNT(*) FILTER (WHERE c.status = 'implemented')               AS implemented,
        COUNT(*) FILTER (WHERE c.status = 'failing')                   AS failing,
        COUNT(*) FILTER (WHERE c.status = 'not_applicable')            AS not_applicable,
        COUNT(*) FILTER (WHERE c.status = 'not_started')               AS not_started,
        COUNT(*) FILTER (WHERE c.status = 'in_progress')               AS in_progress
    INTO v_total, v_implemented, v_failing, v_not_applicable, v_not_started, v_in_progress
    FROM controls c
    INNER JOIN control_framework_links cfl ON cfl.control_id = c.id
    INNER JOIN framework_data.framework_controls fc ON fc.id = cfl.framework_control_id
    WHERE fc.framework_id = (
        SELECT id FROM framework_data.frameworks WHERE code = p_framework_id
    )
    AND c.deleted_at IS NULL;

    -- Score = implemented / (total - not_applicable) * 100
    -- Not-applicable controls do not penalise or benefit the score
    IF (v_total - v_not_applicable) = 0 THEN
        v_score := 0;
    ELSE
        v_score := ROUND(
            (v_implemented::NUMERIC / (v_total - v_not_applicable)::NUMERIC) * 100,
            2
        );
    END IF;

    INSERT INTO compliance_score_snapshots (
        framework_id,
        total_controls,
        implemented_controls,
        failing_controls,
        not_applicable_controls,
        not_started_controls,
        in_progress_controls,
        score,
        category_breakdown,
        snapshot_at
    ) VALUES (
        p_framework_id,
        v_total,
        v_implemented,
        v_failing,
        v_not_applicable,
        v_not_started,
        v_in_progress,
        v_score,
        '{}',
        NOW()
    );

    RETURN v_score;
END;
$$;

COMMENT ON FUNCTION fn_calculate_compliance_score IS
    'Calculates and snapshots the compliance score for a given framework. Called after control status changes.';


-- ── fn_provision_tenant_schema: provision a new tenant schema ─────────────────

CREATE OR REPLACE FUNCTION global.fn_provision_tenant_schema(
    p_tenant_id     UUID,
    p_schema_name   TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validate schema name format: tenant_ followed by UUID without dashes
    IF p_schema_name !~ '^tenant_[a-f0-9]{32}$' THEN
        RAISE EXCEPTION 'Invalid schema name format: %', p_schema_name;
    END IF;

    -- Create schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_schema_name);

    -- Update tenant record
    UPDATE global.tenants
    SET schema_name = p_schema_name
    WHERE id = p_tenant_id;

    -- Log the provisioning event
    INSERT INTO global.global_audit_log (
        action, entity_type, entity_id, new_value
    ) VALUES (
        'schema_provisioned',
        'tenant',
        p_tenant_id,
        jsonb_build_object('schema_name', p_schema_name)
    );

    RETURN TRUE;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Schema provisioning failed for tenant %: %', p_tenant_id, SQLERRM;
    RETURN FALSE;
END;
$$;


-- =============================================================================
-- SECTION 8: TRIGGERS (applied to tenant template schema tables)
-- =============================================================================

-- updated_at trigger on all mutable tenant tables

CREATE TRIGGER trg_controls_updated_at
    BEFORE UPDATE ON controls
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_evidence_items_updated_at
    BEFORE UPDATE ON evidence_items
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_policies_updated_at
    BEFORE UPDATE ON policies
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_policy_versions_updated_at
    BEFORE UPDATE ON policy_versions
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_policy_approvals_updated_at
    BEFORE UPDATE ON policy_approvals
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_risks_updated_at
    BEFORE UPDATE ON risks
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_risk_treatment_plans_updated_at
    BEFORE UPDATE ON risk_treatment_plans
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_vendors_updated_at
    BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_vendor_contacts_updated_at
    BEFORE UPDATE ON vendor_contacts
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_vendor_assessments_updated_at
    BEFORE UPDATE ON vendor_assessments
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_vendor_questionnaire_updated_at
    BEFORE UPDATE ON vendor_questionnaire_responses
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_audit_engagements_updated_at
    BEFORE UPDATE ON audit_engagements
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_audit_findings_updated_at
    BEFORE UPDATE ON audit_findings
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_management_responses_updated_at
    BEFORE UPDATE ON management_responses
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_audit_evidence_requests_updated_at
    BEFORE UPDATE ON audit_evidence_requests
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_training_courses_updated_at
    BEFORE UPDATE ON training_courses
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_training_assignments_updated_at
    BEFORE UPDATE ON training_assignments
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_incident_actions_updated_at
    BEFORE UPDATE ON incident_actions
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_ropa_entries_updated_at
    BEFORE UPDATE ON ropa_entries
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_data_subject_requests_updated_at
    BEFORE UPDATE ON data_subject_requests
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_dpia_assessments_updated_at
    BEFORE UPDATE ON dpia_assessments
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_dpia_risks_updated_at
    BEFORE UPDATE ON dpia_risks
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_integration_configs_updated_at
    BEFORE UPDATE ON integration_configs
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Audit log triggers on key tables (INSERT, UPDATE, DELETE)

CREATE TRIGGER trg_controls_audit
    AFTER INSERT OR UPDATE OR DELETE ON controls
    FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_evidence_items_audit
    AFTER INSERT OR UPDATE OR DELETE ON evidence_items
    FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_policies_audit
    AFTER INSERT OR UPDATE OR DELETE ON policies
    FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_policy_acknowledgments_audit
    AFTER INSERT OR UPDATE ON policy_acknowledgments
    FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_risks_audit
    AFTER INSERT OR UPDATE OR DELETE ON risks
    FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_vendors_audit
    AFTER INSERT OR UPDATE OR DELETE ON vendors
    FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_audit_findings_audit
    AFTER INSERT OR UPDATE OR DELETE ON audit_findings
    FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_incidents_audit
    AFTER INSERT OR UPDATE OR DELETE ON incidents
    FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_data_subject_requests_audit
    AFTER INSERT OR UPDATE ON data_subject_requests
    FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

CREATE TRIGGER trg_integration_configs_audit
    AFTER INSERT OR UPDATE OR DELETE ON integration_configs
    FOR EACH ROW EXECUTE FUNCTION fn_write_audit_log();

-- Global schema updated_at triggers

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON global.tenants
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON global.users
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_tenant_memberships_updated_at
    BEFORE UPDATE ON global.tenant_memberships
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON global.subscriptions
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_sso_configurations_updated_at
    BEFORE UPDATE ON global.sso_configurations
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_mfa_credentials_updated_at
    BEFORE UPDATE ON global.mfa_credentials
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- =============================================================================
-- SECTION 9: SECURITY — REVOKE DANGEROUS PRIVILEGES ON AUDIT TABLES
-- =============================================================================

-- The application role (compliancecore_app) must not be able to UPDATE or
-- DELETE from audit tables. These statements are applied after the app role
-- is created.

-- REVOKE UPDATE, DELETE ON audit_log FROM compliancecore_app;
-- REVOKE UPDATE, DELETE ON global.global_audit_log FROM compliancecore_app;
-- REVOKE UPDATE, DELETE ON global.global_audit_log_2027_01 FROM compliancecore_app;
-- (Applied per partition as new partitions are created)

-- Row-Level Security (enabled per table — policy defined per tenant)
-- ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
-- [... applied to all tenant tables during provisioning ...]

-- =============================================================================
-- END OF SCHEMA
-- Version: 1.0 | Author: ORION SOFT LIMITED | June 2026
-- =============================================================================
