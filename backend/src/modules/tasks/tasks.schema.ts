import { z } from 'zod';

const priority = z.enum(['critical','high','medium','low']).default('medium');
const status   = z.enum(['todo','in_progress','in_review','completed','cancelled','blocked']);

export const createTaskSchema = z.object({
  title:          z.string().min(1).max(1000),
  description:    z.string().max(10000).optional(),
  assignedTo:     z.string().uuid().optional().nullable(),
  dueDate:        z.string().datetime().optional(),
  priority,
  entityType:     z.string().max(100).optional(),
  entityId:       z.string().uuid().optional(),
  frameworkId:    z.string().uuid().optional(),
  parentTaskId:   z.string().uuid().optional(),
  estimatedHours: z.number().positive().optional(),
  tags:           z.array(z.string().max(100)).optional(),
  isRecurring:    z.boolean().optional(),
  recurrenceRule: z.string().max(200).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  status:      status.optional(),
  actualHours: z.number().positive().optional(),
});

export const addCommentSchema = z.object({
  body:       z.string().min(1).max(10000),
  isInternal: z.boolean().default(false),
});

export const listTasksSchema = z.object({
  status:      status.optional(),
  priority:    z.enum(['critical','high','medium','low']).optional(),
  assignedTo:  z.string().uuid().optional(),
  entityType:  z.string().optional(),
  entityId:    z.string().uuid().optional(),
  frameworkId: z.string().uuid().optional(),
  dueBefore:   z.string().optional(),
  dueAfter:    z.string().optional(),
  overdue:     z.coerce.boolean().optional(),
  myTasks:     z.coerce.boolean().optional(),
  parentTaskId:z.string().uuid().optional(),
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(25),
  q:           z.string().optional(),
});
