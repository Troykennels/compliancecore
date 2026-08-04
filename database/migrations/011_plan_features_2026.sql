-- =============================================================================
-- Migration 011 — Plan feature allocation
-- ComplianceCore | ORION SOFT LIMITED
--
-- DATA ONLY. No table, column, constraint or index is created, altered or
-- dropped. Nothing here touches permissions, entitlement evaluation, payment
-- handling or multi-tenancy — it sets what each plan advertises and the seat,
-- framework and storage allowances it carries.
--
-- Every limit below is the same or HIGHER than what it replaces, so no existing
-- customer can be pushed over a cap by this change.
--
--   Starter        3 ->   5 users,  2 ->  3 frameworks,   1 ->   5 GB
--   Professional  15 ->  25 users,  5 -> 10 frameworks,  10 ->  50 GB
--   Business      50 -> 100 users,   unlimited frameworks, 50 -> 250 GB
--   Enterprise / MSP        unlimited, unchanged
-- =============================================================================

UPDATE global.subscription_plans
   SET max_users       = 5,
       max_frameworks  = 3,
       max_evidence_gb = 5,
       features = '[
         "5 team members",
         "3 compliance frameworks",
         "5 GB evidence storage",
         "Compliance dashboard",
         "Compliance calendar",
         "Tasks",
         "Expiry tracker",
         "Basic audit trail",
         "Email notifications"
       ]'::jsonb,
       updated_at = NOW()
 WHERE slug = 'starter';

UPDATE global.subscription_plans
   SET max_users       = 25,
       max_frameworks  = 10,
       max_evidence_gb = 50,
       features = '[
         "25 team members",
         "10 compliance frameworks",
         "50 GB evidence storage",
         "Everything in Starter",
         "Risk register",
         "Vendor management",
         "Evidence hub",
         "Incident management",
         "AI assistant",
         "Scheduled reports",
         "Approval workflows",
         "Digital signatures",
         "Executive dashboard",
         "Analytics"
       ]'::jsonb,
       updated_at = NOW()
 WHERE slug = 'professional';

-- Business advertises multi-location, so branches and departments become
-- unlimited to match. Advertising a capability and then capping it at fifteen
-- is the kind of mismatch a customer only discovers after paying.
UPDATE global.subscription_plans
   SET max_users        = 100,
       max_frameworks   = NULL,
       max_evidence_gb  = 250,
       max_branches     = NULL,
       max_departments  = NULL,
       features = '[
         "100 team members",
         "Unlimited compliance frameworks",
         "250 GB evidence storage",
         "Everything in Professional",
         "Departments",
         "Branches",
         "Multi-location support",
         "Advanced analytics",
         "API access",
         "Priority support",
         "Executive reporting",
         "AI assistant",
         "Vendor portal",
         "Risk management",
         "Workflow automation"
       ]'::jsonb,
       updated_at = NOW()
 WHERE slug = 'business';

UPDATE global.subscription_plans
   SET max_users       = NULL,
       max_frameworks  = NULL,
       max_evidence_gb = NULL,
       max_branches    = NULL,
       max_departments = NULL,
       features = '[
         "Unlimited users",
         "Unlimited compliance frameworks",
         "Unlimited evidence storage",
         "Everything in Business",
         "Single sign-on (SSO)",
         "SCIM user provisioning",
         "Dedicated support",
         "Full API access",
         "White-label branding",
         "Dedicated customer success manager",
         "Custom deployment"
       ]'::jsonb,
       updated_at = NOW()
 WHERE slug = 'enterprise';

UPDATE global.subscription_plans
   SET max_users       = NULL,
       max_frameworks  = NULL,
       max_evidence_gb = NULL,
       max_branches    = NULL,
       max_departments = NULL,
       features = '[
         "Unlimited client organisations",
         "White-label client portal",
         "Multi-client dashboard",
         "Bulk client onboarding",
         "Tenant management",
         "Client billing",
         "Client reporting",
         "Everything in Enterprise"
       ]'::jsonb,
       updated_at = NOW()
 WHERE slug = 'msp';
