import { z } from 'zod';

const uuidSchema = z.string().uuid();

const ENTITY_TYPES = [
  'certificate','policy','contract','evidence','license','insurance',
  'vendor_agreement','api_key','domain','iso_certification','soc2_report','custom',
] as const;

export const createExpiryItemSchema = z.object({
  name:         z.string().min(1).max(500),
  description:  z.string().max(5000).optional().nullable(),
  entityType:   z.enum(ENTITY_TYPES).default('custom'),
  entityId:     uuidSchema.optional().nullable(),
  expiryDate:   z.coerce.date(),
  renewalDate:  z.coerce.date().optional().nullable(),
  ownerId:      uuidSchema.optional().nullable(),
  reminderDays: z.array(z.number().int().min(0).max(365)).max(10).optional().default([90,60,30,14,7]),
  notes:        z.string().max(5000).optional().nullable(),
});

export const updateExpiryItemSchema = createExpiryItemSchema.partial().extend({
  status: z.enum(['active','expiring_soon','expired','renewed','cancelled']).optional(),
});

export const listExpiryItemsSchema = z.object({
  page:       z.coerce.number().int().min(1).optional().default(1),
  limit:      z.coerce.number().int().min(1).max(200).optional().default(50),
  entityType: z.enum(ENTITY_TYPES).optional(),
  status:     z.enum(['active','expiring_soon','expired','renewed','cancelled']).optional(),
  ownerId:    uuidSchema.optional(),
  expiringWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  q:          z.string().max(500).optional(),
  sortBy:     z.enum(['expiry_date','name','entity_type','status']).optional().default('expiry_date'),
  sortDir:    z.enum(['asc','desc']).optional().default('asc'),
});

export type CreateExpiryItemInput = z.infer<typeof createExpiryItemSchema>;
export type UpdateExpiryItemInput = z.infer<typeof updateExpiryItemSchema>;
export type ListExpiryItemsInput  = z.infer<typeof listExpiryItemsSchema>;
