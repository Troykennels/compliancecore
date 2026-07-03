export type ControlCriticality = 'critical' | 'high' | 'medium' | 'low';
export type ControlStatus =
  | 'implemented'
  | 'partially_implemented'
  | 'not_implemented'
  | 'not_applicable'
  | 'planned';

export interface Control {
  id: string;
  frameworkId: string | null;
  frameworkName: string | null;
  controlRef: string;
  title: string;
  description: string | null;
  category: string | null;
  guidance: string | null;
  criticality: ControlCriticality;
  implementationStatus: ControlStatus;
  implementationNotes: string | null;
  testingNotes: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  dueDate: Date | null;
  reviewFrequencyDays: number;
  lastReviewedAt: Date | null;
  reviewedBy: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ControlListResult {
  controls: Control[];
  total: number;
  page: number;
  limit: number;
}

export interface ControlStatusCount {
  implementationStatus: ControlStatus;
  criticality: ControlCriticality;
  count: number;
}

export const CRITICALITY_WEIGHT: Record<ControlCriticality, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};
