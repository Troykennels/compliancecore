export type TrainingStatus = 'active' | 'archived';

export type TrainingRecordStatus =
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'overdue';

export interface TrainingProgram {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  provider: string | null;
  durationMinutes: number | null;
  isMandatory: boolean;
  frequencyDays: number | null;
  status: TrainingStatus;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingProgramListResult {
  programs: TrainingProgram[];
  total: number;
  page: number;
  limit: number;
}

export interface TrainingRecord {
  id: string;
  programId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  status: TrainingRecordStatus;
  score: number | null;
  assignedAt: Date;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}
