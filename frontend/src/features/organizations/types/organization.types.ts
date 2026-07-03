export type OrgSize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1001+';
export type DataResidencyRegion = 'global' | 'us' | 'eu' | 'ap' | 'uk' | 'me';
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD-MM-YYYY';

export interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  onboardingDoneAt: string | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  size: OrgSize | null;
  logoUrl: string | null;
  timezone: string;
  dateFormat: DateFormat;
  dataResidencyRegion: DataResidencyRegion;
  notificationSettings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;
  size?: OrgSize | null;
  logoUrl?: string | null;
  timezone?: string;
  dateFormat?: DateFormat;
}

export const ORG_SIZES: { value: OrgSize; label: string }[] = [
  { value: '1-10',      label: '1–10 employees' },
  { value: '11-50',     label: '11–50 employees' },
  { value: '51-200',    label: '51–200 employees' },
  { value: '201-500',   label: '201–500 employees' },
  { value: '501-1000',  label: '501–1000 employees' },
  { value: '1001+',     label: '1001+ employees' },
];

export const INDUSTRIES = [
  'Technology', 'Financial Services', 'Healthcare', 'Retail & E-commerce',
  'Manufacturing', 'Education', 'Government & Public Sector', 'Legal',
  'Telecommunications', 'Energy & Utilities', 'Media & Entertainment',
  'Non-profit', 'Professional Services', 'Real Estate', 'Other',
];

export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2025)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2025)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-12-31)' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY (31-12-2025)' },
];

export const DATA_RESIDENCY_REGIONS: { value: DataResidencyRegion; label: string }[] = [
  { value: 'global', label: 'Global (no restriction)' },
  { value: 'us',     label: 'United States' },
  { value: 'eu',     label: 'European Union' },
  { value: 'uk',     label: 'United Kingdom' },
  { value: 'ap',     label: 'Asia Pacific' },
  { value: 'me',     label: 'Middle East' },
];
