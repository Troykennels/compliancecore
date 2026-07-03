import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const createCalendarEventSchema = z.object({
  title:            z.string().min(1).max(500),
  description:      z.string().max(5000).optional().nullable(),
  eventType:        z.enum(['deadline','review','audit','training','renewal','assessment','meeting','other']).default('other'),
  startDate:        z.coerce.date(),
  endDate:          z.coerce.date().optional().nullable(),
  allDay:           z.boolean().optional().default(false),
  isRecurring:      z.boolean().optional().default(false),
  recurrenceRule:   z.string().max(500).optional().nullable(),
  frameworkId:      uuidSchema.optional().nullable(),
  linkedEntityType: z.enum(['control','evidence','policy','audit','vendor','training','expiry_item']).optional().nullable(),
  linkedEntityId:   uuidSchema.optional().nullable(),
  assignedTo:       uuidSchema.optional().nullable(),
  priority:         z.enum(['critical','high','medium','low']).default('medium'),
  color:            z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#3B82F6'),
  reminderDays:     z.array(z.number().int().min(0).max(365)).max(10).optional().default([7, 1]),
});

export const updateCalendarEventSchema = createCalendarEventSchema.partial().extend({
  status: z.enum(['upcoming','in_progress','completed','cancelled','overdue']).optional(),
});

export const listCalendarEventsSchema = z.object({
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
  eventType:  z.enum(['deadline','review','audit','training','renewal','assessment','meeting','other']).optional(),
  status:     z.enum(['upcoming','in_progress','completed','cancelled','overdue']).optional(),
  assignedTo: uuidSchema.optional(),
  frameworkId: uuidSchema.optional(),
  priority:   z.enum(['critical','high','medium','low']).optional(),
});

export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;
export type ListCalendarEventsInput  = z.infer<typeof listCalendarEventsSchema>;
