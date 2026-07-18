export type ControlCriticality = 'critical' | 'high' | 'medium' | 'low';

export type ControlImplementationStatus =
  | 'implemented'
  | 'partially_implemented'
  | 'not_implemented'
  | 'not_applicable'
  | 'planned';

export interface Control {
  id:                   string;
  frameworkId:          string | null;
  frameworkName:        string | null;
  controlRef:           string;
  title:                string;
  description:          string | null;
  category:             string | null;
  guidance:             string | null;
  criticality:          ControlCriticality;
  implementationStatus: ControlImplementationStatus;
  implementationNotes:  string | null;
  testingNotes:         string | null;
  ownerId:              string | null;
  ownerName:            string | null;
  ownerEmail:           string | null;
  dueDate:              string | null;
  reviewFrequencyDays:  number;
  lastReviewedAt:       string | null;
  reviewedBy:           string | null;
  createdBy:            string | null;
  createdAt:            string;
  updatedAt:            string;
}

export interface CreateControlInput {
  controlRef:            string;
  title:                 string;
  description?:          string | null;
  category?:             string | null;
  guidance?:             string | null;
  criticality?:          ControlCriticality;
  implementationStatus?: ControlImplementationStatus;
  implementationNotes?:  string | null;
  testingNotes?:         string | null;
  ownerId?:              string | null;
  dueDate?:              string | null;
  reviewFrequencyDays?:  number;
  frameworkId?:          string | null;
}

export interface UpdateControlInput extends Partial<CreateControlInput> {
  lastReviewedAt?: string | null;
}

export interface ControlFilters {
  page?:        number;
  limit?:       number;
  status?:      ControlImplementationStatus;
  criticality?: ControlCriticality;
  frameworkId?: string;
  ownerId?:     string;
  q?:           string;
  category?:    string;
  sortBy?:      string;
  sortDir?:     'asc' | 'desc';
}

export interface ControlListResult {
  controls: Control[];
  total:    number;
  page:     number;
  limit:    number;
}

export interface ControlStatusCount {
  implementationStatus: ControlImplementationStatus;
  criticality:          ControlCriticality;
  count:                number;
}

export const CRITICALITY_CONFIG: Record<ControlCriticality, { label: string; color: string; bgColor: string }> = {
  critical: { label: 'Critical', color: 'text-red-700',    bgColor: 'bg-red-100' },
  high:     { label: 'High',     color: 'text-orange-700', bgColor: 'bg-orange-100' },
  medium:   { label: 'Medium',   color: 'text-blue-700',   bgColor: 'bg-blue-100' },
  low:      { label: 'Low',      color: 'text-slate-600',  bgColor: 'bg-slate-100' },
};

export const IMPLEMENTATION_STATUS_CONFIG: Record<
  ControlImplementationStatus,
  { label: string; color: string; bgColor: string }
> = {
  implemented:           { label: 'Implemented',           color: 'text-green-700',  bgColor: 'bg-green-100' },
  partially_implemented: { label: 'Partially Implemented', color: 'text-amber-700',  bgColor: 'bg-amber-100' },
  not_implemented:       { label: 'Not Implemented',       color: 'text-red-700',    bgColor: 'bg-red-100' },
  not_applicable:        { label: 'Not Applicable',        color: 'text-slate-500',  bgColor: 'bg-slate-100' },
  planned:               { label: 'Planned',               color: 'text-purple-700', bgColor: 'bg-purple-100' },
};
