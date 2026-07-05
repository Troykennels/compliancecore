import crypto from 'crypto';
import { withTenantSchema } from '../../lib/tenant';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';

export interface CreateSignatureInput {
  userId:         string;
  documentType:   string;
  documentId:     string;
  documentHash:   string;
  signatureImage?: string;
  ipAddress:      string;
  userAgent:      string;
}

export interface DigitalSignature {
  id:              string;
  userId:          string;
  signerName:      string | null;
  signerEmail:     string | null;
  documentType:    string;
  documentId:      string;
  documentHash:    string;
  signatureHash:   string;
  signatureImage:  string | null;
  certificateData: Record<string, unknown>;
  ipAddress:       string | null;
  userAgent:       string | null;
  signedAt:        string;
  isValid:         boolean;
  revokedAt:       string | null;
  revokedBy:       string | null;
  revocationReason:string | null;
  createdAt:       string;
}

// Server-only key from the validated env. There is NO fallback: a missing
// SIGNATURE_SECRET fails startup (see config/env.ts), which is what makes the
// HMAC certificate impossible to forge offline.
const SIGNATURE_SECRET = env.SIGNATURE_SECRET;

// The certificate binds every identifying field of the signing act. `signedAt`
// is server-generated at signing time (never client-supplied), so a signature
// can neither be forged (secret is server-only) nor back-dated via the API.
export function generateSignatureHash(
  documentType: string,
  documentId: string,
  documentHash: string,
  userId: string,
  signedAt: string,
): string {
  return crypto
    .createHmac('sha256', SIGNATURE_SECRET)
    .update(`${documentType}:${documentId}:${documentHash}:${userId}:${signedAt}`)
    .digest('hex');
}

export function verifySignatureHash(
  signatureHash: string,
  documentType: string,
  documentId: string,
  documentHash: string,
  userId: string,
  signedAt: string,
): boolean {
  const expected = generateSignatureHash(documentType, documentId, documentHash, userId, signedAt);
  const a = Buffer.from(signatureHash, 'hex');
  const b = Buffer.from(expected, 'hex');
  // timingSafeEqual throws on length mismatch — guard so a malformed/foreign
  // hash returns false instead of crashing the request.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function createSignature(
  schemaName: string,
  input: CreateSignatureInput,
): Promise<string> {
  return withTenantSchema(schemaName, async (prisma) => {
    const signedAt = new Date().toISOString();
    const signatureHash = generateSignatureHash(
      input.documentType, input.documentId, input.documentHash, input.userId, signedAt,
    );

    // Idempotency / non-repudiation guard: one valid signature per
    // (document, signer). Prevents duplicate legally-meaningful signatures from
    // a double-submit or replay.
    const [existing] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM digital_signatures
        WHERE document_type = $1 AND document_id = $2 AND user_id = $3 AND is_valid = TRUE
        LIMIT 1`,
      input.documentType, input.documentId, input.userId,
    );
    if (existing) {
      throw new AppError('You have already signed this document', 409);
    }

    const [user] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT first_name, last_name, email FROM global.users WHERE id = $1`, input.userId,
    );

    const certificateData = {
      version:      '1.0',
      algorithm:    'HMAC-SHA256',
      signerName:   user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : null,
      signerEmail:  user?.email ?? null,
      signedAt,
      ipAddress:    input.ipAddress,
      userAgent:    input.userAgent,
      documentType: input.documentType,
      documentId:   input.documentId,
    };

    const [row] = await prisma.$queryRawUnsafe<any[]>(`
      INSERT INTO digital_signatures(
        user_id, document_type, document_id, document_hash,
        signature_hash, signature_image, certificate_data, ip_address, user_agent, signed_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
    `,
      input.userId, input.documentType, input.documentId, input.documentHash,
      signatureHash, input.signatureImage ?? null,
      JSON.stringify(certificateData),
      input.ipAddress || null, input.userAgent || null, signedAt,
    );
    return row.id as string;
  });
}

export async function findSignatureById(schemaName: string, id: string): Promise<DigitalSignature | null> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT ds.*,
             u.first_name || ' ' || u.last_name AS signer_name,
             u.email AS signer_email
      FROM digital_signatures ds
      LEFT JOIN global.users u ON u.id = ds.user_id
      WHERE ds.id = $1
    `, id);
    if (!rows.length) return null;
    return mapSignature(rows[0]);
  });
}

export async function findSignaturesForDocument(
  schemaName: string,
  documentType: string,
  documentId: string,
): Promise<DigitalSignature[]> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT ds.*,
             u.first_name || ' ' || u.last_name AS signer_name,
             u.email AS signer_email
      FROM digital_signatures ds
      LEFT JOIN global.users u ON u.id = ds.user_id
      WHERE ds.document_type = $1 AND ds.document_id = $2
      ORDER BY ds.signed_at DESC
    `, documentType, documentId);
    return rows.map(mapSignature);
  });
}

export interface FindSignaturesFilters {
  userId?:  string;
  isValid?: boolean;
  page?:    number;
  limit?:   number;
}

export async function findSignatures(
  schemaName: string,
  filters: FindSignaturesFilters = {},
): Promise<{ items: DigitalSignature[]; total: number }> {
  return withTenantSchema(schemaName, async (prisma) => {
    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (filters.userId !== undefined)  { conditions.push(`ds.user_id = $${p++}`);  params.push(filters.userId); }
    if (filters.isValid !== undefined) { conditions.push(`ds.is_valid = $${p++}`); params.push(filters.isValid); }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit  = filters.limit  ?? 20;
    const offset = ((filters.page ?? 1) - 1) * limit;

    const [countRow] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS total FROM digital_signatures ds ${where}`, ...params,
    );
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT ds.*,
             u.first_name || ' ' || u.last_name AS signer_name,
             u.email AS signer_email
      FROM digital_signatures ds
      LEFT JOIN global.users u ON u.id = ds.user_id
      ${where}
      ORDER BY ds.signed_at DESC
      LIMIT $${p++} OFFSET $${p++}
    `, ...params, limit, offset);

    return { items: rows.map(mapSignature), total: countRow.total ?? 0 };
  });
}

export async function revokeSignature(
  schemaName: string,
  id: string,
  revokedBy: string,
  reason: string,
): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    // State-conditional: only revoke a currently-valid signature. A 0-row
    // result means it was already revoked (or never existed) — treat as a
    // conflict rather than a silent no-op "success".
    const affected = await prisma.$executeRawUnsafe(`
      UPDATE digital_signatures
      SET is_valid = FALSE, revoked_at = NOW(), revoked_by = $2, revocation_reason = $3
      WHERE id = $1 AND is_valid = TRUE
    `, id, revokedBy, reason);
    if (affected === 0) {
      throw new AppError('Signature not found or already revoked', 409);
    }
  });
}

function mapSignature(r: any): DigitalSignature {
  return {
    id: r.id, userId: r.user_id, signerName: r.signer_name ?? null,
    signerEmail: r.signer_email ?? null, documentType: r.document_type,
    documentId: r.document_id, documentHash: r.document_hash,
    signatureHash: r.signature_hash, signatureImage: r.signature_image,
    certificateData: r.certificate_data ?? {}, ipAddress: r.ip_address,
    userAgent: r.user_agent, signedAt: r.signed_at, isValid: r.is_valid,
    revokedAt: r.revoked_at, revokedBy: r.revoked_by,
    revocationReason: r.revocation_reason, createdAt: r.created_at,
  };
}
