import { z } from 'zod';

/**
 * Compliance scoping questionnaire.
 *
 * Real GRC engagements start by establishing scope — ISO 27001 calls the output
 * a Statement of Applicability, PCI DSS uses a Self-Assessment Questionnaire to
 * decide which requirements apply. Without it every customer is shown the same
 * 18-framework catalogue and has to guess, which is the single most common way
 * a compliance programme starts wrong.
 *
 * The questions below are deliberately about how the business operates, not
 * about standards: an owner who has never done compliance can answer all of
 * them, and the mapping to frameworks is our job, not theirs.
 */
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
    add('NDPR', 'required', 'You handle personal data of people in Nigeria, so the Nigeria Data Protection Act and NDPR apply.');
  }
  if (personal && regions.has('eu')) {
    add('GDPR', 'required', 'You handle personal data of people in the EU, so the GDPR applies regardless of where your company is based.');
  }
  if (personal && regions.has('uk')) {
    add('UK_GDPR', 'required', 'You handle personal data of people in the UK, so the UK GDPR and Data Protection Act apply.');
  }
  if (personal && regions.has('south_africa')) {
    add('POPIA', 'required', 'You handle personal data of people in South Africa, so POPIA applies.');
  }
  if (personal && regions.has('california')) {
    add('CCPA', 'required', 'You handle personal data of California residents, so the CCPA/CPRA applies.');
  }
  if (personal && regions.has('uae')) {
    add('UAE_PDPL', 'required', 'You handle personal data of people in the UAE, so the UAE Personal Data Protection Law applies.');
  }
  if (personal && regions.has('india')) {
    add('DPDPA', 'required', 'You handle personal data of people in India, so the Digital Personal Data Protection Act applies.');
  }

  // ── Sector and activity obligations ───────────────────────────────────────
  if (p.handlesCardPayments) {
    add('PCIDSS', 'required', 'You take card payments, so PCI DSS is contractually required by your acquirer and the card schemes.');
  }
  if (p.handlesHealthData && (regions.has('usa') || regions.has('california'))) {
    add('HIPAA', 'required', 'You handle health information in the United States, which brings you into scope of HIPAA.');
  }
  if (p.isPubliclyListed && regions.has('usa')) {
    add('SOX', 'required', 'As a US-listed company you must demonstrate internal control over financial reporting under Sarbanes-Oxley.');
  }
  if (p.isRegulatedFinancialInstitution && regions.has('saudi_arabia')) {
    add('SAMA_CSF', 'required', 'SAMA requires its regulated financial institutions to implement the Cyber Security Framework.');
  }

  // ── Commercial and assurance drivers ──────────────────────────────────────
  if (p.sellsToEnterprise || p.primaryDriver === 'customer_requirement' || p.primaryDriver === 'tender_or_rfp') {
    add('ISO27001', 'recommended', 'Enterprise buyers and tenders almost always ask for ISO 27001 — it is the most widely recognised security certification.');
    add('SOC2', 'recommended', 'SOC 2 is the assurance report most commonly requested by North American customers during procurement.');
  }
  if (p.buildsSoftware || p.hostingModel === 'cloud' || p.hostingModel === 'hybrid') {
    add('ISO27001', 'recommended', 'You build or host software, so a managed information security programme is the foundation everything else builds on.');
    add('NIST_CSF', 'optional', 'NIST CSF 2.0 is a good free framework for structuring your security programme before you certify.');
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
