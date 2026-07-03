import { z } from 'zod';

const uuidSchema = z.string().uuid('Must be a valid UUID');

export const createDepartmentSchema = z.object({
  name: z
    .string()
    .min(1, 'Department name is required')
    .max(255, 'Name must be at most 255 characters'),
  code: z.string().max(50).optional().nullable(),
  branchId: uuidSchema.optional().nullable(),
  parentDepartmentId: uuidSchema.optional().nullable(),
  headUserId: uuidSchema.optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listDepartmentsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  search: z.string().max(100).optional(),
  branchId: uuidSchema.optional(),
  parentDepartmentId: uuidSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  tree: z.coerce.boolean().optional().default(false), // return hierarchy tree
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type ListDepartmentsInput = z.infer<typeof listDepartmentsSchema>;
