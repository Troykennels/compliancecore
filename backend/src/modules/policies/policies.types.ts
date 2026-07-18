export type PolicyDocumentType = 'policy' | 'procedure' | 'standard' | 'guideline';

export type PolicyStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'archived';

export interface Policy {
  id: string;
  title: string;
  description: string | null;
  documentType: PolicyDocumentType;
  status: PolicyStatus;
  content: string | null;
  currentVersion: number;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  reviewDueDate: Date | null;
  reviewFrequencyDays: number;
  frameworkIds: string[];
  tags: string[];
  approvedAt: Date | null;
  approvedBy: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyListResult {
  policies: Policy[];
  total: number;
  page: number;
  limit: number;
}
