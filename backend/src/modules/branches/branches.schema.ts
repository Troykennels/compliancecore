import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z
    .string()
    .min(1, 'Branch name is required')
    .max(255, 'Name must be at most 255 characters'),
  code: z.string().max(50).optional().nullable(),
  isHeadquarters: z.boolean().optional().default(false),
  country: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  timezone: z
    .string()
    .refine((tz) => {
      try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true; } catch { return false; }
    }, 'Invalid timezone')
    .optional()
    .default('UTC'),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email('Invalid email').max(255).optional().nullable(),
});

export const updateBranchSchema = createBranchSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listBranchesSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().max(100).optional(),
  isActive: z.coerce.boolean().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type ListBranchesInput = z.infer<typeof listBranchesSchema>;
