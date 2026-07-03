import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const createControlSchema = z.object({
  frameworkId:          uuidSchema.optional().nullable(),
  controlRef:           z.string().min(1).max(100),
  title:                z.string().min(1).max(500),
  description:          z.string().max(5000).optional().nullable(),
  category:             z.string().max(200).optional().nullable(),
  guidance:             z.string().max(10000).optional().nullable(),
  criticality:          z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  implementationStatus: z.enum([
    'implemented', 'partially_implemented', 'not_implemented', 'not_applicable', 'planned',
  ]).default('not_implemented'),
  implementationNotes:  z.string().max(5000).optional().nullable(),
  testingNotes:         z.string().max(5000).optional().nullable(),
  ownerId:              uuidSchema.optional().nullable(),
  dueDate:              z.coerce.date().optional().nullable(),
  reviewFrequencyDays:  z.number().int().min(1).max(3650).optional().default(365),
});

export const updateControlSchema = createControlSchema.partial().extend({
  lastReviewedAt: z.coerce.date().optional().nullable(),
});

export const listControlsSchema = z.object({
  page:                 z.coerce.number().int().min(1).optional().default(1),
  limit:                z.coerce.number().int().min(1).max(200).optional().default(50),
  frameworkId:          uuidSchema.optional(),
  status:               z.enum([
    'implemented', 'partially_implemented', 'not_implemented', 'not_applicable', 'planned',
  ]).optional(),
  criticality:          z.enum(['critical', 'high', 'medium', 'low']).optional(),
  ownerId:              uuidSchema.optional(),
  q:                    z.string().max(500).optional(),
  category:             z.string().max(200).optional(),
  dueBefore:            z.coerce.date().optional(),
  sortBy:               z.enum(['control_ref', 'title', 'criticality', 'due_date', 'updated_at']).optional().default('control_ref'),
  sortDir:              z.enum(['asc', 'desc']).optional().default('asc'),
});

export type CreateControlInput  = z.infer<typeof createControlSchema>;
export type UpdateControlInput  = z.infer<typeof updateControlSchema>;
export type ListControlsInput   = z.infer<typeof listControlsSchema>;
