export type VendorRiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type VendorStatus = 'active' | 'under_review' | 'inactive' | 'offboarded';

export type VendorAssessmentStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'expired';

export interface Vendor {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  riskLevel: VendorRiskLevel;
  status: VendorStatus;
  dataProcessed: string | null;
  servicesProvided: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  onboardedAt: Date | null;
  offboardedAt: Date | null;
  nextReviewDate: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorListResult {
  vendors: Vendor[];
  total: number;
  page: number;
  limit: number;
}

export interface VendorAssessment {
  id: string;
  vendorId: string;
  name: string;
  status: VendorAssessmentStatus;
  score: number | null;
  notes: string | null;
  assessedBy: string | null;
  assessedByName: string | null;
  assessedAt: Date | null;
  dueDate: Date | null;
  createdAt: Date;
}

export const RISK_LEVEL_WEIGHT: Record<VendorRiskLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};
