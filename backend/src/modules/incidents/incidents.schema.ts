import { z } from 'zod';

const uuidSchema = z.string().uuid();

const CATEGORIES = ['security','privacy','availability','integrity','third_party','physical','fraud','other'] as const;
const SEVERITIES = ['critical','high','medium','low'] as const;
const STATUSES   = ['open','investigating','contained','resolved','closed'] as const;
const ENTRY_TYPES = ['note','status_change','severity_change','containment','notification','assignment','evidence'] as const;

export const createIncidentSchema = z.object({
  title:            z.string().min(1).max(500),
  description:      z.string().max(20000).optional().nullable(),
  category:         z.enum(CATEGORIES).default('security'),
  severity:         z.enum(SEVERITIES).default('medium'),
  status:           z.enum(STATUSES).default('open'),
  occurredAt:       z.coerce.date().optional().nullable(),
  // Awareness time drives the statutory clock, so it is settable (an incident is
  // often logged after the fact) but defaults to now.
  detectedAt:       z.coerce.date().optional(),
  isDataBreach:     z.boolean().optional().default(false),
  affectedDataSubjects: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
  notificationDeadlineHours: z.number().int().min(1).max(8760).optional().default(72),
  assignedTo:       uuidSchema.optional().nullable(),
  rootCause:        z.string().max(20000).optional().nullable(),
  remediation:      z.string().max(20000).optional().nullable(),
  lessonsLearned:   z.string().max(20000).optional().nullable(),
  affectedSystems:  z.array(z.string().max(200)).max(100).optional().default([]),
  tags:             z.array(z.string().max(100)).max(50).optional().default([]),
});

export const updateIncidentSchema = createIncidentSchema.partial().extend({
  containedAt:              z.coerce.date().optional().nullable(),
  resolvedAt:               z.coerce.date().optional().nullable(),
  regulatorNotifiedAt:      z.coerce.date().optional().nullable(),
  dataSubjectsNotifiedAt:   z.coerce.date().optional().nullable(),
});

export const listIncidentsSchema = z.object({
  page:     z.coerce.number().int().min(1).optional().default(1),
  limit:    z.coerce.number().int().min(1).max(200).optional().default(50),
  status:   z.enum(STATUSES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  category: z.enum(CATEGORIES).optional(),
  assignedTo: uuidSchema.optional(),
  isDataBreach: z.coerce.boolean().optional(),
  /** Only incidents past their notification deadline and not yet reported. */
  overdueNotification: z.coerce.boolean().optional(),
  q:        z.string().max(500).optional(),
  sortBy:   z.enum(['detected_at','severity','status','reference','updated_at']).optional().default('detected_at'),
  sortDir:  z.enum(['asc','desc']).optional().default('desc'),
});

export const addIncidentUpdateSchema = z.object({
  body:      z.string().min(1).max(20000),
  entryType: z.enum(ENTRY_TYPES).optional().default('note'),
});

export type CreateIncidentInput    = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput    = z.infer<typeof updateIncidentSchema>;
export type ListIncidentsInput     = z.infer<typeof listIncidentsSchema>;
export type AddIncidentUpdateInput = z.infer<typeof addIncidentUpdateSchema>;
