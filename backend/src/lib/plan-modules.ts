// ─── Plan modules (ComplianceCore gating prompt 2026, sections 2-5) ──────────
//
// A plan carries `modules`: { <module key>: true | false }. A module is locked
// ONLY by an explicit false. A plan without a module list (every plan before
// catalogue 2026.2, and every grandfathered customer on one) keeps every module.
//
// Locked means: the module's records stay VIEWABLE and exportable (this is a
// compliance product: an organisation's evidence may be needed at short notice
// and data created under a higher plan must never be lost), but nothing new can
// be created or changed there. AI tools are the exception: every AI call is a
// generation, so a locked AI module refuses every request; the same holds for
// analytics and policy templates (see LOCK_ALL_METHODS).
//
// Never lockable: dashboard, guide, journey, organisation scope, assessments,
// controls, policies, evidence, tasks, calendar, expiry tracker, basic reports
// and compliance score, notifications, settings (incl. branding), billing,
// payments and sign-in. They are not listed here, so they can never be locked.

export interface PlanModule {
  key: string;
  label: string;
  /** Concise benefit shown on the locked screen. */
  benefit: string;
}

export const PLAN_MODULES: PlanModule[] = [
  { key: 'risks', label: 'Risk assessment', benefit: 'Score, treat and track risks with owners and review dates.' },
  { key: 'policy_templates', label: 'Policy templates', benefit: 'Start policies from ready-made templates instead of a blank page.' },
  { key: 'audits', label: 'Audits', benefit: 'Plan audits, record findings and follow corrective actions to closure.' },
  { key: 'approvals', label: 'Approvals', benefit: 'Route documents and decisions for sign-off with a full trail.' },
  { key: 'training', label: 'Training', benefit: 'Assign training, track completion and keep proof for auditors.' },
  { key: 'incidents', label: 'Incidents', benefit: 'Log, investigate and report incidents within deadlines.' },
  { key: 'analytics', label: 'Analytics (enhanced reporting)', benefit: 'Trends and breakdowns across frameworks, risks and tasks.' },
  { key: 'signatures', label: 'Signatures', benefit: 'Collect verifiable electronic signatures on policies and records.' },
  { key: 'vendors', label: 'Vendors', benefit: 'Assess and monitor third parties and their documents.' },
  { key: 'escalations', label: 'Escalations', benefit: 'Escalate overdue or high-risk items automatically to the right people.' },
  { key: 'privacy_ropa', label: 'Records of processing', benefit: 'Keep the record of processing activities privacy laws require.' },
  { key: 'privacy_dsar', label: 'Data subject requests', benefit: 'Receive, track and answer data subject requests on time.' },
  { key: 'privacy_dpia', label: 'Impact assessments', benefit: 'Run and decide data protection impact assessments.' },
  { key: 'msp_portfolio', label: 'Client portfolio', benefit: 'Manage several client organisations from one portfolio.' },
  { key: 'scheduled_reports', label: 'Scheduled reports (advanced reporting)', benefit: 'Send board and management reports automatically on a schedule.' },
  { key: 'integrations', label: 'Integrations', benefit: 'Connect approved tools so evidence and alerts flow in automatically.' },
  { key: 'ai', label: 'AI tools', benefit: 'Draft and review with AI assistance (always checked by a person).' },
];

export const PLAN_MODULE_KEYS = PLAN_MODULES.map((m) => m.key);
export const MODULE_LABEL: Record<string, string> = Object.fromEntries(PLAN_MODULES.map((m) => [m.key, m.label]));

/**
 * Modules whose every request is refused when locked (not only writes): their
 * value IS reading (AI generations, analytics, Orion Soft's policy templates),
 * and they hold no customer records that must stay viewable.
 */
export const LOCK_ALL_METHODS = new Set(['ai', 'analytics', 'policy_templates']);

// API path -> module. First match wins, so more specific rules come first.
const RULES: Array<[RegExp, string]> = [
  [/^\/api\/policies\/templates(\/|\?|$)/, 'policy_templates'],
  [/^\/api\/privacy\/activities(\/|\?|$)/, 'privacy_ropa'],
  [/^\/api\/privacy\/requests(\/|\?|$)/, 'privacy_dsar'],
  [/^\/api\/privacy\/assessments(\/|\?|$)/, 'privacy_dpia'],
  [/^\/api\/reports\/scheduled(\/|\?|$)/, 'scheduled_reports'],
  [/^\/api\/risks(\/|\?|$)/, 'risks'],
  [/^\/api\/audits(\/|\?|$)/, 'audits'],
  [/^\/api\/approvals(\/|\?|$)/, 'approvals'],
  [/^\/api\/training(\/|\?|$)/, 'training'],
  [/^\/api\/incidents(\/|\?|$)/, 'incidents'],
  [/^\/api\/analytics(\/|\?|$)/, 'analytics'],
  [/^\/api\/signatures(\/|\?|$)/, 'signatures'],
  [/^\/api\/vendors(\/|\?|$)/, 'vendors'],
  [/^\/api\/escalations(\/|\?|$)/, 'escalations'],
  [/^\/api\/integrations(\/|\?|$)/, 'integrations'],
  [/^\/api\/ai(\/|\?|$)/, 'ai'],
];

export function moduleForPath(url: string): string | null {
  const path = String(url || '').split('?')[0];
  for (const [re, key] of RULES) if (re.test(path)) return key;
  return null;
}

/** Locked module keys from a plan's module list (explicit false only). */
export function lockedModulesFrom(modules: unknown): string[] {
  if (!modules) return [];
  let parsed: unknown = modules;
  if (typeof modules === 'string') {
    try { parsed = JSON.parse(modules); } catch { return []; } // unreadable = nothing locked
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  const m = parsed as Record<string, unknown>;
  return PLAN_MODULE_KEYS.filter((k) => m[k] === false);
}

/** A complete module list from the modules a plan includes (every other one false). */
export function modulesFor(included: readonly string[]): Record<string, boolean> {
  return Object.fromEntries(PLAN_MODULE_KEYS.map((k) => [k, included.includes(k)]));
}

/** Rejects unknown keys and non-boolean values (owner plan edits). */
export function validateModules(input: unknown): Record<string, boolean> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Modules must be an object of module: true/false');
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!PLAN_MODULE_KEYS.includes(k)) throw new Error(`Unknown module: ${k}`);
    if (typeof v !== 'boolean') throw new Error(`Module ${k} must be true or false`);
    out[k] = v;
  }
  return out;
}
