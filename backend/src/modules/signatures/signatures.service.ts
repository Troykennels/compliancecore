import * as repo from './signatures.repository';
import { verifySignatureHash } from './signatures.repository';
import { AppError } from '../../lib/errors';

export async function listSignatures(
  schemaName: string,
  filters: { isValid?: boolean; page?: number; limit?: number },
) {
  return repo.findSignatures(schemaName, filters);
}

export async function getSignature(schemaName: string, id: string) {
  const sig = await repo.findSignatureById(schemaName, id);
  if (!sig) throw new AppError('Signature not found', 404);
  return sig;
}

export async function getDocumentSignatures(schemaName: string, documentType: string, documentId: string) {
  return repo.findSignaturesForDocument(schemaName, documentType, documentId);
}

export async function createSignature(
  schemaName: string,
  userId: string,
  input: {
    documentType:   string;
    documentId:     string;
    documentHash:   string;
    signatureImage?: string;
    ipAddress:      string;
    userAgent:      string;
  },
) {
  const id = await repo.createSignature(schemaName, { ...input, userId });
  return repo.findSignatureById(schemaName, id);
}

export async function verifySignature(schemaName: string, id: string) {
  const sig = await repo.findSignatureById(schemaName, id);
  if (!sig) throw new AppError('Signature not found', 404);

  if (!sig.isValid) {
    return { valid: false, reason: 'Signature has been revoked', signature: sig };
  }

  const isHashValid = verifySignatureHash(
    sig.signatureHash,
    sig.documentType,
    sig.documentId,
    sig.documentHash,
    sig.userId,
    sig.signedAt,
  );

  return {
    valid: isHashValid,
    reason: isHashValid ? 'Signature is authentic and unmodified' : 'Signature hash mismatch — document may have been altered',
    signature: sig,
  };
}

export async function revokeSignature(
  schemaName: string,
  id: string,
  revokedBy: string,
  reason: string,
) {
  const sig = await repo.findSignatureById(schemaName, id);
  if (!sig) throw new AppError('Signature not found', 404);
  if (!sig.isValid) throw new AppError('Signature is already revoked', 400);
  await repo.revokeSignature(schemaName, id, revokedBy, reason);
  return repo.findSignatureById(schemaName, id);
}
