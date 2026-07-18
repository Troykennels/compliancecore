import { z } from 'zod';

const uuidSchema = z.string().uuid();

const documentTypeEnum = z.enum(['policy', 'procedure', 'standard', 'guideline']);
const statusEnum = z.enum(['draft', 'in_review', 'approved', 'published', 'archived']);

export const createPolicySchema = z.object({
  title:               z.string().min(1).max(500),
  description:         z.string().max(5000).optional().nullable(),
  documentType:        documentTypeEnum.default('policy'),
  status:              statusEnum.default('draft'),
  content:             z.string().max(100000).optional().nullable(),
  ownerId:             uuidSchema.optional().nullable(),
  reviewDueDate:       z.coerce.date().optional().nullable(),
  reviewFrequencyDays: z.number().int().min(1).max(3650).optional().default(365),
  frameworkIds:        z.array(z.string().max(200)).optional().default([]),
  tags:                z.array(z.string().max(100)).optional().default([]),
});

export const updatePolicySchema = createPolicySchema.partial();

export const listPoliciesSchema = z.object({
  page:         z.coerce.number().int().min(1).optional().default(1),
  limit:        z.coerce.number().int().min(1).max(200).optional().default(50),
  status:       statusEnum.optional(),
  documentType: documentTypeEnum.optional(),
  ownerId:      uuidSchema.optional(),
  q:            z.string().max(500).optional(),
  sortBy:       z.enum(['title', 'status', 'document_type', 'review_due_date', 'updated_at']).optional().default('title'),
  sortDir:      z.enum(['asc', 'desc']).optional().default('asc'),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
export type ListPoliciesInput = z.infer<typeof listPoliciesSchema>;
