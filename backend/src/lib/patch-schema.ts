import { z } from "zod";

// Test undefined first so omitted PATCH fields bypass creation defaults.
// Supplied values retain every original field validation and refinement.
export function patchObject<T extends Record<string, z.ZodType>>(
  schema: z.ZodObject<T>,
) {
  const shape = {} as { [K in keyof T]: z.ZodOptional<z.ZodUnion<readonly [z.ZodUndefined, T[K]]>> };
  for (const key of Object.keys(schema.shape) as Array<keyof T>) {
    shape[key] = z.union([z.undefined(), schema.shape[key]]).optional();
  }
  return z.object(shape);
}
