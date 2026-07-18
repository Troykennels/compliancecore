import { z } from 'zod';

const uuidSchema = z.string().uuid();

const scaleSchema = z.coerce.number().int().min(1).max(5);

export const createRiskSchema = z.object({
  title:               z.string().min(1).max(500),
  description:         z.string().max(10000).optional().nullable(),
  category:            z.enum([
    'operational', 'strategic', 'financial', 'compliance',
    'security', 'privacy', 'reputational', 'third_party',
  ]).default('operational'),
  inherentLikelihood:  scaleSchema.optional().default(3),
  inherentImpact:      scaleSchema.optional().default(3),
  treatment:           z.enum(['mitigate', 'accept', 'transfer', 'avoid']).default('mitigate'),
  residualLikelihood:  scaleSchema.optional().default(3),
  residualImpact:      scaleSchema.optional().default(3),
  status:              z.enum([
    'open', 'in_treatment', 'mitigated', 'accepted', 'closed',
  ]).default('open'),
  mitigationPlan:      z.string().max(10000).optional().nullable(),
  ownerId:             uuidSchema.optional().nullable(),
  reviewDate:          z.coerce.date().optional().nullable(),
  nextReviewDate:      z.coerce.date().optional().nullable(),
});

export const updateRiskSchema = createRiskSchema.partial();

export const listRisksSchema = z.object({
  page:      z.coerce.number().int().min(1).optional().default(1),
  limit:     z.coerce.number().int().min(1).max(200).optional().default(50),
  status:    z.enum([
    'open', 'in_treatment', 'mitigated', 'accepted', 'closed',
  ]).optional(),
  category:  z.enum([
    'operational', 'strategic', 'financial', 'compliance',
    'security', 'privacy', 'reputational', 'third_party',
  ]).optional(),
  ownerId:   uuidSchema.optional(),
  q:         z.string().max(500).optional(),
  sortBy:    z.enum(['title', 'category', 'inherent_score', 'residual_score', 'status', 'updated_at']).optional().default('inherent_score'),
  sortDir:   z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateRiskInput = z.infer<typeof createRiskSchema>;
export type UpdateRiskInput = z.infer<typeof updateRiskSchema>;
export type ListRisksInput  = z.infer<typeof listRisksSchema>;
