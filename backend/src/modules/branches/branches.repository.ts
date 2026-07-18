import { Prisma } from '@prisma/client';
import { Branch, CreateBranchDto, UpdateBranchDto } from './branches.types';
import { ListBranchesInput } from './branches.schema';

// Branches live in the tenant schema. All methods receive a TransactionClient
// that already has SET LOCAL search_path applied by withTenantSchema.

export const branchesRepository = {
  async findAll(
    tx: Prisma.TransactionClient,
    filters: ListBranchesInput,
  ): Promise<{ branches: Branch[]; total: number }> {
    const { page, limit, search, isActive } = filters;
    const offset = (page - 1) * limit;

    const whereConditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (typeof isActive === 'boolean') {
      whereConditions.push(`is_active = $${idx++}`);
      params.push(isActive);
    }
    if (search) {
      whereConditions.push(`(name ILIKE $${idx} OR city ILIKE $${idx} OR country ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = whereConditions.join(' AND ');

    const [rows, countRows] = await Promise.all([
      tx.$queryRawUnsafe<Branch[]>(
        `SELECT id, name, code, is_headquarters as "isHeadquarters",
                country, city, state, address, postal_code as "postalCode",
                timezone, phone, email, is_active as "isActive",
                created_by as "createdBy", updated_by as "updatedBy",
                created_at as "createdAt", updated_at as "updatedAt"
         FROM branches
         WHERE ${where}
         ORDER BY is_headquarters DESC, name ASC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        ...params,
        limit,
        offset,
      ),
      tx.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text FROM branches WHERE ${where}`,
        ...params,
      ),
    ]);

    return { branches: rows, total: parseInt(countRows[0].count, 10) };
  },

  async findById(tx: Prisma.TransactionClient, id: string): Promise<Branch | null> {
    const rows = await tx.$queryRaw<Branch[]>`
      SELECT id, name, code, is_headquarters as "isHeadquarters",
             country, city, state, address, postal_code as "postalCode",
             timezone, phone, email, is_active as "isActive",
             created_by as "createdBy", updated_by as "updatedBy",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM branches
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return rows[0] ?? null;
  },

  async create(
    tx: Prisma.TransactionClient,
    dto: CreateBranchDto & { createdBy: string },
  ): Promise<Branch> {
    if (dto.isHeadquarters) {
      // Clear existing HQ flag — only one branch can be HQ
      await tx.$executeRaw`
        UPDATE branches SET is_headquarters = FALSE WHERE is_headquarters = TRUE AND deleted_at IS NULL
      `;
    }

    const rows = await tx.$queryRaw<Branch[]>`
      INSERT INTO branches
        (name, code, is_headquarters, country, city, state, address,
         postal_code, timezone, phone, email, created_by, updated_by)
      VALUES
        (${dto.name}, ${dto.code ?? null}, ${dto.isHeadquarters ?? false},
         ${dto.country ?? null}, ${dto.city ?? null}, ${dto.state ?? null},
         ${dto.address ?? null}, ${dto.postalCode ?? null},
         ${dto.timezone ?? 'UTC'}, ${dto.phone ?? null}, ${dto.email ?? null},
         ${dto.createdBy}::uuid, ${dto.createdBy}::uuid)
      RETURNING
        id, name, code, is_headquarters as "isHeadquarters",
        country, city, state, address, postal_code as "postalCode",
        timezone, phone, email, is_active as "isActive",
        created_by as "createdBy", updated_by as "updatedBy",
        created_at as "createdAt", updated_at as "updatedAt"
    `;
    return rows[0];
  },

  async update(
    tx: Prisma.TransactionClient,
    id: string,
    dto: UpdateBranchDto & { updatedBy: string },
  ): Promise<Branch | null> {
    if (dto.isHeadquarters) {
      await tx.$executeRaw`
        UPDATE branches SET is_headquarters = FALSE WHERE is_headquarters = TRUE AND id != ${id}::uuid AND deleted_at IS NULL
      `;
    }

    const rows = await tx.$queryRaw<Branch[]>`
      UPDATE branches SET
        name             = COALESCE(${dto.name ?? null}, name),
        code             = CASE WHEN ${dto.code !== undefined}::boolean THEN ${dto.code ?? null} ELSE code END,
        is_headquarters  = COALESCE(${dto.isHeadquarters ?? null}::boolean, is_headquarters),
        country          = CASE WHEN ${dto.country !== undefined}::boolean THEN ${dto.country ?? null} ELSE country END,
        city             = CASE WHEN ${dto.city !== undefined}::boolean THEN ${dto.city ?? null} ELSE city END,
        state            = CASE WHEN ${dto.state !== undefined}::boolean THEN ${dto.state ?? null} ELSE state END,
        address          = CASE WHEN ${dto.address !== undefined}::boolean THEN ${dto.address ?? null} ELSE address END,
        postal_code      = CASE WHEN ${dto.postalCode !== undefined}::boolean THEN ${dto.postalCode ?? null} ELSE postal_code END,
        timezone         = COALESCE(${dto.timezone ?? null}, timezone),
        phone            = CASE WHEN ${dto.phone !== undefined}::boolean THEN ${dto.phone ?? null} ELSE phone END,
        email            = CASE WHEN ${dto.email !== undefined}::boolean THEN ${dto.email ?? null} ELSE email END,
        is_active        = COALESCE(${dto.isActive ?? null}::boolean, is_active),
        updated_by       = ${dto.updatedBy}::uuid,
        updated_at       = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
      RETURNING
        id, name, code, is_headquarters as "isHeadquarters",
        country, city, state, address, postal_code as "postalCode",
        timezone, phone, email, is_active as "isActive",
        created_by as "createdBy", updated_by as "updatedBy",
        created_at as "createdAt", updated_at as "updatedAt"
    `;
    return rows[0] ?? null;
  },

  async softDelete(
    tx: Prisma.TransactionClient,
    id: string,
    deletedBy: string,
  ): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE branches
      SET deleted_at = NOW(), updated_by = ${deletedBy}::uuid
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result === 1;
  },
};
