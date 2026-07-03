export type OrgSize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1001+';

export type DataResidencyRegion = 'global' | 'us' | 'eu' | 'ap' | 'uk' | 'me';

export interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  onboardingDoneAt: Date | null;
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
  dateFormat: string;
  dataResidencyRegion: DataResidencyRegion;
  notificationSettings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateOrganizationDto {
  name?: string;
  industry?: string;
  website?: string;
  phone?: string;
  country?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  size?: OrgSize;
  logoUrl?: string;
  timezone?: string;
  dateFormat?: string;
}

export interface LogoUploadUrlResult {
  uploadUrl: string;
  fileKey: string;
  expiresAt: Date;
}
