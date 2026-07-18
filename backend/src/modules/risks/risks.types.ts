export type RiskCategory =
  | 'operational'
  | 'strategic'
  | 'financial'
  | 'compliance'
  | 'security'
  | 'privacy'
  | 'reputational'
  | 'third_party';

export type RiskTreatment = 'mitigate' | 'accept' | 'transfer' | 'avoid';

export type RiskStatus =
  | 'open'
  | 'in_treatment'
  | 'mitigated'
  | 'accepted'
  | 'closed';

export interface Risk {
  id: string;
  title: string;
  description: string | null;
  category: RiskCategory;
  inherentLikelihood: number;
  inherentImpact: number;
  inherentScore: number;
  treatment: RiskTreatment;
  residualLikelihood: number;
  residualImpact: number;
  residualScore: number;
  status: RiskStatus;
  mitigationPlan: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  reviewDate: Date | null;
  nextReviewDate: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskListResult {
  risks: Risk[];
  total: number;
  page: number;
  limit: number;
}

export interface RiskStatusCount {
  status: RiskStatus;
  count: number;
}

export interface RiskLevelCount {
  level: 'high' | 'medium' | 'low';
  count: number;
}

export interface RiskStats {
  byStatus: RiskStatusCount[];
  byLevel: RiskLevelCount[];
}
