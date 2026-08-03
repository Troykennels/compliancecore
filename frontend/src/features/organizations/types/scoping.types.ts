export type ScopingRegion =
  | 'nigeria' | 'ghana' | 'kenya' | 'south_africa' | 'eu' | 'uk' | 'usa'
  | 'california' | 'canada' | 'uae' | 'saudi_arabia' | 'india' | 'other';

export type HostingModel = 'cloud' | 'on_premise' | 'hybrid' | 'unknown';

export type PrimaryDriver =
  | 'customer_requirement' | 'regulatory_obligation' | 'tender_or_rfp'
  | 'investor_due_diligence' | 'internal_best_practice' | 'unknown';

export interface ScopingProfile {
  operatingRegions: ScopingRegion[];
  customerDataRegions: ScopingRegion[];
  handlesPersonalData: boolean;
  handlesHealthData: boolean;
  handlesCardPayments: boolean;
  handlesFinancialData: boolean;
  handlesChildrenData: boolean;
  hostingModel: HostingModel;
  buildsSoftware: boolean;
  sellsToEnterprise: boolean;
  isPubliclyListed: boolean;
  isRegulatedFinancialInstitution: boolean;
  usesSubprocessors: boolean;
  hasRemoteWorkers: boolean;
  businessContinuityCritical: boolean;
  existingCertifications: string[];
  hasDataProtectionOfficer: boolean;
  primaryDriver: PrimaryDriver;
}

export interface FrameworkRecommendation {
  code: string;
  priority: 'required' | 'recommended' | 'optional';
  reason: string;
}

export interface ScopingResponse {
  profile: ScopingProfile | null;
  completedAt?: string | null;
  recommendations: FrameworkRecommendation[];
}

export const REGION_LABELS: { value: ScopingRegion; label: string }[] = [
  { value: 'nigeria',      label: 'Nigeria' },
  { value: 'ghana',        label: 'Ghana' },
  { value: 'kenya',        label: 'Kenya' },
  { value: 'south_africa', label: 'South Africa' },
  { value: 'eu',           label: 'European Union' },
  { value: 'uk',           label: 'United Kingdom' },
  { value: 'usa',          label: 'United States' },
  { value: 'california',   label: 'California (CCPA)' },
  { value: 'canada',       label: 'Canada' },
  { value: 'uae',          label: 'United Arab Emirates' },
  { value: 'saudi_arabia', label: 'Saudi Arabia' },
  { value: 'india',        label: 'India' },
  { value: 'other',        label: 'Elsewhere' },
];

export const DRIVER_LABELS: { value: PrimaryDriver; label: string }[] = [
  { value: 'customer_requirement',   label: 'A customer asked us for it' },
  { value: 'tender_or_rfp',          label: 'We are bidding for a tender or RFP' },
  { value: 'regulatory_obligation',  label: 'A regulator requires it' },
  { value: 'investor_due_diligence', label: 'Investor or acquirer due diligence' },
  { value: 'internal_best_practice', label: 'We want to do this properly, internally' },
  { value: 'unknown',                label: 'Not sure yet' },
];

export const HOSTING_LABELS: { value: HostingModel; label: string }[] = [
  { value: 'cloud',      label: 'Cloud (AWS, Azure, GCP…)' },
  { value: 'on_premise', label: 'Our own servers' },
  { value: 'hybrid',     label: 'A mix of both' },
  { value: 'unknown',    label: 'Not sure' },
];

export const EMPTY_SCOPING_PROFILE: ScopingProfile = {
  operatingRegions: [],
  customerDataRegions: [],
  handlesPersonalData: false,
  handlesHealthData: false,
  handlesCardPayments: false,
  handlesFinancialData: false,
  handlesChildrenData: false,
  hostingModel: 'unknown',
  buildsSoftware: false,
  sellsToEnterprise: false,
  isPubliclyListed: false,
  isRegulatedFinancialInstitution: false,
  usesSubprocessors: false,
  hasRemoteWorkers: false,
  businessContinuityCritical: false,
  existingCertifications: [],
  hasDataProtectionOfficer: false,
  primaryDriver: 'unknown',
};
