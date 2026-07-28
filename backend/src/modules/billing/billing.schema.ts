import { z } from 'zod';

// Zod schemas for the tenant-facing billing mutations. These run as route
// middleware so malformed/missing fields return 422 (not a 500 deep in the
// service) and unknown enum values (e.g. billingCycle) are rejected up front.

const BILLING_CYCLES = ['monthly', 'yearly'] as const;
const SUBSCRIPTION_STATUSES = ['trial', 'active', 'past_due', 'cancelled', 'paused'] as const;
const PAYMENT_METHOD_TYPES = ['card', 'bank_transfer', 'wire'] as const;

export const createSubscriptionSchema = z.object({
  planId: z.string().uuid('planId must be a valid id'),
  billingCycle: z.enum(BILLING_CYCLES, { errorMap: () => ({ message: 'Invalid billing cycle' }) }).optional(),
  couponCode: z.string().min(1).max(64).optional(),
  // trialDays is NOT accepted from clients. It used to be, which let a caller
  // POST {planId: <enterprise>, trialDays: 365} and self-grant a year of a paid
  // plan for free. Trial length is decided by the server (TRIAL_DAYS) when an
  // organisation is created; nothing else may set it.
});

export const updateSubscriptionSchema = z
  .object({
    planId: z.string().uuid('planId must be a valid id').optional(),
    billingCycle: z.enum(BILLING_CYCLES, { errorMap: () => ({ message: 'Invalid billing cycle' }) }).optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    status: z.enum(SUBSCRIPTION_STATUSES, { errorMap: () => ({ message: 'Invalid status' }) }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const applyCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required').max(64),
});

export const addPaymentMethodSchema = z.object({
  type: z.enum(PAYMENT_METHOD_TYPES, { errorMap: () => ({ message: 'Invalid payment method type' }) }),
  label: z.string().min(1, 'Label is required').max(100),
  last4: z.string().regex(/^\d{4}$/, 'last4 must be 4 digits').optional(),
  brand: z.string().max(50).optional(),
  expMonth: z.number().int().min(1).max(12).optional(),
  expYear: z.number().int().min(2000).max(2100).optional(),
  bankName: z.string().max(100).optional(),
  bankAccountLast4: z.string().regex(/^\d{4}$/, 'bankAccountLast4 must be 4 digits').optional(),
  setAsDefault: z.boolean().optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type AddPaymentMethodInput = z.infer<typeof addPaymentMethodSchema>;
