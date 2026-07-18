export type TrainingStatus = 'active' | 'archived';

export type TrainingRecordStatus =
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'overdue';

export interface TrainingProgram {
  id:              string;
  title:           string;
  description:     string | null;
  category:        string | null;
  provider:        string | null;
  durationMinutes: number | null;
  isMandatory:     boolean;
  frequencyDays:   number | null;
  status:          TrainingStatus;
  ownerId:         string | null;
  ownerName:       string | null;
  ownerEmail:      string | null;
  createdBy:       string | null;
  updatedBy:       string | null;
  createdAt:       string;
  updatedAt:       string;
}

export interface TrainingRecord {
  id:          string;
  programId:   string;
  userId:      string;
  userName:    string | null;
  userEmail:   string | null;
  status:      TrainingRecordStatus;
  score:       number | null;
  assignedAt:  string;
  dueDate:     string | null;
  completedAt: string | null;
  createdAt:   string;
}

export interface CreateTrainingInput {
  title:            string;
  description?:     string | null;
  category?:        string | null;
  provider?:        string | null;
  durationMinutes?: number | null;
  isMandatory?:     boolean;
  frequencyDays?:   number | null;
  status?:          TrainingStatus;
  ownerId?:         string | null;
}

export type UpdateTrainingInput = Partial<CreateTrainingInput>;

export interface AssignTrainingRecordsInput {
  userIds: string[];
  dueDate?: string | null;
  status?: TrainingRecordStatus;
}

export interface TrainingFilters {
  page?:        number;
  limit?:       number;
  status?:      TrainingStatus;
  isMandatory?: boolean;
  ownerId?:     string;
  q?:           string;
  category?:    string;
  sortBy?:      string;
  sortDir?:     'asc' | 'desc';
}

export interface TrainingProgramListResult {
  programs: TrainingProgram[];
  total:    number;
  page:     number;
  limit:    number;
}

export const TRAINING_STATUS_CONFIG: Record<TrainingStatus, { label: string; color: string; bgColor: string }> = {
  active:   { label: 'Active',   color: 'text-green-700', bgColor: 'bg-green-100' },
  archived: { label: 'Archived', color: 'text-slate-500', bgColor: 'bg-slate-100' },
};

export const TRAINING_RECORD_STATUS_CONFIG: Record<
  TrainingRecordStatus,
  { label: string; color: string; bgColor: string }
> = {
  assigned:    { label: 'Assigned',    color: 'text-slate-600',  bgColor: 'bg-slate-100' },
  in_progress: { label: 'In Progress', color: 'text-amber-700',  bgColor: 'bg-amber-100' },
  completed:   { label: 'Completed',   color: 'text-green-700',  bgColor: 'bg-green-100' },
  overdue:     { label: 'Overdue',     color: 'text-red-700',    bgColor: 'bg-red-100' },
};
