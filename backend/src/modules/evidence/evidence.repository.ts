import { Prisma } from '@prisma/client';
import type {
  Evidence,
  EvidenceVersion,
  EvidenceCategory,
  EvidenceTag,
  EvidenceAuditEvent,
  EvidenceShare,
  EvidenceStatus,
} from './evidence.types';
import type { ListEvidenceInput } from './evidence.schema';

// All queries run inside withTenantSchema, so search_path is already set.

export const evidenceRepository = {
  // ── Categories ─────────────────────────────────────────────────────────────

  async listCategories(tx: Prisma.TransactionClient): Promise<EvidenceCategory[]> {
    return tx.$queryRaw<EvidenceCategory[]>`
      SELECT id, name, description, color, icon,
             is_system as "isSystem", sort_order as "sortOrder"
      FROM evidence_categories
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC, name ASC
    `;
  },

  async createCategory(
    tx: Prisma.TransactionClient,
    data: {
      name: string; description?: string | null; color: string;
      icon: string; sortOrder: number; createdBy: string;
    },
  ): Promise<EvidenceCategory> {
    const rows = await tx.$queryRaw<EvidenceCategory[]>`
      INSERT INTO evidence_categories (name, description, color, icon, sort_order, created_by)
      VALUES (${data.name}, ${data.description ?? null}, ${data.color}, ${data.icon},
              ${data.sortOrder}, ${data.createdBy}::uuid)
      RETURNING id, name, description, color, icon,
                is_system as "isSystem", sort_order as "sortOrder"
    `;
    return rows[0];
  },

  async updateCategory(
    tx: Prisma.TransactionClient,
    id: string,
    data: Partial<{ name: string; description: string | null; color: string; icon: string; sortOrder: number }>,
  ): Promise<EvidenceCategory | null> {
    const rows = await tx.$queryRaw<EvidenceCategory[]>`
      UPDATE evidence_categories SET
        name        = COALESCE(${data.name ?? null}, name),
        description = CASE WHEN ${data.description !== undefined}::boolean THEN ${data.description ?? null} ELSE description END,
        color       = COALESCE(${data.color ?? null}, color),
        icon        = COALESCE(${data.icon ?? null}, icon),
        sort_order  = COALESCE(${data.sortOrder ?? null}::integer, sort_order)
      WHERE id = ${id}::uuid AND is_system = FALSE AND deleted_at IS NULL
      RETURNING id, name, description, color, icon,
                is_system as "isSystem", sort_order as "sortOrder"
    `;
    return rows[0] ?? null;
  },

  async deleteCategory(tx: Prisma.TransactionClient, id: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE evidence_categories
      SET deleted_at = NOW()
      WHERE id = ${id}::uuid AND is_system = FALSE AND deleted_at IS NULL
    `;
    return result === 1;
  },

  // ── Tags ───────────────────────────────────────────────────────────────────

  async listTags(tx: Prisma.TransactionClient): Promise<EvidenceTag[]> {
    return tx.$queryRaw<EvidenceTag[]>`
      SELECT id, name, color FROM evidence_tags ORDER BY name ASC
    `;
  },

  async createTag(
    tx: Prisma.TransactionClient,
    data: { name: string; color: string; createdBy: string },
  ): Promise<EvidenceTag> {
    const rows = await tx.$queryRaw<EvidenceTag[]>`
      INSERT INTO evidence_tags (name, color, created_by)
      VALUES (${data.name}, ${data.color}, ${data.createdBy}::uuid)
      ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color
      RETURNING id, name, color
    `;
    return rows[0];
  },

  async deleteTag(tx: Prisma.TransactionClient, id: string): Promise<boolean> {
    const result = await tx.$executeRaw`DELETE FROM evidence_tags WHERE id = ${id}::uuid`;
    return result === 1;
  },

  // ── Evidence List (with FTS, filters, pagination) ──────────────────────────

  async findAll(
    tx: Prisma.TransactionClient,
    filters: ListEvidenceInput,
  ): Promise<{ evidence: Evidence[]; total: number }> {
    const { page, limit, q, categoryId, status, uploadedBy, dateFrom, dateTo, sortBy, sortDir } = filters;
    const offset = (page - 1) * limit;
    const tagIds = filters.tagIds ? filters.tagIds.split(',').filter(Boolean) : [];

    const conditions: string[] = ['e.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (q) {
      conditions.push(`e.search_vector @@ plainto_tsquery('english', $${idx++})`);
      params.push(q);
    }
    if (categoryId) {
      conditions.push(`e.category_id = $${idx++}::uuid`);
      params.push(categoryId);
    }
    if (status) {
      conditions.push(`e.status = $${idx++}`);
      params.push(status);
    }
    if (uploadedBy) {
      conditions.push(`e.created_by = $${idx++}::uuid`);
      params.push(uploadedBy);
    }
    if (dateFrom) {
      conditions.push(`e.created_at >= $${idx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`e.created_at <= $${idx++}`);
      params.push(dateTo);
    }
    if (tagIds.length > 0) {
      conditions.push(`e.id IN (
        SELECT evidence_id FROM evidence_tag_links
        WHERE tag_id = ANY($${idx++}::uuid[])
        GROUP BY evidence_id
        HAVING COUNT(DISTINCT tag_id) = ${tagIds.length}
      )`);
      params.push(tagIds);
    }

    const where = conditions.join(' AND ');
    const orderClause = `e.${sortBy} ${sortDir.toUpperCase()}`;

    const [rows, countRows] = await Promise.all([
      tx.$queryRawUnsafe<Evidence[]>(
        `SELECT
           e.id, e.title, e.description, e.status,
           e.is_confidential as "isConfidential",
           e.retention_date as "retentionDate",
           e.collected_at as "collectedAt",
           e.collected_by as "collectedBy",
           e.current_version_id as "currentVersionId",
           e.ocr_status as "ocrStatus",
           e.created_by as "createdBy",
           e.created_at as "createdAt",
           e.updated_at as "updatedAt",
           e.category_id as "categoryId",
           ec.name as "categoryName",
           ec.color as "categoryColor",
           ec.icon as "categoryIcon",
           ev.file_name as "currentFileName",
           ev.file_size_bytes as "currentFileSizeBytes",
           ev.mime_type as "currentMimeType",
           ev.version_number as "currentVersionNumber",
           (SELECT u.first_name || ' ' || u.last_name FROM global.users u WHERE u.id = e.created_by) as "createdByName",
           (SELECT u.email FROM global.users u WHERE u.id = e.created_by) as "createdByEmail",
           COALESCE(
             (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
              FROM evidence_tag_links etl
              JOIN evidence_tags t ON t.id = etl.tag_id
              WHERE etl.evidence_id = e.id),
             '[]'::json
           ) as tags
         FROM evidence e
         LEFT JOIN evidence_categories ec ON ec.id = e.category_id
         LEFT JOIN evidence_versions ev ON ev.id = e.current_version_id
         WHERE ${where}
         ORDER BY ${orderClause}
         LIMIT $${idx} OFFSET $${idx + 1}`,
        ...params,
        limit,
        offset,
      ),
      tx.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text FROM evidence e WHERE ${where}`,
        ...params,
      ),
    ]);

    // Parse tags from JSON (Prisma returns them as raw values)
    const evidence = rows.map((row) => ({
      ...row,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags ?? []),
    })) as Evidence[];

    return { evidence, total: parseInt(countRows[0].count, 10) };
  },

  // ── Evidence Single ────────────────────────────────────────────────────────

  async findById(tx: Prisma.TransactionClient, id: string): Promise<Evidence | null> {
    const rows = await tx.$queryRaw<Evidence[]>`
      SELECT
        e.id, e.title, e.description, e.status,
        e.is_confidential as "isConfidential",
        e.retention_date as "retentionDate",
        e.collected_at as "collectedAt",
        e.collected_by as "collectedBy",
        e.current_version_id as "currentVersionId",
        e.ocr_status as "ocrStatus",
        e.created_by as "createdBy",
        e.created_at as "createdAt",
        e.updated_at as "updatedAt",
        e.category_id as "categoryId",
        ec.name as "categoryName",
        ec.color as "categoryColor",
        ec.icon as "categoryIcon",
        ev.file_name as "currentFileName",
        ev.file_size_bytes as "currentFileSizeBytes",
        ev.mime_type as "currentMimeType",
        ev.version_number as "currentVersionNumber",
        (SELECT u.first_name || ' ' || u.last_name FROM global.users u WHERE u.id = e.created_by) as "createdByName",
        (SELECT u.email FROM global.users u WHERE u.id = e.created_by) as "createdByEmail",
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM evidence_tag_links etl
           JOIN evidence_tags t ON t.id = etl.tag_id
           WHERE etl.evidence_id = e.id),
          '[]'::json
        ) as tags
      FROM evidence e
      LEFT JOIN evidence_categories ec ON ec.id = e.category_id
      LEFT JOIN evidence_versions ev ON ev.id = e.current_version_id
      WHERE e.id = ${id}::uuid AND e.deleted_at IS NULL
    `;
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      ...row,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags as unknown as string) : (row.tags ?? []),
    } as Evidence;
  },

  // ── Evidence Write ─────────────────────────────────────────────────────────

  async create(
    tx: Prisma.TransactionClient,
    data: {
      title: string; description?: string | null; categoryId?: string | null;
      isConfidential: boolean; retentionDate?: Date | null;
      collectedAt?: Date | null; collectedBy?: string | null; createdBy: string;
    },
  ): Promise<{ id: string }> {
    const rows = await tx.$queryRaw<[{ id: string }]>`
      INSERT INTO evidence
        (title, description, category_id, is_confidential, retention_date,
         collected_at, collected_by, created_by, updated_by)
      VALUES
        (${data.title}, ${data.description ?? null}, ${data.categoryId ?? null}::uuid,
         ${data.isConfidential}, ${data.retentionDate ?? null},
         ${data.collectedAt ?? null}, ${data.collectedBy ?? null}::uuid,
         ${data.createdBy}::uuid, ${data.createdBy}::uuid)
      RETURNING id
    `;
    return rows[0];
  },

  async update(
    tx: Prisma.TransactionClient,
    id: string,
    data: {
      title?: string; description?: string | null; categoryId?: string | null;
      isConfidential?: boolean; retentionDate?: Date | null;
      collectedAt?: Date | null; collectedBy?: string | null;
      status?: EvidenceStatus; updatedBy: string;
    },
  ): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE evidence SET
        title           = COALESCE(${data.title ?? null}, title),
        description     = CASE WHEN ${data.description !== undefined}::boolean THEN ${data.description ?? null} ELSE description END,
        category_id     = CASE WHEN ${data.categoryId !== undefined}::boolean THEN ${data.categoryId ?? null}::uuid ELSE category_id END,
        is_confidential = COALESCE(${data.isConfidential ?? null}::boolean, is_confidential),
        retention_date  = CASE WHEN ${data.retentionDate !== undefined}::boolean THEN ${data.retentionDate ?? null} ELSE retention_date END,
        collected_at    = CASE WHEN ${data.collectedAt !== undefined}::boolean THEN ${data.collectedAt ?? null} ELSE collected_at END,
        collected_by    = CASE WHEN ${data.collectedBy !== undefined}::boolean THEN ${data.collectedBy ?? null}::uuid ELSE collected_by END,
        status          = COALESCE(${data.status ?? null}, status),
        updated_by      = ${data.updatedBy}::uuid,
        updated_at      = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result === 1;
  },

  async softDelete(tx: Prisma.TransactionClient, id: string, deletedBy: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE evidence SET deleted_at = NOW(), updated_by = ${deletedBy}::uuid
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result === 1;
  },

  // ── Versions ───────────────────────────────────────────────────────────────

  async listVersions(tx: Prisma.TransactionClient, evidenceId: string): Promise<EvidenceVersion[]> {
    return tx.$queryRaw<EvidenceVersion[]>`
      SELECT
        v.id, v.evidence_id as "evidenceId", v.version_number as "versionNumber",
        v.file_name as "fileName", v.file_key as "fileKey",
        v.file_size_bytes as "fileSizeBytes", v.mime_type as "mimeType",
        v.checksum_sha256 as "checksumSha256",
        v.upload_status as "uploadStatus", v.change_note as "changeNote",
        v.uploaded_by as "uploadedBy",
        (u.first_name || ' ' || u.last_name) as "uploaderName",
        u.email as "uploaderEmail",
        v.created_at as "createdAt"
      FROM evidence_versions v
      LEFT JOIN global.users u ON u.id = v.uploaded_by
      WHERE v.evidence_id = ${evidenceId}::uuid
      ORDER BY v.version_number DESC
    `;
  },

  async createVersion(
    tx: Prisma.TransactionClient,
    data: {
      evidenceId: string; fileName: string; fileKey: string;
      mimeType: string; changeNote?: string | null; uploadedBy: string;
    },
  ): Promise<{ id: string; versionNumber: number }> {
    const rows = await tx.$queryRaw<[{ id: string; versionNumber: number }]>`
      INSERT INTO evidence_versions
        (evidence_id, version_number, file_name, file_key, mime_type, change_note, uploaded_by)
      VALUES (
        ${data.evidenceId}::uuid,
        COALESCE((SELECT MAX(version_number) FROM evidence_versions WHERE evidence_id = ${data.evidenceId}::uuid), 0) + 1,
        ${data.fileName}, ${data.fileKey}, ${data.mimeType},
        ${data.changeNote ?? null}, ${data.uploadedBy}::uuid
      )
      RETURNING id, version_number as "versionNumber"
    `;
    return rows[0];
  },

  async confirmVersion(
    tx: Prisma.TransactionClient,
    versionId: string,
    evidenceId: string,
    data: { fileSizeBytes: number; checksumSha256?: string | null },
  ): Promise<boolean> {
    await tx.$executeRaw`
      UPDATE evidence_versions SET
        upload_status    = 'completed',
        file_size_bytes  = ${data.fileSizeBytes},
        checksum_sha256  = ${data.checksumSha256 ?? null}
      WHERE id = ${versionId}::uuid AND evidence_id = ${evidenceId}::uuid
    `;

    // Promote this version to current
    await tx.$executeRaw`
      UPDATE evidence SET
        current_version_id = ${versionId}::uuid,
        ocr_status = 'pending',
        updated_at = NOW()
      WHERE id = ${evidenceId}::uuid
    `;
    return true;
  },

  // ── Tags ───────────────────────────────────────────────────────────────────

  async addTag(tx: Prisma.TransactionClient, evidenceId: string, tagId: string, taggedBy: string): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO evidence_tag_links (evidence_id, tag_id, tagged_by)
      VALUES (${evidenceId}::uuid, ${tagId}::uuid, ${taggedBy}::uuid)
      ON CONFLICT DO NOTHING
    `;
    // Regenerate search vector to include tags
    await tx.$executeRaw`
      UPDATE evidence SET updated_at = NOW() WHERE id = ${evidenceId}::uuid
    `;
  },

  async removeTag(tx: Prisma.TransactionClient, evidenceId: string, tagId: string): Promise<void> {
    await tx.$executeRaw`
      DELETE FROM evidence_tag_links WHERE evidence_id = ${evidenceId}::uuid AND tag_id = ${tagId}::uuid
    `;
  },

  // ── Links ──────────────────────────────────────────────────────────────────

  async addLink(
    tx: Prisma.TransactionClient,
    data: { evidenceId: string; linkedType: string; linkedId: string; linkedBy: string },
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO evidence_links (evidence_id, linked_type, linked_id, linked_by)
      VALUES (${data.evidenceId}::uuid, ${data.linkedType}, ${data.linkedId}::uuid, ${data.linkedBy}::uuid)
      ON CONFLICT DO NOTHING
    `;
  },

  async removeLink(
    tx: Prisma.TransactionClient,
    evidenceId: string, linkedType: string, linkedId: string,
  ): Promise<void> {
    await tx.$executeRaw`
      DELETE FROM evidence_links
      WHERE evidence_id = ${evidenceId}::uuid AND linked_type = ${linkedType} AND linked_id = ${linkedId}::uuid
    `;
  },

  // ── Shares ─────────────────────────────────────────────────────────────────

  async createShare(
    tx: Prisma.TransactionClient,
    data: {
      evidenceId: string; shareToken: string; shareType: string;
      recipientEmail?: string | null; passwordHash?: string | null;
      sharedBy: string; expiresAt?: Date | null;
    },
  ): Promise<EvidenceShare> {
    const rows = await tx.$queryRaw<EvidenceShare[]>`
      INSERT INTO evidence_shares
        (evidence_id, share_token, share_type, recipient_email, password_hash, shared_by, expires_at)
      VALUES
        (${data.evidenceId}::uuid, ${data.shareToken}, ${data.shareType},
         ${data.recipientEmail ?? null}, ${data.passwordHash ?? null},
         ${data.sharedBy}::uuid, ${data.expiresAt ?? null})
      RETURNING
        id, evidence_id as "evidenceId", share_token as "shareToken",
        share_type as "shareType", recipient_email as "recipientEmail",
        (password_hash IS NOT NULL) as "hasPassword",
        shared_by as "sharedBy", expires_at as "expiresAt",
        accessed_count as "accessedCount",
        last_accessed_at as "lastAccessedAt",
        is_revoked as "isRevoked", created_at as "createdAt"
    `;
    return rows[0];
  },

  async listShares(tx: Prisma.TransactionClient, evidenceId: string): Promise<EvidenceShare[]> {
    return tx.$queryRaw<EvidenceShare[]>`
      SELECT
        id, evidence_id as "evidenceId", share_token as "shareToken",
        share_type as "shareType", recipient_email as "recipientEmail",
        (password_hash IS NOT NULL) as "hasPassword",
        shared_by as "sharedBy", expires_at as "expiresAt",
        accessed_count as "accessedCount",
        last_accessed_at as "lastAccessedAt",
        is_revoked as "isRevoked", created_at as "createdAt"
      FROM evidence_shares
      WHERE evidence_id = ${evidenceId}::uuid
      ORDER BY created_at DESC
    `;
  },

  async findShareByToken(tx: Prisma.TransactionClient, token: string): Promise<(EvidenceShare & { passwordHash: string | null }) | null> {
    const rows = await tx.$queryRaw<(EvidenceShare & { passwordHash: string | null })[]>`
      SELECT
        id, evidence_id as "evidenceId", share_token as "shareToken",
        share_type as "shareType", recipient_email as "recipientEmail",
        password_hash as "passwordHash",
        (password_hash IS NOT NULL) as "hasPassword",
        shared_by as "sharedBy", expires_at as "expiresAt",
        accessed_count as "accessedCount",
        last_accessed_at as "lastAccessedAt",
        is_revoked as "isRevoked", created_at as "createdAt"
      FROM evidence_shares
      WHERE share_token = ${token} AND is_revoked = FALSE
    `;
    return rows[0] ?? null;
  },

  async touchShare(tx: Prisma.TransactionClient, shareId: string): Promise<void> {
    await tx.$executeRaw`
      UPDATE evidence_shares SET
        accessed_count    = accessed_count + 1,
        last_accessed_at  = NOW()
      WHERE id = ${shareId}::uuid
    `;
  },

  async revokeShare(tx: Prisma.TransactionClient, shareId: string, evidenceId: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE evidence_shares SET is_revoked = TRUE
      WHERE id = ${shareId}::uuid AND evidence_id = ${evidenceId}::uuid
    `;
    return result === 1;
  },

  // ── Audit Trail ────────────────────────────────────────────────────────────

  async logEvent(
    tx: Prisma.TransactionClient,
    data: {
      evidenceId: string; eventType: string;
      actorId?: string | null; actorEmail?: string | null;
      metadata?: Record<string, unknown>; ipAddress?: string | null;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO evidence_events (evidence_id, event_type, actor_id, actor_email, metadata, ip_address)
      VALUES (
        ${data.evidenceId}::uuid,
        ${data.eventType},
        ${data.actorId ?? null}::uuid,
        ${data.actorEmail ?? null},
        ${JSON.stringify(data.metadata ?? {})}::jsonb,
        ${data.ipAddress ?? null}::inet
      )
    `;
  },

  async listEvents(
    tx: Prisma.TransactionClient,
    evidenceId: string,
    limit = 50,
  ): Promise<EvidenceAuditEvent[]> {
    return tx.$queryRaw<EvidenceAuditEvent[]>`
      SELECT
        id, evidence_id as "evidenceId", event_type as "eventType",
        actor_id as "actorId", actor_email as "actorEmail",
        metadata, ip_address::text as "ipAddress", created_at as "createdAt"
      FROM evidence_events
      WHERE evidence_id = ${evidenceId}::uuid
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },
};
