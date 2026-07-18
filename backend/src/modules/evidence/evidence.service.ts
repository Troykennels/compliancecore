import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import {
  NotFoundError, ForbiddenError, ConflictError, ValidationError, UnauthorizedError,
} from '../../lib/errors';
import { evidenceRepository } from './evidence.repository';
import {
  evidenceFileKey,
  generateUploadUrl,
  generateDownloadUrl,
  verifyUpload,
  OCR_SUPPORTED_MIME_TYPES,
  PREVIEW_MIME_TYPES,
  OFFICE_PREVIEW_MIME_TYPES,
  ACCEPTED_MIME_TYPES,
  getS3BaseUrl,
} from '../../lib/storage';
import { enqueueOcrJob } from '../../jobs/ocr.job';
import type {
  InitiateUploadInput, ConfirmUploadInput, UpdateEvidenceInput,
  AddVersionInput, ListEvidenceInput, CreateTagInput,
  CreateCategoryInput, UpdateCategoryInput, AddLinkInput, CreateShareInput,
} from './evidence.schema';
import type { InitiateUploadResult, PreviewUrlResult, ShareResult } from './evidence.types';
import { email as emailClient } from '../../lib/email';
import { env } from '../../config/env';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

// ── Upload Flow ───────────────────────────────────────────────────────────────

export const evidenceService = {
  async listCategories(schemaName: string) {
    return withTenantSchema(schemaName, (tx) => evidenceRepository.listCategories(tx));
  },

  async createCategory(schemaName: string, input: CreateCategoryInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      return evidenceRepository.createCategory(tx, { ...input, createdBy: actor.id });
    });
  },

  async updateCategory(schemaName: string, id: string, input: UpdateCategoryInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const updated = await evidenceRepository.updateCategory(tx, id, input);
      if (!updated) throw new NotFoundError('Category not found or is a system category (cannot be modified).');
      return updated;
    });
  },

  async deleteCategory(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const deleted = await evidenceRepository.deleteCategory(tx, id);
      if (!deleted) throw new NotFoundError('Category not found or is a system category (cannot be deleted).');
    });
  },

  async listTags(schemaName: string) {
    return withTenantSchema(schemaName, (tx) => evidenceRepository.listTags(tx));
  },

  async createTag(schemaName: string, input: CreateTagInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      return evidenceRepository.createTag(tx, { ...input, createdBy: actor.id });
    });
  },

  async deleteTag(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const deleted = await evidenceRepository.deleteTag(tx, id);
      if (!deleted) throw new NotFoundError('Tag not found.');
    });
  },

  // Step 1 of 3: Create evidence record + version record, return presigned PUT URL
  async initiateUpload(
    schemaName: string,
    input: InitiateUploadInput,
    actor: Actor,
  ): Promise<InitiateUploadResult> {
    if (!ACCEPTED_MIME_TYPES[input.mimeType]) {
      throw new ValidationError(`File type "${input.mimeType}" is not accepted.`);
    }

    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      // Create the evidence record (status pending until confirmed)
      const { id: evidenceId } = await evidenceRepository.create(tx, {
        title:         input.title,
        description:   input.description,
        categoryId:    input.categoryId,
        isConfidential: input.isConfidential ?? false,
        retentionDate: input.retentionDate,
        collectedAt:   input.collectedAt,
        collectedBy:   input.collectedBy,
        createdBy:     actor.id,
      });

      // Create version record
      const fileKey = evidenceFileKey(actor.tenantId!, evidenceId, crypto.randomUUID(), input.fileName);
      const { id: versionId } = await evidenceRepository.createVersion(tx, {
        evidenceId,
        fileName:   input.fileName,
        fileKey,
        mimeType:   input.mimeType,
        changeNote: input.changeNote,
        uploadedBy: actor.id,
      });

      // Apply initial tags
      for (const tagId of input.tagIds) {
        await evidenceRepository.addTag(tx, evidenceId, tagId, actor.id);
      }

      // Log initiation event
      await evidenceRepository.logEvent(tx, {
        evidenceId, eventType: 'uploaded',
        actorId: actor.id, actorEmail: actor.email,
        metadata: { versionId, fileName: input.fileName, fileSize: input.fileSize },
      });

      // Generate presigned PUT URL (after transaction — S3 call outside DB tx)
      // We generate AFTER committing the version record so the record always exists
      const { uploadUrl, expiresAt } = await generateUploadUrl(fileKey, input.mimeType);

      return { evidenceId, versionId, uploadUrl, fileKey, expiresAt };
    });
  },

  // Step 2 of 3: Browser uploads file directly to S3 (handled by frontend)

  // Step 3 of 3: Confirm the upload succeeded, verify with S3 HEAD, queue OCR
  async confirmUpload(
    schemaName: string,
    evidenceId: string,
    versionId: string,
    input: ConfirmUploadInput,
    actor: Actor,
  ) {
    const evidence = await withTenantSchema(schemaName, async (tx) => {
      const versions = await evidenceRepository.listVersions(tx, evidenceId);
      return versions.find((v) => v.id === versionId) ?? null;
    });

    if (!evidence) throw new NotFoundError('Version not found.');
    if (evidence.uploadStatus === 'completed') throw new ConflictError('Upload already confirmed.');

    // Verify the file actually exists in S3
    const s3Meta = await verifyUpload(evidence.fileKey);
    if (!s3Meta) {
      throw new ValidationError('File not found in storage. Ensure the upload completed before confirming.');
    }

    const version = await withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      await evidenceRepository.confirmVersion(tx, versionId, evidenceId, {
        fileSizeBytes:  input.fileSizeBytes ?? s3Meta.sizeBytes,
        checksumSha256: input.checksumSha256,
      });

      // Set OCR status based on whether the MIME type supports OCR
      const ocrApplicable = OCR_SUPPORTED_MIME_TYPES.has(evidence.mimeType);
      if (!ocrApplicable) {
        await tx.$executeRaw`
          UPDATE evidence SET ocr_status = 'not_applicable' WHERE id = ${evidenceId}::uuid
        `;
      }

      const versions = await evidenceRepository.listVersions(tx, evidenceId);
      return versions.find((v) => v.id === versionId)!;
    });

    // Queue OCR job outside the DB transaction (safe to enqueue after commit)
    if (OCR_SUPPORTED_MIME_TYPES.has(evidence.mimeType)) {
      await enqueueOcrJob({
        schemaName,
        evidenceId,
        versionId,
        fileKey:  evidence.fileKey,
        mimeType: evidence.mimeType,
      });
    }

    const fullEvidence = await withTenantSchema(schemaName, (tx) =>
      evidenceRepository.findById(tx, evidenceId),
    );

    return { evidence: fullEvidence, version };
  },

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async list(schemaName: string, filters: ListEvidenceInput) {
    return withTenantSchema(schemaName, (tx) => evidenceRepository.findAll(tx, filters));
  },

  async getById(schemaName: string, id: string, actor: Actor) {
    const ev = await withTenantSchema(schemaName, async (tx) => {
      const found = await evidenceRepository.findById(tx, id);
      if (!found) throw new NotFoundError('Evidence not found.');

      // Log view event
      await evidenceRepository.logEvent(tx, {
        evidenceId: id, eventType: 'viewed',
        actorId: actor.id, actorEmail: actor.email,
      });

      return found;
    });
    return ev;
  },

  async update(schemaName: string, id: string, input: UpdateEvidenceInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const exists = await evidenceRepository.findById(tx, id);
      if (!exists) throw new NotFoundError('Evidence not found.');

      await evidenceRepository.update(tx, id, { ...input, updatedBy: actor.id });

      await evidenceRepository.logEvent(tx, {
        evidenceId: id, eventType: 'updated',
        actorId: actor.id, actorEmail: actor.email,
        metadata: { changes: Object.keys(input) },
      });

      return evidenceRepository.findById(tx, id);
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const deleted = await evidenceRepository.softDelete(tx, id, actor.id);
      if (!deleted) throw new NotFoundError('Evidence not found.');
    });
  },

  // ── Versions ───────────────────────────────────────────────────────────────

  async listVersions(schemaName: string, evidenceId: string) {
    return withTenantSchema(schemaName, async (tx) => {
      const exists = await evidenceRepository.findById(tx, evidenceId);
      if (!exists) throw new NotFoundError('Evidence not found.');
      return evidenceRepository.listVersions(tx, evidenceId);
    });
  },

  // Add a new version to existing evidence (same flow as initial upload)
  async initiateVersionUpload(
    schemaName: string,
    evidenceId: string,
    input: AddVersionInput,
    actor: Actor,
  ): Promise<InitiateUploadResult> {
    if (!ACCEPTED_MIME_TYPES[input.mimeType]) {
      throw new ValidationError(`File type "${input.mimeType}" is not accepted.`);
    }

    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const exists = await evidenceRepository.findById(tx, evidenceId);
      if (!exists) throw new NotFoundError('Evidence not found.');

      const fileKey = evidenceFileKey(actor.tenantId!, evidenceId, crypto.randomUUID(), input.fileName);
      const { id: versionId } = await evidenceRepository.createVersion(tx, {
        evidenceId,
        fileName:   input.fileName,
        fileKey,
        mimeType:   input.mimeType,
        changeNote: input.changeNote,
        uploadedBy: actor.id,
      });

      await evidenceRepository.logEvent(tx, {
        evidenceId, eventType: 'version_added',
        actorId: actor.id, actorEmail: actor.email,
        metadata: { versionId, fileName: input.fileName },
      });

      const { uploadUrl, expiresAt } = await generateUploadUrl(fileKey, input.mimeType);
      return { evidenceId, versionId, uploadUrl, fileKey, expiresAt };
    });
  },

  // ── Preview & Download URLs ────────────────────────────────────────────────

  async getPreviewUrl(schemaName: string, evidenceId: string, actor: Actor): Promise<PreviewUrlResult> {
    const result = await withTenantSchema(schemaName, async (tx) => {
      const ev = await evidenceRepository.findById(tx, evidenceId);
      if (!ev) throw new NotFoundError('Evidence not found.');

      if (!ev.currentFileName || !ev.currentMimeType) {
        throw new ValidationError('Evidence has no confirmed file yet.');
      }

      // Find the current version's file key
      const versions = await evidenceRepository.listVersions(tx, evidenceId);
      const current = versions.find((v) => v.id === ev.currentVersionId);
      if (!current) throw new NotFoundError('Current version not found.');

      await evidenceRepository.logEvent(tx, {
        evidenceId, eventType: 'viewed',
        actorId: actor.id, actorEmail: actor.email,
        metadata: { action: 'preview' },
      });

      return { mimeType: ev.currentMimeType, fileName: ev.currentFileName, fileKey: current.fileKey };
    });

    const { mimeType, fileName, fileKey } = result;

    const downloadUrl = await generateDownloadUrl(fileKey, fileName, 'attachment', 3600);

    if (PREVIEW_MIME_TYPES.has(mimeType)) {
      const url = await generateDownloadUrl(fileKey, fileName, 'inline', 3600, mimeType);
      const previewType = mimeType.startsWith('image/')
        ? 'image'
        : mimeType === 'application/pdf'
          ? 'pdf'
          : 'text';
      return { url, officePreviewUrl: null, previewType, downloadUrl };
    }

    if (OFFICE_PREVIEW_MIME_TYPES.has(mimeType)) {
      const directUrl = await generateDownloadUrl(fileKey, fileName, 'inline', 3600, mimeType);
      const officePreviewUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(directUrl)}`;
      return { url: null, officePreviewUrl, previewType: 'office', downloadUrl };
    }

    return { url: null, officePreviewUrl: null, previewType: 'none', downloadUrl };
  },

  async getDownloadUrl(schemaName: string, evidenceId: string, actor: Actor): Promise<string> {
    return withTenantSchema(schemaName, async (tx) => {
      const ev = await evidenceRepository.findById(tx, evidenceId);
      if (!ev) throw new NotFoundError('Evidence not found.');

      const versions = await evidenceRepository.listVersions(tx, evidenceId);
      const current = versions.find((v) => v.id === ev.currentVersionId);
      if (!current) throw new NotFoundError('Current version not found.');

      await evidenceRepository.logEvent(tx, {
        evidenceId, eventType: 'downloaded',
        actorId: actor.id, actorEmail: actor.email,
        metadata: { fileName: ev.currentFileName },
      });

      return generateDownloadUrl(current.fileKey, ev.currentFileName!, 'attachment', 300);
    });
  },

  async getVersionDownloadUrl(
    schemaName: string, evidenceId: string, versionId: string, actor: Actor,
  ): Promise<string> {
    return withTenantSchema(schemaName, async (tx) => {
      const versions = await evidenceRepository.listVersions(tx, evidenceId);
      const version = versions.find((v) => v.id === versionId);
      if (!version) throw new NotFoundError('Version not found.');

      await evidenceRepository.logEvent(tx, {
        evidenceId, eventType: 'downloaded',
        actorId: actor.id, actorEmail: actor.email,
        metadata: { versionId, fileName: version.fileName },
      });

      return generateDownloadUrl(version.fileKey, version.fileName, 'attachment', 300);
    });
  },

  // ── Tags ───────────────────────────────────────────────────────────────────

  async addTag(schemaName: string, evidenceId: string, tagId: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await evidenceRepository.addTag(tx, evidenceId, tagId, actor.id);
      await evidenceRepository.logEvent(tx, {
        evidenceId, eventType: 'tagged',
        actorId: actor.id, actorEmail: actor.email, metadata: { tagId },
      });
    });
  },

  async removeTag(schemaName: string, evidenceId: string, tagId: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await evidenceRepository.removeTag(tx, evidenceId, tagId);
      await evidenceRepository.logEvent(tx, {
        evidenceId, eventType: 'untagged',
        actorId: actor.id, actorEmail: actor.email, metadata: { tagId },
      });
    });
  },

  // ── Links ──────────────────────────────────────────────────────────────────

  async addLink(schemaName: string, evidenceId: string, input: AddLinkInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await evidenceRepository.addLink(tx, {
        evidenceId, linkedType: input.linkedType, linkedId: input.linkedId, linkedBy: actor.id,
      });
      await evidenceRepository.logEvent(tx, {
        evidenceId, eventType: 'link_added',
        actorId: actor.id, actorEmail: actor.email,
        metadata: { linkedType: input.linkedType, linkedId: input.linkedId },
      });
    });
  },

  async removeLink(
    schemaName: string, evidenceId: string, linkedType: string, linkedId: string, actor: Actor,
  ) {
    return withTenantSchema(schemaName, async (tx) => {
      await evidenceRepository.removeLink(tx, evidenceId, linkedType, linkedId);
      await evidenceRepository.logEvent(tx, {
        evidenceId, eventType: 'link_removed',
        actorId: actor.id, actorEmail: actor.email,
        metadata: { linkedType, linkedId },
      });
    });
  },

  // ── Sharing ────────────────────────────────────────────────────────────────

  async createShare(
    schemaName: string, evidenceId: string, input: CreateShareInput, actor: Actor,
  ): Promise<ShareResult> {
    const shareToken = crypto.randomBytes(32).toString('hex');
    const passwordHash = input.password
      ? await bcrypt.hash(input.password, 10)
      : null;

    const share = await withTenantSchema(schemaName, async (tx) => {
      const ev = await evidenceRepository.findById(tx, evidenceId);
      if (!ev) throw new NotFoundError('Evidence not found.');

      await setAuditSessionVars(tx, actor);

      const created = await evidenceRepository.createShare(tx, {
        evidenceId,
        shareToken,
        shareType:      input.shareType ?? 'link',
        recipientEmail: input.recipientEmail,
        passwordHash,
        sharedBy:       actor.id,
        expiresAt:      input.expiresAt,
      });

      await evidenceRepository.logEvent(tx, {
        evidenceId, eventType: 'shared',
        actorId: actor.id, actorEmail: actor.email,
        metadata: { shareToken, shareType: input.shareType, recipientEmail: input.recipientEmail },
      });

      return created;
    });

    // The public share endpoint requires the tenant schema as a query param.
    // schemaName is the resolved tenant schema (e.g. "tenant_<uuid>").
    const shareUrl = `${env.FRONTEND_URL}/evidence/shared/${shareToken}?tenant=${schemaName}`;

    // Send email invite if share type is email
    if (input.shareType === 'email' && input.recipientEmail) {
      // email.sendEvidenceShareEmail (would be implemented alongside the email service)
      // For now we log — the invitation email is sent from the evidence share notification flow
    }

    return { share, shareUrl };
  },

  async listShares(schemaName: string, evidenceId: string) {
    return withTenantSchema(schemaName, async (tx) => {
      const ev = await evidenceRepository.findById(tx, evidenceId);
      if (!ev) throw new NotFoundError('Evidence not found.');
      return evidenceRepository.listShares(tx, evidenceId);
    });
  },

  async revokeShare(schemaName: string, evidenceId: string, shareId: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      const revoked = await evidenceRepository.revokeShare(tx, shareId, evidenceId);
      if (!revoked) throw new NotFoundError('Share not found.');
      await evidenceRepository.logEvent(tx, {
        evidenceId, eventType: 'share_revoked',
        actorId: actor.id, actorEmail: actor.email, metadata: { shareId },
      });
    });
  },

  // Public endpoint — validate share token and return access details
  async accessSharedEvidence(
    schemaName: string,
    shareToken: string,
    password: string | undefined,
  ) {
    return withTenantSchema(schemaName, async (tx) => {
      const share = await evidenceRepository.findShareByToken(tx, shareToken);
      if (!share) throw new NotFoundError('Share link not found or has been revoked.');

      if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
        throw new ForbiddenError('This share link has expired.');
      }

      if (share.passwordHash) {
        if (!password) throw new UnauthorizedError('This share link is password protected.');
        const valid = await bcrypt.compare(password, share.passwordHash);
        if (!valid) throw new UnauthorizedError('Incorrect password.');
      }

      const ev = await evidenceRepository.findById(tx, share.evidenceId);
      if (!ev) throw new NotFoundError('Evidence not found.');

      await evidenceRepository.touchShare(tx, share.id);
      await evidenceRepository.logEvent(tx, {
        evidenceId: share.evidenceId, eventType: 'share_accessed',
        actorId: null, actorEmail: null,
        metadata: { shareToken, accessCount: share.accessedCount + 1 },
      });

      // Find current version and mint a short-lived presigned download URL.
      // The recipient never sees the raw S3 key; the link is an attachment
      // (never inline) and expires in 5 minutes.
      const versions = await evidenceRepository.listVersions(tx, share.evidenceId);
      const current = versions.find((v) => v.id === ev.currentVersionId);
      const downloadUrl = current
        ? await generateDownloadUrl(current.fileKey, current.fileName, 'attachment', 300)
        : null;

      // Public (unauthenticated) response: never leak the bcrypt password hash
      // or the raw S3 file key. Expose only hasPassword and the presigned URL.
      const { passwordHash: _passwordHash, ...shareSafe } = share;
      const currentVersionSafe = current
        ? (() => {
            const { fileKey: _fileKey, ...rest } = current;
            return rest;
          })()
        : null;

      return { share: shareSafe, evidence: ev, currentVersion: currentVersionSafe, downloadUrl };
    });
  },

  // ── Audit Trail ────────────────────────────────────────────────────────────

  async getAuditTrail(schemaName: string, evidenceId: string, limit = 50) {
    return withTenantSchema(schemaName, async (tx) => {
      const ev = await evidenceRepository.findById(tx, evidenceId);
      if (!ev) throw new NotFoundError('Evidence not found.');
      return evidenceRepository.listEvents(tx, evidenceId, limit);
    });
  },

  // ── OCR Text ───────────────────────────────────────────────────────────────

  async getOcrText(schemaName: string, evidenceId: string) {
    return withTenantSchema(schemaName, async (tx) => {
      const rows = await tx.$queryRaw<[{ ocrText: string | null; ocrStatus: string }]>`
        SELECT ocr_text as "ocrText", ocr_status as "ocrStatus"
        FROM evidence WHERE id = ${evidenceId}::uuid AND deleted_at IS NULL
      `;
      if (!rows[0]) throw new NotFoundError('Evidence not found.');
      return rows[0];
    });
  },

  async retryOcr(schemaName: string, evidenceId: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      const ev = await evidenceRepository.findById(tx, evidenceId);
      if (!ev) throw new NotFoundError('Evidence not found.');
      if (!ev.currentVersionId) throw new ValidationError('No confirmed version to run OCR on.');

      const versions = await evidenceRepository.listVersions(tx, evidenceId);
      const current = versions.find((v) => v.id === ev.currentVersionId);
      if (!current) throw new NotFoundError('Current version not found.');

      if (!OCR_SUPPORTED_MIME_TYPES.has(current.mimeType)) {
        throw new ValidationError('OCR is not supported for this file type.');
      }

      await tx.$executeRaw`UPDATE evidence SET ocr_status = 'pending' WHERE id = ${evidenceId}::uuid`;

      await enqueueOcrJob({
        schemaName, evidenceId, versionId: current.id,
        fileKey: current.fileKey, mimeType: current.mimeType,
      });

      await evidenceRepository.logEvent(tx, {
        evidenceId, eventType: 'ocr_retried',
        actorId: actor.id, actorEmail: actor.email, metadata: {},
      });

      return { message: 'OCR queued.' };
    });
  },
};
