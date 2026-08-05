import { Request, Response } from 'express';
import { z } from 'zod';
import { ok, created, noContent } from '../../lib/response';
import { evidenceService } from './evidence.service';

function actor(req: Request) {
  return {
    id:       req.user!.id,
    email:    req.user!.email,
    role:     req.user!.role ?? null,
    tenantId: req.user!.tenantId ?? null,
  };
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function listCategories(req: Request, res: Response) {
  const data = await evidenceService.listCategories(req.tenant!.schemaName);
  ok(res, req, data);
}

export async function createCategory(req: Request, res: Response) {
  const data = await evidenceService.createCategory(req.tenant!.schemaName, req.body, actor(req));
  created(res, req, data);
}

export async function updateCategory(req: Request, res: Response) {
  const data = await evidenceService.updateCategory(
    req.tenant!.schemaName, req.params.id, req.body, actor(req),
  );
  ok(res, req, data);
}

export async function deleteCategory(req: Request, res: Response) {
  await evidenceService.deleteCategory(req.tenant!.schemaName, req.params.id, actor(req));
  noContent(res);
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function listTags(req: Request, res: Response) {
  const data = await evidenceService.listTags(req.tenant!.schemaName);
  ok(res, req, data);
}

export async function createTag(req: Request, res: Response) {
  const data = await evidenceService.createTag(req.tenant!.schemaName, req.body, actor(req));
  created(res, req, data);
}

export async function deleteTag(req: Request, res: Response) {
  await evidenceService.deleteTag(req.tenant!.schemaName, req.params.id, actor(req));
  noContent(res);
}

// ── Evidence CRUD ─────────────────────────────────────────────────────────────

export async function listEvidence(req: Request, res: Response) {
  const data = await evidenceService.list(req.tenant!.schemaName, req.query as never);
  ok(res, req, data);
}

export async function getEvidence(req: Request, res: Response) {
  const data = await evidenceService.getById(req.tenant!.schemaName, req.params.id, actor(req));
  ok(res, req, data);
}

export async function updateEvidence(req: Request, res: Response) {
  const data = await evidenceService.update(
    req.tenant!.schemaName, req.params.id, req.body, actor(req),
  );
  ok(res, req, data);
}

export async function deleteEvidence(req: Request, res: Response) {
  await evidenceService.delete(req.tenant!.schemaName, req.params.id, actor(req));
  noContent(res);
}

// ── Upload Flow ───────────────────────────────────────────────────────────────

export async function initiateUpload(req: Request, res: Response) {
  const data = await evidenceService.initiateUpload(req.tenant!.schemaName, req.body, actor(req));
  created(res, req, data);
}

export async function confirmUpload(req: Request, res: Response) {
  const data = await evidenceService.confirmUpload(
    req.tenant!.schemaName, req.params.id, req.params.versionId, req.body, actor(req),
  );
  ok(res, req, data);
}

// ── Versions ──────────────────────────────────────────────────────────────────

export async function listVersions(req: Request, res: Response) {
  const data = await evidenceService.listVersions(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function initiateVersionUpload(req: Request, res: Response) {
  const data = await evidenceService.initiateVersionUpload(
    req.tenant!.schemaName, req.params.id, req.body, actor(req),
  );
  created(res, req, data);
}

// ── Preview & Download ────────────────────────────────────────────────────────

export async function getPreviewUrl(req: Request, res: Response) {
  const data = await evidenceService.getPreviewUrl(
    req.tenant!.schemaName, req.params.id, actor(req),
  );
  ok(res, req, data);
}

export async function getDownloadUrl(req: Request, res: Response) {
  const data = await evidenceService.getDownloadUrl(
    req.tenant!.schemaName, req.params.id, actor(req),
  );
  ok(res, req, { downloadUrl: data });
}

export async function getVersionDownloadUrl(req: Request, res: Response) {
  const data = await evidenceService.getVersionDownloadUrl(
    req.tenant!.schemaName, req.params.id, req.params.versionId, actor(req),
  );
  ok(res, req, { downloadUrl: data });
}

// ── Tags on Evidence ──────────────────────────────────────────────────────────

export async function addTagToEvidence(req: Request, res: Response) {
  await evidenceService.addTag(
    req.tenant!.schemaName, req.params.id, req.body.tagId, actor(req),
  );
  noContent(res);
}

export async function removeTagFromEvidence(req: Request, res: Response) {
  await evidenceService.removeTag(
    req.tenant!.schemaName, req.params.id, req.params.tagId, actor(req),
  );
  noContent(res);
}

// ── Links ─────────────────────────────────────────────────────────────────────

export async function addLink(req: Request, res: Response) {
  await evidenceService.addLink(
    req.tenant!.schemaName, req.params.id, req.body, actor(req),
  );
  noContent(res);
}

export async function removeLink(req: Request, res: Response) {
  await evidenceService.removeLink(
    req.tenant!.schemaName, req.params.id,
    req.params.linkedType, req.params.linkedId,
    actor(req),
  );
  noContent(res);
}

// ── Sharing ───────────────────────────────────────────────────────────────────

export async function createShare(req: Request, res: Response) {
  const data = await evidenceService.createShare(
    req.tenant!.schemaName, req.params.id, req.body, actor(req),
  );
  created(res, req, data);
}

export async function listShares(req: Request, res: Response) {
  const data = await evidenceService.listShares(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function revokeShare(req: Request, res: Response) {
  await evidenceService.revokeShare(
    req.tenant!.schemaName, req.params.id, req.params.shareId, actor(req),
  );
  noContent(res);
}

// Public share access (no auth required)
export async function accessShare(req: Request, res: Response) {
  const schemaName = req.query.tenant as string;
  if (!schemaName) {
    res.status(400).json({ success: false, error: 'Missing tenant parameter.' });
    return;
  }
  const data = await evidenceService.accessSharedEvidence(
    schemaName, req.params.token, req.body.password,
  );
  ok(res, req, data);
}

// ── OCR ───────────────────────────────────────────────────────────────────────

export async function getOcrText(req: Request, res: Response) {
  const data = await evidenceService.getOcrText(req.tenant!.schemaName, req.params.id);
  ok(res, req, data);
}

export async function retryOcr(req: Request, res: Response) {
  const data = await evidenceService.retryOcr(
    req.tenant!.schemaName, req.params.id, actor(req),
  );
  ok(res, req, data);
}

// ── Audit Trail ───────────────────────────────────────────────────────────────

// `limit` is interpolated straight into the SQL downstream, so a bare Number()
// was not enough: `?limit=-1` errored, and `?limit=abc` produced NaN, which
// binds as NULL — and LIMIT NULL means NO LIMIT, so the whole event history for
// that item came back. Coerced and capped like every other list endpoint.
const auditTrailQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function getAuditTrail(req: Request, res: Response) {
  const { limit } = auditTrailQuerySchema.parse(req.query);
  const data = await evidenceService.getAuditTrail(req.tenant!.schemaName, req.params.id, limit);
  ok(res, req, data);
}
