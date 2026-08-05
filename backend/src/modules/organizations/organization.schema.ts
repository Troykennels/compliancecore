import { z } from 'zod';

const ORG_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001+'] as const;

const TIMEZONES = Intl.supportedValuesOf
  ? Intl.supportedValuesOf('timeZone')
  : ['UTC']; // fallback for environments without Intl.supportedValuesOf

/**
 * Erasure confirmation.
 *
 * The organisation's name has to be typed back. It is the standard guard for an
 * action that cannot be undone, and it is the only thing standing between a
 * mis-click and a customer's entire compliance archive.
 */
export const requestErasureSchema = z.object({
  confirmName: z.string().min(1, 'Type the organisation name to confirm deletion'),
});

export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be at most 255 characters')
    .optional(),
  industry: z.string().max(100).optional().nullable(),
  website: z
    .string()
    .url('Must be a valid URL')
    .max(255)
    .optional()
    .nullable()
    .or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  size: z.enum(ORG_SIZES).optional().nullable(),
  logoUrl: z.string().url('Must be a valid URL').max(2048).optional().nullable(),
  timezone: z
    .string()
    .refine((tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Invalid timezone')
    .optional(),
  dateFormat: z
    .enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY'])
    .optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

// Payload for creating the caller's first organization during onboarding.
export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be at most 255 characters')
    .trim(),
  industry: z.string().max(100).optional(),
  size: z.enum(ORG_SIZES).optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
