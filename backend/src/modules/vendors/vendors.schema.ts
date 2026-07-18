import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const createVendorSchema = z.object({
  name:             z.string().min(1).max(500),
  description:      z.string().max(10000).optional().nullable(),
  category:         z.string().max(100).optional().nullable(),
  website:          z.string().max(500).optional().nullable(),
  contactName:      z.string().max(255).optional().nullable(),
  contactEmail:     z.string().email().max(320).optional().nullable().or(z.literal('')),
  riskLevel:        z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  status:           z.enum(['active', 'under_review', 'inactive', 'offboarded']).default('active'),
  dataProcessed:    z.string().max(10000).optional().nullable(),
  servicesProvided: z.string().max(10000).optional().nullable(),
  ownerId:          uuidSchema.optional().nullable(),
  onboardedAt:      z.coerce.date().optional().nullable(),
  offboardedAt:     z.coerce.date().optional().nullable(),
  nextReviewDate:   z.coerce.date().optional().nullable(),
});

export const updateVendorSchema = createVendorSchema.partial();

export const listVendorsSchema = z.object({
  page:      z.coerce.number().int().min(1).optional().default(1),
  limit:     z.coerce.number().int().min(1).max(200).optional().default(50),
  status:    z.enum(['active', 'under_review', 'inactive', 'offboarded']).optional(),
  riskLevel: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  ownerId:   uuidSchema.optional(),
  q:         z.string().max(500).optional(),
  category:  z.string().max(100).optional(),
  sortBy:    z.enum(['name', 'risk_level', 'status', 'next_review_date', 'updated_at']).optional().default('name'),
  sortDir:   z.enum(['asc', 'desc']).optional().default('asc'),
});

export const createVendorAssessmentSchema = z.object({
  name:       z.string().min(1).max(500),
  status:     z.enum(['pending', 'in_progress', 'completed', 'expired']).default('pending'),
  score:      z.number().int().min(0).max(100).optional().nullable(),
  notes:      z.string().max(10000).optional().nullable(),
  assessedAt: z.coerce.date().optional().nullable(),
  dueDate:    z.coerce.date().optional().nullable(),
});

export type CreateVendorInput            = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput            = z.infer<typeof updateVendorSchema>;
export type ListVendorsInput             = z.infer<typeof listVendorsSchema>;
export type CreateVendorAssessmentInput  = z.infer<typeof createVendorAssessmentSchema>;
