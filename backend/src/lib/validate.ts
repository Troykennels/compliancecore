import type { ZodSchema } from 'zod';
import { ValidationError } from './errors';

/**
 * Parse `data` against a Zod schema, returning the typed value on success.
 * On failure throws the app's ValidationError (HTTP 422) with the flattened
 * field errors as details — handled centrally by the error middleware.
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.flatten());
  }
  return result.data;
}
