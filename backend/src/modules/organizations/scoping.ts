import { z } from 'zod';

/** Collect facts to identify candidate requirements. Applicability and control
 * coverage are later human-reviewed decisions; this is not a Statement of Applicability. */
export const scopingProfileSchema = z.object({
  // ── Where the organisation operates and whose data it holds ───────────────
  // Free-form ISO-ish region keys; the recommendation engine matches on these.
  operatingRegions: z.array(z.enum([
    'nigeria', 'ghana', 'kenya', 'south_africa', 'eu', 'uk', 'usa', 'california',
    'canada', 'uae', 'saudi_arabia', 'india', 'other',
  ])).default([]),
  customerDataRegions: z.array(z.enum([
    'nigeria', 'ghana', 'kenya', 'south_africa', 'eu', 'uk', 'usa', 'california',
    'canada', 'uae', 'saudi_arabia', 'india', 'other',
  ])).default([]),

  // ── What kind of data is handled ──────────────────────────────────────────
  handlesPersonalData:  z.boolean().default(false),
  handlesHealthData:    z.boolean().default(false),
  handlesCardPayments:  z.boolean().default(false),
  handlesFinancialData: z.boolean().default(false),
  handlesChildrenData:  z.boolean().default(false),

  // ── How the organisation runs ─────────────────────────────────────────────
  hostingModel:   z.enum(['cloud', 'on_premise', 'hybrid', 'unknown']).default('unknown'),
  buildsSoftware: z.boolean().default(false),
  sellsToEnterprise: z.boolean().default(false),
  isPubliclyListed:  z.boolean().default(false),
  isRegulatedFinancialInstitution: z.boolean().default(false),
  usesSubprocessors: z.boolean().default(false),
  hasRemoteWorkers:  z.boolean().default(false),
  businessContinuityCritical: z.boolean().default(false),

  // ── Programme maturity ────────────────────────────────────────────────────
  existingCertifications: z.array(z.string().max(100)).max(30).default([]),
  hasDataProtectionOfficer: z.boolean().default(false),
  primaryDriver: z.enum([
    'customer_requirement', 'regulatory_obligation', 'tender_or_rfp',
    'investor_due_diligence', 'internal_best_practice', 'unknown',
  ]).default('unknown'),
});

export type ScopingProfile = z.infer<typeof scopingProfileSchema>;

export interface FrameworkRecommendation {
  code: string;
  /** 'required' = a legal or contractual obligation given the answers.
   *  'recommended' = strongly expected in this situation but not compulsory.
   *  'optional' = worth considering later. */
  priority: 'required' | 'recommended' | 'optional';
  /** Shown to the user verbatim, so it must explain itself in plain language. */
  reason: string;
}

/**
 * Maps a scoping profile onto the framework catalogue.
 *
 * Deliberately rule-based and transparent rather than a score: a compliance
 * officer has to be able to justify to an auditor why a framework is in or out
 * of scope, and "the model said so" is not a defensible answer.
 */
export function recommendFrameworks(p: ScopingProfile): FrameworkRecommendation[] {
  const out: FrameworkRecommendation[] = [];
  const add = (code: string, priority: FrameworkRecommendation['priority'], reason: string) => {
    if (!out.some((r) => r.code === code)) out.push({ code, priority, reason });
  };

  const regions = new Set([...p.operatingRegions, ...p.customerDataRegions]);
  const personal = p.handlesPersonalData;

  // ── Data-protection law follows the data subject, not the company address ──
  if (personal && regions.has('nigeria')) {
    add('NDPR', 'recommended', 'Personal-data activity connected with Nigeria needs review against NDPA2023, final GAID2025 and relevant NDPR material. Confirm processing roles, scope and current requirements before deciding applicability.');
  }
  if (personal && regions.has('eu')) {
    add('GDPR', 'recommended', 'Review GDPR territorial scope, establishment, offering goods/services and monitoring criteria. EU-related data alone does not establish applicability.');
  }
  if (personal && regions.has('uk')) {
    add('UK_GDPR', 'recommended', 'Review UK territorial scope, processing roles, establishment and targeting/monitoring criteria before deciding which UK privacy duties apply.');
  }
  if (personal && regions.has('south_africa')) {
    add('POPIA', 'recommended', 'Review South African territorial scope, responsible-party/operator roles and exemptions before deciding applicability.');
  }
  if (personal && regions.has('california')) {
    add('CCPA', 'recommended', 'Review California business thresholds, exemptions, organisational role and relevant processing. California-resident data alone does not establish CCPA/CPRA applicability.');
  }
  if (personal && regions.has('uae')) {
    add('UAE_PDPL', 'recommended', 'Review the relevant UAE jurisdiction, processing role, territorial criteria and free-zone or sector-specific regime.');
  }
  if (personal && regions.has('india')) {
    add('DPDPA', 'recommended', 'Review Indian territorial scope, operative provisions and commencement dates with the responsible legal reviewer.');
  }

  // ── Sector and activity obligations ───────────────────────────────────────
  if (p.handlesCardPayments) {
    add('PCIDSS', 'recommended', 'Ask the acquirer or qualified adviser which payment-card scope and validation route apply. Taking payments alone does not determine every PCI requirement.');
  }
  if (p.handlesHealthData && (regions.has('usa') || regions.has('california'))) {
    add('HIPAA', 'recommended', 'Review covered-entity/business-associate status, activities and applicable US requirements. Health information in the US alone does not establish HIPAA applicability.');
  }
  if (p.isPubliclyListed && regions.has('usa')) {
    add('SOX', 'recommended', 'Review issuer status, applicable reporting requirements and internal-control obligations with the financial reporting adviser.');
  }
  if (p.isRegulatedFinancialInstitution && regions.has('saudi_arabia')) {
    add('SAMA_CSF', 'recommended', 'Review the exact licence, regulated activities, regulator directions and current SAMA requirements with the regulatory lead.');
  }

  // ── Commercial and assurance drivers ──────────────────────────────────────
  if (p.sellsToEnterprise || p.primaryDriver === 'customer_requirement' || p.primaryDriver === 'tender_or_rfp') {
    add('ISO27001', 'recommended', 'Enterprise buyers and tenders almost always ask for ISO 27001 — it is the most widely recognised security certification.');
    add('SOC2', 'recommended', 'SOC 2 is the assurance report most commonly requested by North American customers during procurement.');
  }
  if (p.buildsSoftware || p.hostingModel === 'cloud' || p.hostingModel === 'hybrid') {
    add('ISO27001', 'recommended', 'You build or host software, so a managed information security programme is the foundation everything else builds on.');
    add('NIST_CSF', 'optional', 'Consider NIST CSF2.0 for organising cybersecurity outcomes and monitoring; it does not provide a certification route.');
  }
  if (p.primaryDriver === 'investor_due_diligence') {
    add('SOC2', 'recommended', 'Investor technical due diligence commonly asks for SOC 2 or an equivalent independent report.');
  }
  if (p.businessContinuityCritical) {
    add('ISO22301', 'recommended', 'You flagged operational continuity as critical, which is exactly what ISO 22301 business continuity management addresses.');
  }
  if (personal && (p.hasDataProtectionOfficer || regions.has('eu') || regions.has('nigeria'))) {
    add('ISO27701', 'optional', 'ISO 27701 extends ISO 27001 into a privacy management system and helps evidence GDPR/NDPR accountability.');
  }
  if (p.usesSubprocessors) {
    add('NIST_CSF', 'optional', 'You rely on subprocessors — NIST CSF 2.0 includes a dedicated supply chain risk management function.');
  }

  // Never leave a new customer with an empty list.
  if (out.length === 0) {
    add('ISO27001', 'recommended', 'A good default starting point: ISO 27001 establishes the security management system most other frameworks assume you already have.');
    add('NIST_CSF', 'optional', 'A free, flexible framework to structure your programme while you decide what to certify against.');
  }

  const rank = { required: 0, recommended: 1, optional: 2 } as const;
  return out.sort((a, b) => rank[a.priority] - rank[b.priority]);
}
