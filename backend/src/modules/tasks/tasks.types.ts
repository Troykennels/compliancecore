export type TaskStatus   = 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assignedBy: string | null;
  assignerName: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  entityType: string | null;
  entityId: string | null;
  frameworkId: string | null;
  parentTaskId: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  tags: string[];
  isRecurring: boolean;
  recurrenceRule: string | null;
  completedAt: string | null;
  subtaskCount: number;
  completedSubtasks: number;
  commentCount: number;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks?: Task[];
  comments?: TaskComment[];
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  body: string;
  isInternal: boolean;
  editedAt: string | null;
  createdAt: string;
}

export interface CreateTaskDto {
  title:          string;
  description?:   string;
  assignedTo?:    string | null;
  dueDate?:       string;
  priority?:      TaskPriority;
  entityType?:    string;
  entityId?:      string;
  frameworkId?:   string;
  parentTaskId?:  string;
  estimatedHours?:number;
  tags?:          string[];
  isRecurring?:   boolean;
  recurrenceRule?:string;
}

export interface UpdateTaskDto extends Partial<CreateTaskDto> {
  status?:      TaskStatus;
  actualHours?: number;
}

export interface TaskFilters {
  status?:      TaskStatus;
  priority?:    TaskPriority;
  assignedTo?:  string;
  entityType?:  string;
  entityId?:    string;
  frameworkId?: string;
  dueBefore?:   string;
  dueAfter?:    string;
  overdue?:     boolean;
  myTasks?:     boolean;
  page?:        number;
  limit?:       number;
  q?:           string;
  parentTaskId?:string;
}

export interface AddCommentDto {
  body:        string;
  isInternal?: boolean;
}
