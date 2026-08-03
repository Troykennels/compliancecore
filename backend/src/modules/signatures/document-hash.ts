import crypto from 'node:crypto';
import { withTenantSchema } from '../../lib/tenant';
import { ValidationError } from '../../lib/errors';

/**
 * Server-side derivation of the digest a signature attests to.
 *
 * A signature is only evidence if the thing signed is pinned by the server. When
 * the digest is supplied by the caller, the certificate proves nothing more than
 * "this user sent us 64 hex characters" — an altered document can be re-signed
 * against its original hash, and verification still passes. So the hash is
 * recomputed here from the record as it exists in the database, and the
 * client-supplied value is only ever used as a cross-check.
 *
 * Each document type declares the fields that constitute its signable content.
 * Adding a type without adding it here is deliberately a hard error rather than
 * a silent fallback: signing something we cannot pin is the failure mode this
 * module exists to prevent.
 */

// Column list per signable type. Order matters — it is part of the canonical form.
const SIGNABLE: Record<string, { table: string; columns: string[] }> = {
  policy:   { table: 'policies', columns: ['id', 'title', 'description', 'document_type', 'status', 'content', 'current_version'] },
  control:  { table: 'controls', columns: ['id', 'control_ref', 'title', 'description', 'implementation_status', 'implementation_notes'] },
  risk:     { table: 'risks',    columns: ['id', 'title', 'description', 'category', 'inherent_score', 'residual_score', 'treatment', 'status', 'mitigation_plan'] },
  vendor:   { table: 'vendors',  columns: ['id', 'name', 'description', 'category', 'risk_level', 'status', 'data_processed', 'services_provided'] },
  audit:    { table: 'audits',   columns: ['id', 'title', 'description', 'status'] },
  training: { table: 'trainings', columns: ['id', 'title', 'description', 'status'] },
  // Evidence is signed against the immutable checksum of its stored file rather
  // than its mutable metadata — that is what an auditor actually cares about.
  evidence: { table: 'evidence', columns: ['id', 'title', 'status'] },
};

export function isSignableType(documentType: string): boolean {
  return Object.hasOwn(SIGNABLE, documentType);
}

export function signableTypes(): string[] {
  return Object.keys(SIGNABLE);
}

/** SHA-256 over a stable JSON encoding of the record's signable columns. */
function digest(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function resolveDocumentHash(
  schemaName: string,
  documentType: string,
  documentId: string,
): Promise<string> {
  const spec = SIGNABLE[documentType];
  if (!spec) {
    throw new ValidationError(
      `Documents of type "${documentType}" cannot be signed. Signable types: ${signableTypes().join(', ')}.`,
    );
  }

  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${spec.columns.join(', ')} FROM ${spec.table} WHERE id = $1::uuid AND deleted_at IS NULL`,
      documentId,
    );
    if (!rows.length) {
      throw new ValidationError(`No ${documentType} found with id ${documentId}.`);
    }

    const row = rows[0];
    // Normalise to [column, value] pairs in the declared order so the digest does
    // not depend on driver key ordering or on columns added to the table later.
    const canonical = spec.columns.map((c) => [c, row[c] ?? null]);

    if (documentType === 'evidence') {
      // Bind the file itself: the checksum of the current version. Without it the
      // signature would cover only the title and survive a file replacement.
      const versions = await prisma.$queryRawUnsafe<{ checksum_sha256: string | null; version_number: number }[]>(
        `SELECT checksum_sha256, version_number FROM evidence_versions
          WHERE evidence_id = $1::uuid AND upload_status = 'completed'
          ORDER BY version_number DESC LIMIT 1`,
        documentId,
      );
      canonical.push(['file_checksum', versions[0]?.checksum_sha256 ?? null]);
      canonical.push(['file_version', versions[0]?.version_number ?? null]);
    }

    return digest(canonical);
  });
}
