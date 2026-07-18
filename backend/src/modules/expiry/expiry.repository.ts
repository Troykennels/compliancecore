import { Prisma } from '@prisma/client';
import type { ExpiryItem, ExpiryListResult, ExpiryStatusCounts } from './expiry.types';
import type { CreateExpiryItemInput, UpdateExpiryItemInput, ListExpiryItemsInput } from './expiry.schema';

type Tx = Prisma.TransactionClient;

function mapRow(row: Record<string, unknown>): ExpiryItem {
  return {
    id:             row.id as string,
    name:           row.name as string,
    description:    row.description as string | null,
    entityType:     row.entityType as ExpiryItem['entityType'],
    entityId:       row.entityId as string | null,
    expiryDate:     new Date(row.expiryDate as string),
    renewalDate:    row.renewalDate ? new Date(row.renewalDate as string) : null,
    ownerId:        row.ownerId as string | null,
    ownerName:      row.ownerName as string | null,
    ownerEmail:     row.ownerEmail as string | null,
    status:         row.status as ExpiryItem['status'],
    reminderDays:   (row.reminderDays as number[]) ?? [],
    autoDetected:   Boolean(row.autoDetected),
    notes:          row.notes as string | null,
    daysUntilExpiry: Number(row.daysUntilExpiry ?? 0),
    createdBy:      row.createdBy as string | null,
    createdAt:      new Date(row.createdAt as string),
    updatedAt:      new Date(row.updatedAt as string),
  };
}

const BASE_SELECT = `
  e.id, e.name, e.description, e.entity_type AS "entityType", e.entity_id AS "entityId",
  e.expiry_date AS "expiryDate", e.renewal_date AS "renewalDate",
  e.owner_id AS "ownerId",
  u.first_name || ' ' || u.last_name AS "ownerName",
  u.email AS "ownerEmail",
  e.status, e.reminder_days AS "reminderDays", e.auto_detected AS "autoDetected",
  e.notes, e.created_by AS "createdBy", e.created_at AS "createdAt", e.updated_at AS "updatedAt",
  (e.expiry_date - CURRENT_DATE)::int AS "daysUntilExpiry"
`;

export const expiryRepository = {
  async findAll(tx: Tx, filters: ListExpiryItemsInput): Promise<ExpiryListResult> {
    const { page, limit, entityType, status, ownerId, expiringWithinDays, q, sortBy, sortDir } = filters;

    const conditions: string[] = ['e.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (entityType)           { conditions.push(`e.entity_type = $${idx++}`); params.push(entityType); }
    if (status)               { conditions.push(`e.status = $${idx++}`); params.push(status); }
    if (ownerId)              { conditions.push(`e.owner_id = $${idx++}::uuid`); params.push(ownerId); }
    if (expiringWithinDays)   { conditions.push(`e.expiry_date <= CURRENT_DATE + (${expiringWithinDays} || ' days')::interval`); }
    if (q)                    { conditions.push(`e.name ILIKE $${idx++}`); params.push(`%${q}%`); }

    const allowedSort: Record<string, string> = {
      expiry_date: 'e.expiry_date', name: 'e.name',
      entity_type: 'e.entity_type', status: 'e.status',
    };
    const orderCol = allowedSort[sortBy ?? 'expiry_date'] ?? 'e.expiry_date';
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';
    const where = conditions.join(' AND ');
    const offset = ((page ?? 1) - 1) * (limit ?? 50);

    const [rows, countRows] = await Promise.all([
      tx.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT ${BASE_SELECT}
        FROM expiry_items e
        LEFT JOIN global.users u ON u.id = e.owner_id
        WHERE ${where}
        ORDER BY ${orderCol} ${dir}
        LIMIT ${limit ?? 50} OFFSET ${offset}
      `, ...params),
      tx.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) FROM expiry_items e WHERE ${where}
      `, ...params),
    ]);

    return { items: rows.map(mapRow), total: Number(countRows[0].count), page: page ?? 1, limit: limit ?? 50 };
  },

  async findById(tx: Tx, id: string): Promise<ExpiryItem | null> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT ${Prisma.raw(BASE_SELECT)}
      FROM expiry_items e
      LEFT JOIN global.users u ON u.id = e.owner_id
      WHERE e.id = ${id}::uuid AND e.deleted_at IS NULL
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async create(tx: Tx, input: CreateExpiryItemInput & { createdBy: string; autoDetected?: boolean }): Promise<{ id: string }> {
    const rows = await tx.$queryRaw<[{ id: string }]>`
      INSERT INTO expiry_items (
        name, description, entity_type, entity_id, expiry_date, renewal_date,
        owner_id, reminder_days, auto_detected, notes, created_by, updated_by
      ) VALUES (
        ${input.name}, ${input.description ?? null}, ${input.entityType}, ${input.entityId ?? null}::uuid,
        ${input.expiryDate}::date, ${input.renewalDate ?? null}::date,
        ${input.ownerId ?? null}::uuid,
        ${input.reminderDays ?? [90,60,30,14,7]},
        ${input.autoDetected ?? false},
        ${input.notes ?? null},
        ${input.createdBy}::uuid, ${input.createdBy}::uuid
      )
      RETURNING id
    `;
    return rows[0];
  },

  async update(tx: Tx, id: string, input: UpdateExpiryItemInput & { updatedBy: string }): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE expiry_items SET
        name          = COALESCE(${input.name ?? null}, name),
        description   = CASE WHEN ${input.description !== undefined} THEN ${input.description ?? null} ELSE description END,
        entity_type   = COALESCE(${input.entityType ?? null}, entity_type),
        expiry_date   = COALESCE(${input.expiryDate ?? null}::date, expiry_date),
        renewal_date  = CASE WHEN ${input.renewalDate !== undefined} THEN ${input.renewalDate ?? null}::date ELSE renewal_date END,
        owner_id      = CASE WHEN ${input.ownerId !== undefined} THEN ${input.ownerId ?? null}::uuid ELSE owner_id END,
        status        = COALESCE(${input.status ?? null}, status),
        reminder_days = COALESCE(${input.reminderDays ?? null}, reminder_days),
        notes         = CASE WHEN ${input.notes !== undefined} THEN ${input.notes ?? null} ELSE notes END,
        updated_by    = ${input.updatedBy}::uuid,
        updated_at    = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async softDelete(tx: Tx, id: string, deletedBy: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE expiry_items SET deleted_at = NOW(), updated_by = ${deletedBy}::uuid
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  // Refresh status for all items based on expiry_date (called by daily job)
  async refreshStatuses(tx: Tx): Promise<void> {
    await tx.$executeRaw`
      UPDATE expiry_items SET
        status = CASE
          WHEN expiry_date < CURRENT_DATE THEN 'expired'
          WHEN expiry_date <= CURRENT_DATE + '30 days'::interval THEN 'expiring_soon'
          WHEN status IN ('expired','expiring_soon') THEN 'active'
          ELSE status
        END,
        updated_at = NOW()
      WHERE deleted_at IS NULL
        AND status NOT IN ('renewed', 'cancelled')
    `;
  },

  async countByStatus(tx: Tx): Promise<ExpiryStatusCounts> {
    const rows = await tx.$queryRaw<{ status: string; count: bigint }[]>`
      SELECT status, COUNT(*) AS count
      FROM expiry_items
      WHERE deleted_at IS NULL
      GROUP BY status
    `;
    const m = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
    return {
      active:       m.active       ?? 0,
      expiringSoon: m.expiring_soon ?? 0,
      expired:      m.expired       ?? 0,
      renewed:      m.renewed       ?? 0,
      cancelled:    m.cancelled     ?? 0,
      total:        Object.values(m).reduce((a, b) => a + b, 0),
    };
  },

  // Returns items expiring within N days — used by reminder job
  async findExpiringSoon(tx: Tx, daysAhead: number): Promise<ExpiryItem[]> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT ${Prisma.raw(BASE_SELECT)}
      FROM expiry_items e
      LEFT JOIN global.users u ON u.id = e.owner_id
      WHERE e.deleted_at IS NULL
        AND e.status NOT IN ('renewed','cancelled')
        AND e.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (${daysAhead} || ' days')::interval
      ORDER BY e.expiry_date ASC
    `;
    return rows.map(mapRow);
  },

  // Log that a reminder was sent — idempotent via UNIQUE constraint
  async logReminderSent(
    tx: Tx,
    entityType: string, entityId: string, reminderType: string,
    daysBefore: number | null, channel: string,
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO reminder_sent_log (entity_type, entity_id, reminder_type, days_before, channel)
      VALUES (${entityType}, ${entityId}::uuid, ${reminderType}, ${daysBefore}, ${channel})
      ON CONFLICT DO NOTHING
    `;
  },

  async hasReminderBeenSent(
    tx: Tx,
    entityType: string, entityId: string, reminderType: string,
    daysBefore: number | null, channel: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<[{ exists: boolean }]>`
      SELECT EXISTS(
        SELECT 1 FROM reminder_sent_log
        WHERE entity_type = ${entityType}
          AND entity_id = ${entityId}::uuid
          AND reminder_type = ${reminderType}
          AND days_before IS NOT DISTINCT FROM ${daysBefore}
          AND channel = ${channel}
      ) AS exists
    `;
    return rows[0].exists;
  },
};
