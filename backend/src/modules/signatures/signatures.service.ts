import * as repo from './signatures.repository';
import { verifySignatureHash } from './signatures.repository';
import { AppError, ValidationError } from '../../lib/errors';

// A SHA-256 digest rendered as lowercase/uppercase hex is exactly 64 hex chars.
const SHA256_HEX = /^[0-9a-fA-F]{64}$/;

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
  // The document hash is currently client-supplied. We cannot yet recompute it
  // server-side because the referenced document content is not addressable in a
  // uniform way across every documentType ('policy' | 'contract' | 'report' |
  // 'evidence' | 'approval_step'). Until each document source exposes a canonical
  // byte stream, enforce the minimum integrity guarantee: the hash MUST be a
  // well-formed 64-char hex SHA-256 digest, so a malformed/placeholder value can
  // never be bound into a legally-meaningful signature certificate.
  // TODO: recompute documentHash server-side from the referenced document
  //       (by documentType/documentId) and reject a mismatch, once a document
  //       content resolver exists for every documentType.
  if (!SHA256_HEX.test(input.documentHash)) {
    throw new ValidationError('documentHash must be a 64-character hex SHA-256 digest.');
  }

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
