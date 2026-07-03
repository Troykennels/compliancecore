export const PATHS = {
  // Public auth
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',

  // Onboarding
  ONBOARDING: '/onboarding',

  // Core app
  DASHBOARD: '/dashboard',
  FRAMEWORKS: '/frameworks',
  CONTROLS: '/controls',
  CONTROL_DETAIL: (id: string) => `/controls/${id}`,
  EVIDENCE: '/evidence',
  EVIDENCE_DETAIL: (id: string) => `/evidence/${id}`,
  EVIDENCE_SHARED: (token: string) => `/evidence/shared/${token}`,
  POLICIES: '/policies',
  POLICY_DETAIL: (id: string) => `/policies/${id}`,
  RISKS: '/risks',
  VENDORS: '/vendors',
  VENDOR_DETAIL: (id: string) => `/vendors/${id}`,
  AUDITS: '/audits',
  AUDIT_DETAIL: (id: string) => `/audits/${id}`,
  TRAINING: '/training',
  INCIDENTS: '/incidents',
  PRIVACY_ROPA: '/privacy/ropa',
  PRIVACY_DSAR: '/privacy/dsar',
  PRIVACY_DPIA: '/privacy/dpia',
  ANALYTICS: '/analytics',
  INTEGRATIONS: '/integrations',
  MSP_PORTFOLIO: '/msp/portfolio',

  // Compliance modules (Phase 9)
  CALENDAR: '/calendar',
  EXPIRY: '/expiry',
  NOTIFICATIONS: '/notifications',
  COMPLIANCE_SCORE: '/compliance-score',

  // AI Tools (Phase 11)
  AI_TOOLS: '/ai-tools',

  // Reports / Executive Dashboard (Phase 12)
  REPORTS: '/reports',

  // Billing (Phase 13)
  BILLING: '/billing',
  BILLING_PLANS: '/billing/plans',
  BILLING_INVOICES: '/billing/invoices',
  BILLING_PAYMENT_METHODS: '/billing/payment-methods',
  BILLING_ADMIN: '/billing/admin',

  // Phase 10 — Approvals, Signatures, Tasks, Escalations
  APPROVALS: '/approvals',
  APPROVAL_DETAIL: (id: string) => `/approvals/${id}`,
  SIGNATURES: '/signatures',
  TASKS: '/tasks',
  TASK_DETAIL: (id: string) => `/tasks/${id}`,
  ESCALATIONS: '/escalations',

  // Organization structure
  BRANCHES: '/branches',
  DEPARTMENTS: '/departments',

  // Settings
  SETTINGS: '/settings',
  SETTINGS_ORG: '/settings/organization',
  SETTINGS_TEAM: '/settings/team',
  SETTINGS_SECURITY: '/settings/security',
  SETTINGS_SSO: '/settings/sso',
  SETTINGS_API_KEYS: '/settings/api-keys',
  SETTINGS_WEBHOOKS: '/settings/webhooks',
  SETTINGS_BILLING: '/settings/billing',
  SETTINGS_NOTIFICATIONS: '/settings/notifications',
} as const;
