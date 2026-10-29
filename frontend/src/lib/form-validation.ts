import { z } from 'zod';

export const optionalDuration = z.preprocess(value => value === '' || value === null ? undefined : value, z.coerce.number().int().min(0).max(1000000).optional());
export const optionalFrequency = z.preprocess(value => value === '' || value === null ? undefined : value, z.coerce.number().int().min(1).max(3650).optional());
export function refineDateStrings(value: { startDate?: string; endDate?: string }, ctx: z.RefinementCtx) {
  if (value.startDate && value.endDate && new Date(value.endDate).getTime() < new Date(value.startDate).getTime()) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after the start date.' });
  }
}
