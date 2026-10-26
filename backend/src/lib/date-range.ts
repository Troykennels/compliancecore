import type { RefinementCtx } from 'zod';
import { AppError } from './errors';

type Range = { startDate?: Date | null; endDate?: Date | null };
export function refineDateRange(value: Range, ctx: RefinementCtx): void {
  if (value.startDate && value.endDate && value.endDate.getTime() < value.startDate.getTime()) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after the start date.' });
  }
}
export function assertDateRange(value: Range): void {
  if (value.startDate && value.endDate && new Date(value.endDate).getTime() < new Date(value.startDate).getTime()) {
    throw new AppError('End date must be on or after the start date.', 422, 'INVALID_DATE_RANGE');
  }
}
