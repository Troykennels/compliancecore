export type TaskStatus   = 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Task {
  id:              string;
  title:           string;
  description:     string | null;
  status:          TaskStatus;
  priority:        TaskPriority;
  assignedTo:      string | null;
  assigneeName:    string | null;
  assigneeEmail:   string | null;
  dueDate:         string | null;
  completedAt:     string | null;
  entityType:      string | null;
  entityId:        string | null;
  parentTaskId:    string | null;
  tags:            string[];
  isRecurring:     boolean;
  recurrenceRule:  string | null;
  subtaskCount:    number;
  completedSubtasks: number;
  commentCount:    number;
  createdBy:       string;
  createdByName:   string | null;
  createdAt:       string;
  updatedAt:       string;
}

export interface TaskComment {
  id:         string;
  taskId:     string;
  userId:     string;
  userName:   string | null;
  body:       string;
  isInternal: boolean;
  editedAt:   string | null;
  createdAt:  string;
}

export interface TaskStats {
  total:       number;
  todo:        number;
  in_progress: number;
  in_review:   number;
  completed:   number;
  cancelled:   number;
  overdue:     number;
}

export interface CreateTaskDto {
  title:        string;
  description?: string;
  status?:      TaskStatus;
  priority?:    TaskPriority;
  assignedTo?:  string;
  dueDate?:     string;
  entityType?:  string;
  entityId?:    string;
  parentTaskId?:string;
  tags?:        string[];
  isRecurring?: boolean;
  recurrenceRule?: string;
}

export type UpdateTaskDto = Partial<CreateTaskDto>;

export interface TaskFilters {
  status?:     TaskStatus;
  priority?:   TaskPriority;
  assignedTo?: string;
  entityType?: string;
  entityId?:   string;
  parentId?:   string;
  page?:       number;
  limit?:      number;
}

export interface TasksListResponse {
  items: Task[];
  total: number;
  page:  number;
  limit: number;
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  todo:        { label: 'To Do',       color: 'text-slate-600', bgColor: 'bg-slate-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-700',  bgColor: 'bg-blue-100'  },
  in_review:   { label: 'In Review',   color: 'text-purple-700',bgColor: 'bg-purple-100'},
  completed:   { label: 'Completed',   color: 'text-green-700', bgColor: 'bg-green-100' },
  cancelled:   { label: 'Cancelled',   color: 'text-slate-500', bgColor: 'bg-slate-100' },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dotColor: string }> = {
  critical: { label: 'Critical', color: 'text-red-700',    dotColor: 'bg-red-500' },
  high:     { label: 'High',     color: 'text-orange-700', dotColor: 'bg-orange-500' },
  medium:   { label: 'Medium',   color: 'text-blue-700',   dotColor: 'bg-blue-500' },
  low:      { label: 'Low',      color: 'text-slate-600',  dotColor: 'bg-slate-400' },
};
