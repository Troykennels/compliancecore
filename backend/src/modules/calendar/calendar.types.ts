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
  startDate: Date;
  endDate: Date | null;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarEventListResult {
  events: CalendarEvent[];
  total: number;
}
