import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const createTrainingSchema = z.object({
  title:           z.string().min(1).max(500),
  description:     z.string().max(10000).optional().nullable(),
  category:        z.string().max(100).optional().nullable(),
  provider:        z.string().max(255).optional().nullable(),
  durationMinutes: z.number().int().min(0).max(1000000).optional().nullable(),
  isMandatory:     z.boolean().optional().default(false),
  frequencyDays:   z.number().int().min(1).max(3650).optional().nullable(),
  status:          z.enum(['active', 'archived']).default('active'),
  ownerId:         uuidSchema.optional().nullable(),
});

export const updateTrainingSchema = createTrainingSchema.partial();

export const listTrainingsSchema = z.object({
  page:        z.coerce.number().int().min(1).optional().default(1),
  limit:       z.coerce.number().int().min(1).max(200).optional().default(50),
  status:      z.enum(['active', 'archived']).optional(),
  isMandatory: z.coerce.boolean().optional(),
  ownerId:     uuidSchema.optional(),
  q:           z.string().max(500).optional(),
  category:    z.string().max(100).optional(),
  sortBy:      z.enum(['title', 'category', 'provider', 'status', 'created_at', 'updated_at']).optional().default('title'),
  sortDir:     z.enum(['asc', 'desc']).optional().default('asc'),
});

export const assignTrainingRecordsSchema = z.object({
  userIds: z.array(uuidSchema).min(1).max(1000),
  dueDate: z.coerce.date().optional().nullable(),
  status:  z.enum(['assigned', 'in_progress', 'completed', 'overdue']).optional().default('assigned'),
});

export type CreateTrainingInput          = z.infer<typeof createTrainingSchema>;
export type UpdateTrainingInput          = z.infer<typeof updateTrainingSchema>;
export type ListTrainingsInput           = z.infer<typeof listTrainingsSchema>;
export type AssignTrainingRecordsInput   = z.infer<typeof assignTrainingRecordsSchema>;
