import crypto from 'crypto';
import { withTenantSchema } from '../../lib/tenant';

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

const SIGNATURE_SECRET = process.env.SIGNATURE_SECRET ?? process.env.JWT_SECRET ?? 'changeme';

export function generateSignatureHash(
  documentHash: string,
  userId: string,
  signedAt: string,
): string {
  return crypto
    .createHmac('sha256', SIGNATURE_SECRET)
    .update(`${documentHash}:${userId}:${signedAt}`)
    .digest('hex');
}

export function verifySignatureHash(
  signatureHash: string,
  documentHash: string,
  userId: string,
  signedAt: string,
): boolean {
  const expected = generateSignatureHash(documentHash, userId, signedAt);
  return crypto.timingSafeEqual(Buffer.from(signatureHash, 'hex'), Buffer.from(expected, 'hex'));
}

export async function createSignature(
  schemaName: string,
  input: CreateSignatureInput,
): Promise<string> {
  return withTenantSchema(schemaName, async (prisma) => {
    const signedAt = new Date().toISOString();
    const signatureHash = generateSignatureHash(input.documentHash, input.userId, signedAt);

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
    await prisma.$executeRawUnsafe(`
      UPDATE digital_signatures
      SET is_valid = FALSE, revoked_at = NOW(), revoked_by = $2, revocation_reason = $3
      WHERE id = $1
    `, id, revokedBy, reason);
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
