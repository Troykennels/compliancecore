import { z } from 'zod';

const uuidSchema = z.string().uuid();

// ── Evidence CRUD ─────────────────────────────────────────────────────────────

export const initiateUploadSchema = z.object({
  title:        z.string().min(1, 'Title is required').max(500),
  description:  z.string().max(5000).optional().nullable(),
  categoryId:   uuidSchema.optional().nullable(),
  tagIds:       z.array(uuidSchema).max(20).optional().default([]),
  isConfidential: z.boolean().optional().default(false),
  retentionDate: z.coerce.date().optional().nullable(),
  collectedAt:  z.coerce.date().optional().nullable(),
  collectedBy:  uuidSchema.optional().nullable(),
  // File metadata provided by the browser before upload
  fileName:  z.string().min(1).max(500),
  fileSize:  z.number().int().min(1).max(200 * 1024 * 1024, 'File must be under 200 MB'),
  mimeType:  z.string().min(1).max(100),
  changeNote: z.string().max(500).optional().nullable(),
});

export const confirmUploadSchema = z.object({
  checksumSha256: z.string().length(64).optional().nullable(),
  fileSizeBytes:  z.number().int().min(0).optional(),
});

export const updateEvidenceSchema = z.object({
  title:         z.string().min(1).max(500).optional(),
  description:   z.string().max(5000).optional().nullable(),
  categoryId:    uuidSchema.optional().nullable(),
  isConfidential: z.boolean().optional(),
  retentionDate: z.coerce.date().optional().nullable(),
  collectedAt:   z.coerce.date().optional().nullable(),
  collectedBy:   uuidSchema.optional().nullable(),
  status:        z.enum(['active', 'archived', 'expired']).optional(),
});

export const addVersionSchema = z.object({
  fileName:    z.string().min(1).max(500),
  fileSize:    z.number().int().min(1).max(200 * 1024 * 1024),
  mimeType:    z.string().min(1).max(100),
  changeNote:  z.string().max(500).optional().nullable(),
});

// ── Search & Listing ──────────────────────────────────────────────────────────

export const listEvidenceSchema = z.object({
  page:       z.coerce.number().int().min(1).optional().default(1),
  limit:      z.coerce.number().int().min(1).max(100).optional().default(20),
  q:          z.string().max(500).optional(),      // full-text search query
  categoryId: uuidSchema.optional(),
  tagIds:     z.string().optional(),               // comma-separated UUIDs
  status:     z.enum(['active', 'archived', 'expired']).optional(),
  mimeType:   z.string().optional(),               // filter by file type group
  ocrStatus:  z.enum(['pending', 'processing', 'completed', 'failed', 'not_applicable']).optional(),
  uploadedBy: uuidSchema.optional(),
  dateFrom:   z.coerce.date().optional(),
  dateTo:     z.coerce.date().optional(),
  sortBy:     z.enum(['created_at', 'updated_at', 'title', 'file_size']).optional().default('created_at'),
  sortDir:    z.enum(['asc', 'desc']).optional().default('desc'),
});

// ── Tags ──────────────────────────────────────────────────────────────────────

export const createTagSchema = z.object({
  name:  z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional().default('#64748B'),
});

export const addTagToEvidenceSchema = z.object({
  tagId: uuidSchema,
});

// ── Categories ────────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#6366F1'),
  icon:        z.string().max(50).optional().default('file'),
  sortOrder:   z.number().int().min(0).optional().default(100),
});

export const updateCategorySchema = createCategorySchema.partial();

// ── Links ─────────────────────────────────────────────────────────────────────

export const addLinkSchema = z.object({
  linkedType: z.enum(['control', 'risk', 'policy', 'audit', 'vendor']),
  linkedId:   uuidSchema,
});

// ── Sharing ───────────────────────────────────────────────────────────────────

export const createShareSchema = z.object({
  shareType:       z.enum(['link', 'email']).optional().default('link'),
  recipientEmail:  z.string().email().max(255).optional().nullable(),
  expiresAt:       z.coerce.date().min(new Date(), 'Expiry must be in the future').optional().nullable(),
  password:        z.string().min(4).max(100).optional().nullable(),
});

export const accessShareSchema = z.object({
  password: z.string().optional(),
});

export type InitiateUploadInput  = z.infer<typeof initiateUploadSchema>;
export type ConfirmUploadInput   = z.infer<typeof confirmUploadSchema>;
export type UpdateEvidenceInput  = z.infer<typeof updateEvidenceSchema>;
export type AddVersionInput      = z.infer<typeof addVersionSchema>;
export type ListEvidenceInput    = z.infer<typeof listEvidenceSchema>;
export type CreateTagInput       = z.infer<typeof createTagSchema>;
export type CreateCategoryInput  = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput  = z.infer<typeof updateCategorySchema>;
export type AddLinkInput         = z.infer<typeof addLinkSchema>;
export type CreateShareInput     = z.infer<typeof createShareSchema>;
