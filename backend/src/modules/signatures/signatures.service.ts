import * as repo from './signatures.repository';
import { verifySignatureHash } from './signatures.repository';
import { resolveDocumentHash } from './document-hash';
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
    /** Optional cross-check only — the authoritative digest is derived server-side. */
    documentHash?:  string;
    signatureImage?: string;
    ipAddress:      string;
    userAgent:      string;
  },
) {
  // The digest is derived from the stored record, never taken from the caller —
  // see document-hash.ts for why a client-supplied hash makes the certificate
  // worthless as evidence.
  const documentHash = await resolveDocumentHash(schemaName, input.documentType, input.documentId);

  // When the client sends a hash it is treated as a claim about what the signer
  // was actually looking at. A mismatch means the document changed between being
  // displayed and being signed, so the signature would attest to something the
  // user never saw — refuse rather than silently sign the newer version.
  if (input.documentHash !== undefined) {
    if (!SHA256_HEX.test(input.documentHash)) {
      throw new ValidationError('documentHash must be a 64-character hex SHA-256 digest.');
    }
    if (input.documentHash.toLowerCase() !== documentHash) {
      throw new AppError(
        'This document has changed since it was opened. Reload it and review the current version before signing.',
        409,
        'DOCUMENT_CHANGED',
      );
    }
  }

  const id = await repo.createSignature(schemaName, { ...input, documentHash, userId });
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
