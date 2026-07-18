export type PolicyDocumentType = 'policy' | 'procedure' | 'standard' | 'guideline';

export type PolicyStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'archived';

export interface Policy {
  id:                  string;
  title:               string;
  description:         string | null;
  documentType:        PolicyDocumentType;
  status:              PolicyStatus;
  content:             string | null;
  currentVersion:      number;
  ownerId:             string | null;
  ownerName:           string | null;
  ownerEmail:          string | null;
  reviewDueDate:       string | null;
  reviewFrequencyDays: number;
  frameworkIds:        string[];
  tags:                string[];
  approvedAt:          string | null;
  approvedBy:          string | null;
  createdBy:           string | null;
  updatedBy:           string | null;
  createdAt:           string;
  updatedAt:           string;
}

export interface CreatePolicyInput {
  title:                string;
  description?:         string | null;
  documentType?:        PolicyDocumentType;
  status?:              PolicyStatus;
  content?:             string | null;
  ownerId?:             string | null;
  reviewDueDate?:       string | null;
  reviewFrequencyDays?: number;
  frameworkIds?:        string[];
  tags?:                string[];
}

export type UpdatePolicyInput = Partial<CreatePolicyInput>;

export interface PolicyFilters {
  page?:         number;
  limit?:        number;
  status?:       PolicyStatus;
  documentType?: PolicyDocumentType;
  ownerId?:      string;
  q?:            string;
  sortBy?:       string;
  sortDir?:      'asc' | 'desc';
}

export interface PolicyListResult {
  policies: Policy[];
  total:    number;
  page:     number;
  limit:    number;
}

export const DOCUMENT_TYPE_CONFIG: Record<
  PolicyDocumentType,
  { label: string; color: string; bgColor: string }
> = {
  policy:    { label: 'Policy',    color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  procedure: { label: 'Procedure', color: 'text-blue-700',   bgColor: 'bg-blue-100' },
  standard:  { label: 'Standard',  color: 'text-teal-700',   bgColor: 'bg-teal-100' },
  guideline: { label: 'Guideline', color: 'text-slate-600',  bgColor: 'bg-slate-100' },
};

export const POLICY_STATUS_CONFIG: Record<
  PolicyStatus,
  { label: string; color: string; bgColor: string }
> = {
  draft:     { label: 'Draft',     color: 'text-slate-600',  bgColor: 'bg-slate-100' },
  in_review: { label: 'In Review', color: 'text-amber-700',  bgColor: 'bg-amber-100' },
  approved:  { label: 'Approved',  color: 'text-blue-700',   bgColor: 'bg-blue-100' },
  published: { label: 'Published', color: 'text-green-700',  bgColor: 'bg-green-100' },
  archived:  { label: 'Archived',  color: 'text-slate-500',  bgColor: 'bg-slate-100' },
};
