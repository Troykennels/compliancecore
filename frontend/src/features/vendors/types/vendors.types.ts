export type VendorRiskLevel = 'critical' | 'high' | 'medium' | 'low';

export type VendorStatus = 'active' | 'under_review' | 'inactive' | 'offboarded';

export type VendorAssessmentStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'expired';

export interface Vendor {
  id:               string;
  name:             string;
  description:      string | null;
  category:         string | null;
  website:          string | null;
  contactName:      string | null;
  contactEmail:     string | null;
  riskLevel:        VendorRiskLevel;
  status:           VendorStatus;
  dataProcessed:    string | null;
  servicesProvided: string | null;
  ownerId:          string | null;
  ownerName:        string | null;
  ownerEmail:       string | null;
  onboardedAt:      string | null;
  offboardedAt:     string | null;
  nextReviewDate:   string | null;
  createdBy:        string | null;
  updatedBy:        string | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface VendorAssessment {
  id:             string;
  vendorId:       string;
  name:           string;
  status:         VendorAssessmentStatus;
  score:          number | null;
  notes:          string | null;
  assessedBy:     string | null;
  assessedByName: string | null;
  assessedAt:     string | null;
  dueDate:        string | null;
  createdAt:      string;
}

export interface CreateVendorInput {
  name:              string;
  description?:      string | null;
  category?:         string | null;
  website?:          string | null;
  contactName?:      string | null;
  contactEmail?:     string | null;
  riskLevel?:        VendorRiskLevel;
  status?:           VendorStatus;
  dataProcessed?:    string | null;
  servicesProvided?: string | null;
  ownerId?:          string | null;
  onboardedAt?:      string | null;
  offboardedAt?:     string | null;
  nextReviewDate?:   string | null;
}

export type UpdateVendorInput = Partial<CreateVendorInput>;

export interface CreateVendorAssessmentInput {
  name:        string;
  status?:     VendorAssessmentStatus;
  score?:      number | null;
  notes?:      string | null;
  assessedAt?: string | null;
  dueDate?:    string | null;
}

export interface VendorFilters {
  page?:      number;
  limit?:     number;
  status?:    VendorStatus;
  riskLevel?: VendorRiskLevel;
  ownerId?:   string;
  q?:         string;
  category?:  string;
  sortBy?:    string;
  sortDir?:   'asc' | 'desc';
}

export interface VendorListResult {
  vendors: Vendor[];
  total:   number;
  page:    number;
  limit:   number;
}

export const RISK_LEVEL_CONFIG: Record<VendorRiskLevel, { label: string; color: string; bgColor: string }> = {
  critical: { label: 'Critical', color: 'text-red-700',    bgColor: 'bg-red-100' },
  high:     { label: 'High',     color: 'text-orange-700', bgColor: 'bg-orange-100' },
  medium:   { label: 'Medium',   color: 'text-blue-700',   bgColor: 'bg-blue-100' },
  low:      { label: 'Low',      color: 'text-slate-600',  bgColor: 'bg-slate-100' },
};

export const VENDOR_STATUS_CONFIG: Record<VendorStatus, { label: string; color: string; bgColor: string }> = {
  active:       { label: 'Active',       color: 'text-green-700',  bgColor: 'bg-green-100' },
  under_review: { label: 'Under Review', color: 'text-amber-700',  bgColor: 'bg-amber-100' },
  inactive:     { label: 'Inactive',     color: 'text-slate-500',  bgColor: 'bg-slate-100' },
  offboarded:   { label: 'Offboarded',   color: 'text-red-700',    bgColor: 'bg-red-100' },
};

export const ASSESSMENT_STATUS_CONFIG: Record<
  VendorAssessmentStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending:     { label: 'Pending',     color: 'text-slate-600',  bgColor: 'bg-slate-100' },
  in_progress: { label: 'In Progress', color: 'text-amber-700',  bgColor: 'bg-amber-100' },
  completed:   { label: 'Completed',   color: 'text-green-700',  bgColor: 'bg-green-100' },
  expired:     { label: 'Expired',     color: 'text-red-700',    bgColor: 'bg-red-100' },
};
