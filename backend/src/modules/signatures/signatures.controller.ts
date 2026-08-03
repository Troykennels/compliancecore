import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './signatures.service';
import { validate } from '../../lib/validate';
import { AppError } from '../../lib/errors';

const listSigSchema = z.object({
  isValid: z.preprocess((v) => v === 'true' ? true : v === 'false' ? false : undefined, z.boolean().optional()),
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(100).default(20),
});

const createSigSchema = z.object({
  documentType:   z.string().min(1).max(100),
  documentId:     z.string().uuid(),
  // Optional: the server derives the authoritative digest from the stored
  // record. When present it is checked against that digest, so a client that
  // renders a stale copy is told to reload rather than signing something the
  // user never saw.
  documentHash:   z.string().length(64).optional(),
  signatureImage: z.string().optional(),
});

const revokeSchema = z.object({ reason: z.string().min(1).max(500) });

export async function listSignatures(req: Request, res: Response) {
  const filters = validate(listSigSchema, req.query);
  const result = await service.listSignatures(req.tenant!.schemaName, filters as { isValid?: boolean; page?: number; limit?: number });
  res.json({ success: true, data: result });
}

export async function getSignature(req: Request, res: Response) {
  const sig = await service.getSignature(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: sig });
}

export async function getDocumentSignatures(req: Request, res: Response) {
  const { type, id } = req.params;
  const sigs = await service.getDocumentSignatures(req.tenant!.schemaName, type, id);
  res.json({ success: true, data: sigs });
}

export async function createSignature(req: Request, res: Response) {
  const dto = validate(createSigSchema, req.body);
  const sig = await service.createSignature(req.tenant!.schemaName, req.user!.id, {
    ...dto,
    ipAddress:  req.ip ?? '',
    userAgent:  req.headers['user-agent'] ?? '',
  });
  res.status(201).json({ success: true, data: sig });
}

export async function verifySignature(req: Request, res: Response) {
  const result = await service.verifySignature(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: result });
}

export async function revokeSignature(req: Request, res: Response) {
  const { reason } = validate(revokeSchema, req.body);
  const sig = await service.revokeSignature(req.tenant!.schemaName, req.params.id, req.user!.id, reason);
  res.json({ success: true, data: sig });
}
