import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const createAuditSchema = z.object({
  title:        z.string().min(1).max(500),
  auditType:    z.enum(['internal', 'external', 'certification', 'surveillance']).default('internal'),
  frameworkRef: z.string().max(100).optional().nullable(),
  status:       z.enum(['planned', 'in_progress', 'completed', 'cancelled']).default('planned'),
  auditorName:  z.string().max(255).optional().nullable(),
  scope:        z.string().max(10000).optional().nullable(),
  summary:      z.string().max(10000).optional().nullable(),
  startDate:    z.coerce.date().optional().nullable(),
  endDate:      z.coerce.date().optional().nullable(),
  ownerId:      uuidSchema.optional().nullable(),
});

export const updateAuditSchema = createAuditSchema.partial();

export const listAuditsSchema = z.object({
  page:      z.coerce.number().int().min(1).optional().default(1),
  limit:     z.coerce.number().int().min(1).max(200).optional().default(50),
  status:    z.enum(['planned', 'in_progress', 'completed', 'cancelled']).optional(),
  auditType: z.enum(['internal', 'external', 'certification', 'surveillance']).optional(),
  ownerId:   uuidSchema.optional(),
  q:         z.string().max(500).optional(),
  sortBy:    z.enum(['title', 'audit_type', 'status', 'start_date', 'end_date', 'updated_at']).optional().default('updated_at'),
  sortDir:   z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createFindingSchema = z.object({
  title:          z.string().min(1).max(500),
  description:    z.string().max(10000).optional().nullable(),
  severity:       z.enum(['critical', 'high', 'medium', 'low', 'observation']).default('medium'),
  status:         z.enum(['open', 'in_remediation', 'resolved', 'accepted']).default('open'),
  recommendation: z.string().max(10000).optional().nullable(),
  ownerId:        uuidSchema.optional().nullable(),
  dueDate:        z.coerce.date().optional().nullable(),
});

export const updateFindingSchema = createFindingSchema.partial();

export type CreateAuditInput   = z.infer<typeof createAuditSchema>;
export type UpdateAuditInput   = z.infer<typeof updateAuditSchema>;
export type ListAuditsInput    = z.infer<typeof listAuditsSchema>;
export type CreateFindingInput = z.infer<typeof createFindingSchema>;
export type UpdateFindingInput = z.infer<typeof updateFindingSchema>;
