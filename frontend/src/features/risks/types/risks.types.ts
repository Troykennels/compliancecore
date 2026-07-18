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
  id:                 string;
  title:              string;
  description:        string | null;
  category:           RiskCategory;
  inherentLikelihood: number;
  inherentImpact:     number;
  inherentScore:      number;
  treatment:          RiskTreatment;
  residualLikelihood: number;
  residualImpact:     number;
  residualScore:      number;
  status:             RiskStatus;
  mitigationPlan:     string | null;
  ownerId:            string | null;
  ownerName:          string | null;
  ownerEmail:         string | null;
  reviewDate:         string | null;
  nextReviewDate:     string | null;
  createdBy:          string | null;
  createdAt:          string;
  updatedAt:          string;
}

export interface CreateRiskInput {
  title:               string;
  description?:        string | null;
  category?:           RiskCategory;
  inherentLikelihood?: number;
  inherentImpact?:     number;
  treatment?:          RiskTreatment;
  residualLikelihood?: number;
  residualImpact?:     number;
  status?:             RiskStatus;
  mitigationPlan?:     string | null;
  ownerId?:            string | null;
  reviewDate?:         string | null;
  nextReviewDate?:     string | null;
}

export type UpdateRiskInput = Partial<CreateRiskInput>;

export interface RiskFilters {
  page?:     number;
  limit?:    number;
  status?:   RiskStatus;
  category?: RiskCategory;
  ownerId?:  string;
  q?:        string;
  sortBy?:   string;
  sortDir?:  'asc' | 'desc';
}

export interface RiskListResult {
  risks: Risk[];
  total: number;
  page:  number;
  limit: number;
}

export interface RiskStatusCount {
  status: RiskStatus;
  count:  number;
}

export interface RiskLevelCount {
  level: 'high' | 'medium' | 'low';
  count: number;
}

export interface RiskStats {
  byStatus: RiskStatusCount[];
  byLevel:  RiskLevelCount[];
}

export const CATEGORY_CONFIG: Record<RiskCategory, { label: string }> = {
  operational:  { label: 'Operational' },
  strategic:    { label: 'Strategic' },
  financial:    { label: 'Financial' },
  compliance:   { label: 'Compliance' },
  security:     { label: 'Security' },
  privacy:      { label: 'Privacy' },
  reputational: { label: 'Reputational' },
  third_party:  { label: 'Third Party' },
};

export const TREATMENT_CONFIG: Record<RiskTreatment, { label: string }> = {
  mitigate: { label: 'Mitigate' },
  accept:   { label: 'Accept' },
  transfer: { label: 'Transfer' },
  avoid:    { label: 'Avoid' },
};

export const STATUS_CONFIG: Record<RiskStatus, { label: string; color: string; bgColor: string }> = {
  open:         { label: 'Open',         color: 'text-red-700',    bgColor: 'bg-red-100' },
  in_treatment: { label: 'In Treatment', color: 'text-amber-700',  bgColor: 'bg-amber-100' },
  mitigated:    { label: 'Mitigated',    color: 'text-green-700',  bgColor: 'bg-green-100' },
  accepted:     { label: 'Accepted',     color: 'text-blue-700',   bgColor: 'bg-blue-100' },
  closed:       { label: 'Closed',       color: 'text-slate-600',  bgColor: 'bg-slate-100' },
};

export const LIKELIHOOD_LABELS: Record<number, string> = {
  1: '1 – Rare',
  2: '2 – Unlikely',
  3: '3 – Possible',
  4: '4 – Likely',
  5: '5 – Almost Certain',
};

export const IMPACT_LABELS: Record<number, string> = {
  1: '1 – Insignificant',
  2: '2 – Minor',
  3: '3 – Moderate',
  4: '4 – Major',
  5: '5 – Severe',
};

/** Severity bucket by score: >=15 high (red), >=8 medium (amber), else low (green). */
export function scoreSeverity(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 15) return { label: 'High',   color: 'text-red-700',   bgColor: 'bg-red-100' };
  if (score >= 8)  return { label: 'Medium', color: 'text-amber-700', bgColor: 'bg-amber-100' };
  return { label: 'Low', color: 'text-green-700', bgColor: 'bg-green-100' };
}
