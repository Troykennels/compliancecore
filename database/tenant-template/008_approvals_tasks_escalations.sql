-- Migration 008: Approval Workflows, Digital Signatures, Tasks, Escalation Rules, Notification Extensions
-- Applied per-tenant ({{SCHEMA}} is replaced at runtime with the tenant schema name)

SET search_path = {{SCHEMA}};

-- ============================================================
-- APPROVAL WORKFLOWS (TEMPLATES)
-- ============================================================
CREATE TABLE approval_workflows (
    id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    name          VARCHAR(500) NOT NULL,
    description   TEXT,
    entity_type   VARCHAR(100) NOT NULL, -- 'evidence' | 'policy' | 'control' | 'risk' | 'vendor' | 'any'
    is_active     BOOLEAN      DEFAULT TRUE,
    created_by    UUID         REFERENCES global.users(id),
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_approval_workflows_entity_type ON approval_workflows(entity_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_approval_workflows_active      ON approval_workflows(is_active)   WHERE deleted_at IS NULL;

-- Steps within workflow templates
CREATE TABLE approval_workflow_steps (
    id                  UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id         UUID         NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    step_order          INTEGER      NOT NULL,
    name                VARCHAR(500) NOT NULL,
    -- approver_type: 'user' | 'role' | 'manager' | 'any_from_list'
    approver_type       VARCHAR(50)  NOT NULL DEFAULT 'user',
    approver_id         UUID         REFERENCES global.users(id),
    approver_role       VARCHAR(100),
    approver_user_list  UUID[]       DEFAULT '{}',
    min_approvals       INTEGER      DEFAULT 1,
    deadline_hours      INTEGER,          -- hours from step activation before escalation
    allow_self_approval BOOLEAN      DEFAULT FALSE,
    require_signature   BOOLEAN      DEFAULT FALSE,
    instructions        TEXT,
    created_at          TIMESTAMPTZ  DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE(workflow_id, step_order)
);

-- ============================================================
-- APPROVAL REQUESTS (INSTANCES)
-- ============================================================
CREATE TABLE approval_requests (
    id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id      UUID         REFERENCES approval_workflows(id),
    title            VARCHAR(500) NOT NULL,
    description      TEXT,
    entity_type      VARCHAR(100) NOT NULL,
    entity_id        UUID,
    -- status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'withdrawn' | 'changes_requested'
    status           VARCHAR(50)  DEFAULT 'pending',
    -- priority: 'critical' | 'high' | 'medium' | 'low'
    priority         VARCHAR(20)  DEFAULT 'medium',
    current_step     INTEGER      DEFAULT 1,
    total_steps      INTEGER      DEFAULT 1,
    requested_by     UUID         NOT NULL REFERENCES global.users(id),
    deadline         TIMESTAMPTZ,
    submitted_at     TIMESTAMPTZ  DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,
    rejection_reason TEXT,
    metadata         JSONB        DEFAULT '{}',
    created_at       TIMESTAMPTZ  DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_approval_requests_status      ON approval_requests(status)       WHERE deleted_at IS NULL;
CREATE INDEX idx_approval_requests_requested_by ON approval_requests(requested_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_approval_requests_entity       ON approval_requests(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_approval_requests_created_at  ON approval_requests(created_at DESC) WHERE deleted_at IS NULL;

-- Step instances for each approval request
CREATE TABLE approval_request_steps (
    id                   UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id           UUID         NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    workflow_step_id     UUID         REFERENCES approval_workflow_steps(id),
    step_order           INTEGER      NOT NULL,
    name                 VARCHAR(500) NOT NULL,
    -- status: 'pending' | 'active' | 'approved' | 'rejected' | 'skipped' | 'changes_requested'
    status               VARCHAR(50)  DEFAULT 'pending',
    approver_type        VARCHAR(50)  NOT NULL DEFAULT 'user',
    assigned_to          UUID         REFERENCES global.users(id),
    assigned_role        VARCHAR(100),
    decided_by           UUID         REFERENCES global.users(id),
    -- decision: 'approved' | 'rejected' | 'changes_requested' | 'abstained'
    decision             VARCHAR(50),
    comments             TEXT,
    digital_signature_id UUID,         -- FK added after digital_signatures table created
    require_signature    BOOLEAN      DEFAULT FALSE,
    instructions         TEXT,
    activated_at         TIMESTAMPTZ,
    decided_at           TIMESTAMPTZ,
    deadline             TIMESTAMPTZ,
    created_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_request_steps_request_id  ON approval_request_steps(request_id);
CREATE INDEX idx_request_steps_assigned_to ON approval_request_steps(assigned_to) WHERE status = 'active';
CREATE INDEX idx_request_steps_status      ON approval_request_steps(status);

-- ============================================================
-- DIGITAL SIGNATURES
-- ============================================================
CREATE TABLE digital_signatures (
    id                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id           UUID         NOT NULL REFERENCES global.users(id),
    document_type     VARCHAR(100) NOT NULL, -- 'approval_step' | 'policy' | 'contract' | 'report' | 'evidence'
    document_id       UUID         NOT NULL,
    document_hash     VARCHAR(64)  NOT NULL, -- SHA-256 of document content at time of signing
    signature_hash    VARCHAR(128) NOT NULL UNIQUE, -- HMAC-SHA256 of (doc_hash + user_id + signed_at + secret)
    signature_image   TEXT,        -- base64 PNG of drawn signature (optional)
    certificate_data  JSONB        NOT NULL DEFAULT '{}',
    -- certificate_data: { signer_name, signer_email, signed_at, ip_address, user_agent, algorithm, version, tenant_id }
    ip_address        INET,
    user_agent        TEXT,
    signed_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    is_valid          BOOLEAN      DEFAULT TRUE,
    revoked_at        TIMESTAMPTZ,
    revoked_by        UUID         REFERENCES global.users(id),
    revocation_reason TEXT,
    created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_signatures_document    ON digital_signatures(document_type, document_id);
CREATE INDEX idx_signatures_user_id     ON digital_signatures(user_id);
CREATE INDEX idx_signatures_signed_at   ON digital_signatures(signed_at DESC);
CREATE INDEX idx_signatures_valid       ON digital_signatures(is_valid) WHERE is_valid = TRUE;

-- At most one *valid* signature per (document, signer). Backstops the
-- application-level duplicate guard against races/double-submits.
CREATE UNIQUE INDEX uq_signatures_valid_per_signer
  ON digital_signatures(document_type, document_id, user_id) WHERE is_valid = TRUE;

-- Back-reference: add FK from approval_request_steps to digital_signatures
ALTER TABLE approval_request_steps
    ADD CONSTRAINT fk_step_signature FOREIGN KEY (digital_signature_id) REFERENCES digital_signatures(id);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
    id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    title           VARCHAR(1000) NOT NULL,
    description     TEXT,
    assigned_to     UUID         REFERENCES global.users(id),
    assigned_by     UUID         REFERENCES global.users(id),
    due_date        TIMESTAMPTZ,
    -- priority: 'critical' | 'high' | 'medium' | 'low'
    priority        VARCHAR(20)  DEFAULT 'medium',
    -- status: 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled' | 'blocked'
    status          VARCHAR(50)  DEFAULT 'todo',
    entity_type     VARCHAR(100),
    entity_id       UUID,
    framework_id    UUID,
    parent_task_id  UUID         REFERENCES tasks(id),
    estimated_hours NUMERIC(6,2),
    actual_hours    NUMERIC(6,2),
    tags            TEXT[]       DEFAULT '{}',
    is_recurring    BOOLEAN      DEFAULT FALSE,
    recurrence_rule VARCHAR(200),     -- cron expression
    completed_at    TIMESTAMPTZ,
    created_by      UUID         REFERENCES global.users(id),
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_tasks_assigned_to  ON tasks(assigned_to)  WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_status       ON tasks(status)        WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_priority     ON tasks(priority)      WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_due_date     ON tasks(due_date)      WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_entity       ON tasks(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_parent       ON tasks(parent_task_id)         WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_created_at   ON tasks(created_at DESC)        WHERE deleted_at IS NULL;

-- Task comments
CREATE TABLE task_comments (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id     UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES global.users(id),
    body        TEXT        NOT NULL,
    is_internal BOOLEAN     DEFAULT FALSE,
    edited_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_task_comments_task_id ON task_comments(task_id, created_at) WHERE deleted_at IS NULL;

-- Task attachments (link to evidence)
CREATE TABLE task_attachments (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id     UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    evidence_id UUID        NOT NULL,
    attached_by UUID        REFERENCES global.users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ESCALATION RULES + EVENTS
-- ============================================================
CREATE TABLE escalation_rules (
    id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    name             VARCHAR(500) NOT NULL,
    description      TEXT,
    -- trigger_type: 'task_overdue' | 'approval_pending' | 'control_overdue' | 'expiry_approaching' | 'risk_unmitigated' | 'signature_missing'
    trigger_type     VARCHAR(100) NOT NULL,
    entity_type      VARCHAR(100),   -- filter to entity type (null = applies to all)
    -- conditions: {days_overdue: 3, priority: ["high","critical"], status: "todo"}
    conditions       JSONB        NOT NULL DEFAULT '{}',
    -- escalation_chain: [{delay_hours: 0, action: "notify", target_type: "assignee", target_id: null, message: "..."}, ...]
    -- action types: 'notify' | 'notify_manager' | 'notify_role' | 'reassign' | 'create_task' | 'cancel_request'
    -- target_type:  'assignee' | 'requester' | 'user' | 'role' | 'manager'
    escalation_chain JSONB        NOT NULL DEFAULT '[]',
    is_active        BOOLEAN      DEFAULT TRUE,
    created_by       UUID         REFERENCES global.users(id),
    created_at       TIMESTAMPTZ  DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_escalation_rules_trigger  ON escalation_rules(trigger_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_escalation_rules_active   ON escalation_rules(is_active)    WHERE deleted_at IS NULL;

CREATE TABLE escalation_events (
    id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_id             UUID        NOT NULL REFERENCES escalation_rules(id),
    entity_type         VARCHAR(100) NOT NULL,
    entity_id           UUID        NOT NULL,
    triggered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_chain_step  INTEGER     DEFAULT 0,
    -- status: 'active' | 'resolved' | 'cancelled' | 'completed'
    status              VARCHAR(50) DEFAULT 'active',
    next_escalation_at  TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    metadata            JSONB       DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(rule_id, entity_type, entity_id, status)
);

CREATE INDEX idx_escalation_events_status          ON escalation_events(status);
CREATE INDEX idx_escalation_events_next_at         ON escalation_events(next_escalation_at) WHERE status = 'active';
CREATE INDEX idx_escalation_events_entity          ON escalation_events(entity_type, entity_id);

-- ============================================================
-- NOTIFICATION EXTENSIONS
-- ============================================================

-- Per-user per-type notification channel preferences
CREATE TABLE notification_preferences (
    id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id           UUID        NOT NULL REFERENCES global.users(id),
    notification_type VARCHAR(100) NOT NULL,
    in_app            BOOLEAN     DEFAULT TRUE,
    email             BOOLEAN     DEFAULT TRUE,
    slack             BOOLEAN     DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, notification_type)
);

-- Delivery log for email/slack/webhook notifications
CREATE TABLE notification_delivery_log (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id UUID        REFERENCES notifications(id),
    channel         VARCHAR(50) NOT NULL,  -- 'email' | 'slack' | 'webhook'
    recipient       VARCHAR(500) NOT NULL,
    status          VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'sent' | 'failed' | 'bounced'
    sent_at         TIMESTAMPTZ,
    error_message   TEXT,
    retry_count     INTEGER     DEFAULT 0,
    message_id      VARCHAR(500), -- provider message ID for tracking
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_log_notification ON notification_delivery_log(notification_id);
CREATE INDEX idx_delivery_log_status       ON notification_delivery_log(status);
CREATE INDEX idx_delivery_log_channel      ON notification_delivery_log(channel);
