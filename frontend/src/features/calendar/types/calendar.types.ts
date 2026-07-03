export type CalendarEventType =
  | 'deadline' | 'review' | 'audit' | 'training' | 'renewal'
  | 'assessment' | 'meeting' | 'other';

export type CalendarEventStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
export type CalendarEventPriority = 'critical' | 'high' | 'medium' | 'low';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  eventType: CalendarEventType;
  status: CalendarEventStatus;
  startDate: string;
  endDate: string | null;
  allDay: boolean;
  isRecurring: boolean;
  recurrenceRule: string | null;
  frameworkId: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  priority: CalendarEventPriority;
  color: string;
  reminderDays: number[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalendarEventDto {
  title: string;
  description?: string | null;
  eventType?: CalendarEventType;
  startDate: string;
  endDate?: string | null;
  allDay?: boolean;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  frameworkId?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  assignedTo?: string | null;
  priority?: CalendarEventPriority;
  color?: string;
  reminderDays?: number[];
}

export interface CalendarFilters {
  from?: string;
  to?: string;
  eventType?: CalendarEventType;
  status?: CalendarEventStatus;
  assignedTo?: string;
  frameworkId?: string;
  priority?: CalendarEventPriority;
}

export const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  deadline:   '#EF4444',
  review:     '#F59E0B',
  audit:      '#8B5CF6',
  training:   '#10B981',
  renewal:    '#3B82F6',
  assessment: '#EC4899',
  meeting:    '#6B7280',
  other:      '#64748B',
};

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  deadline:   'Deadline',
  review:     'Review',
  audit:      'Audit',
  training:   'Training',
  renewal:    'Renewal',
  assessment: 'Assessment',
  meeting:    'Meeting',
  other:      'Other',
};

export const STATUS_LABELS: Record<CalendarEventStatus, string> = {
  upcoming:    'Upcoming',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
  overdue:     'Overdue',
};
