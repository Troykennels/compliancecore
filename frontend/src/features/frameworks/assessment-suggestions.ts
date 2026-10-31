/** Editable starting wording for assessment fields. Suggestions are never saved until a person chooses, tailors and saves them,
 *  and none promises certification, legal compliance or third-party acceptance. [Bracketed] parts must be replaced. */
type Family = 'security' | 'privacy' | 'payment' | 'financial' | 'continuity' | 'health';
const FAMILY: Record<string, Family> = {
  ISO27001: 'security',
  SOC2: 'security',
  NIST_CSF: 'security',
  NIST_800_53: 'security',
  CIS_V8: 'security',
  SAMA_CSF: 'security',
  PCIDSS: 'payment',
  GDPR: 'privacy',
  UK_GDPR: 'privacy',
  NDPR: 'privacy',
  CCPA: 'privacy',
  POPIA: 'privacy',
  UAE_PDPL: 'privacy',
  DPDPA: 'privacy',
  ISO27701: 'privacy',
  SOX: 'financial',
  ISO22301: 'continuity',
  HIPAA: 'health',
};
export function familyOf(code: string): Family {
  return FAMILY[code] ?? 'security';
}

const SCOPES: Record<Family, string[]> = {
  security: [
    'The information systems, cloud services and supporting teams that store or process customer and business information, at every operating location.',
    'The [product or service] platform, its supporting infrastructure and the engineering, support and IT teams that operate it.',
    'Head office operations, including staff devices, email and collaboration tools, finance and HR systems, and the suppliers that support them.',
  ],
  privacy: [
    'Personal data processed in customer, HR and marketing activities, including the systems, suppliers and teams that handle it.',
    'Personal data of [customers, staff or other people] processed through [systems or services], including transfers to suppliers and other countries.',
    'All processing of personal data by [department or business unit], from collection to deletion.',
  ],
  payment: [
    'The cardholder data environment: systems, networks, people and service providers that store, process or transmit card data, and the systems connected to them.',
    'Card payments taken through [channel, for example the website or point of sale], including the payment service providers involved.',
  ],
  financial: [
    'IT systems and processes that support financial reporting, including access, change management and computer operations for the finance applications.',
    'The [ERP or accounting system] and the controls over who can change financial data and reports.',
  ],
  continuity: [
    'The critical business services, and the people, sites, suppliers and systems they depend on, with the arrangements to recover them.',
    '[Service name] and the dependencies needed to resume it within its agreed recovery time.',
  ],
  health: [
    'Systems, people and suppliers that create, receive, store or transmit protected health information.',
    'The [clinical or patient system] and the teams and business associates with access to protected health information.',
  ],
};
const OBJECTIVES: Record<Family, string[]> = {
  security: [
    'Establish how far current practices meet the requirements in scope and record the gaps to address.',
    'Confirm readiness for an independent assessment, with any remaining gaps recorded and owned.',
    'Show management the current compliance position, the main risks and the decisions needed.',
  ],
  privacy: [
    'Confirm whether lawful bases, records of processing, notices and data subject rights processes meet the applicable obligations.',
    'Establish how far personal data handling meets the law in scope and record the gaps to address.',
    'Show management the privacy compliance position and the decisions needed.',
  ],
  payment: [
    'Establish how far the cardholder data environment meets the applicable requirements and record the gaps to address.',
    'Confirm readiness for the annual assessment, with any remaining gaps recorded and owned.',
  ],
  financial: [
    'Establish whether IT general controls over financial reporting are designed and operating as described, and record the gaps.',
    'Prepare the records an external auditor will ask for, with remaining gaps recorded and owned.',
  ],
  continuity: [
    'Establish whether critical services can be recovered within their agreed times and record the gaps to address.',
    'Show management the continuity position and the decisions needed.',
  ],
  health: [
    'Establish how far safeguards for protected health information meet the requirements in scope and record the gaps.',
    'Show management the current position, the main risks and the decisions needed.',
  ],
};
export const scopeSuggestions = (code: string) => SCOPES[familyOf(code)];
export const objectiveSuggestions = (code: string) => OBJECTIVES[familyOf(code)];

export const PERIOD_SUGGESTIONS = [
  'Next 12 months, reviewed each quarter.',
  'Next 12 months, reviewed every six months.',
  'Current financial year, reviewed after any significant change.',
];
export const RISK_METHOD_SUGGESTIONS = [
  'Likelihood and impact are each rated 1 to 5 using the guide below. A score of 15 or more is high and needs a treatment decision by the risk owner; remaining risk above 9 can be accepted only by [accountable executive].',
  "Ratings use the 1 to 5 guide below and are agreed with the person responsible for the activity. Any risk to legal obligations or people's safety is treated as high regardless of score.",
];
export const OBLIGATION_SUGGESTIONS = [
  'Law: [name, article or section]. Official source: [link]. Edition or version: [date]. Applicability confirmed by [name, role] on [date]. Reporting deadline: [deadline, or none].',
  'Contract: [customer or contract], clause [reference]. Requirement: [summary]. Confirmed by [name, role] on [date].',
  'Regulator guidance: [title and reference]. How it applies: [explanation]. Next check for changes: [date].',
];
export const MONITORING_SUGGESTIONS = [
  'Next review by [owner] on [date]. Review earlier after a significant change to systems, suppliers, laws or after an incident. Reporting dates: [dates, or none].',
  'Quarterly review of open actions and evidence by [owner]; full reassessment every [12] months.',
];
export const MANAGEMENT_REVIEW_SUGGESTIONS = [
  'Management review held on [date] with [attendees]. Inputs: assessment results, remaining risks, incidents and resource needs. Decisions: [decisions, owners and dates].',
];
export const REVIEW_NOTE_SUGGESTIONS = [
  'Reviewed the current records for each step. The evidence supports the recorded conclusions; remaining gaps are tracked as corrective actions.',
  'Returned for correction: [step] needs [missing record or evidence] before sign-off.',
];
export const TARGET_OFFSETS: Array<[string, number]> = [
  ['In 1 month', 1],
  ['In 3 months', 3],
  ['In 6 months', 6],
  ['In 12 months', 12],
];
export function monthsFromToday(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
