import { Prisma } from '@prisma/client';
import {
  Department,
  DepartmentWithRelations,
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from './departments.types';
import { ListDepartmentsInput } from './departments.schema';

export const departmentsRepository = {
  async findAll(
    tx: Prisma.TransactionClient,
    filters: ListDepartmentsInput,
  ): Promise<{ departments: DepartmentWithRelations[]; total: number }> {
    const { page, limit, search, branchId, parentDepartmentId, isActive } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['d.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (typeof isActive === 'boolean') {
      conditions.push(`d.is_active = $${idx++}`);
      params.push(isActive);
    }
    if (branchId) {
      conditions.push(`d.branch_id = $${idx++}::uuid`);
      params.push(branchId);
    }
    if (parentDepartmentId) {
      conditions.push(`d.parent_department_id = $${idx++}::uuid`);
      params.push(parentDepartmentId);
    } else if (filters.tree) {
      // When building tree, return only root departments (no parent)
      conditions.push('d.parent_department_id IS NULL');
    }
    if (search) {
      conditions.push(`(d.name ILIKE $${idx} OR d.code ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');

    const [rows, countRows] = await Promise.all([
      tx.$queryRawUnsafe<DepartmentWithRelations[]>(
        `SELECT
           d.id, d.name, d.code,
           d.branch_id as "branchId",
           d.parent_department_id as "parentDepartmentId",
           d.head_user_id as "headUserId",
           d.description, d.is_active as "isActive",
           d.created_by as "createdBy", d.updated_by as "updatedBy",
           d.created_at as "createdAt", d.updated_at as "updatedAt",
           b.name as "branchName",
           pd.name as "parentDepartmentName",
           (u.first_name || ' ' || u.last_name) as "headUserName",
           u.email as "headUserEmail",
           (SELECT COUNT(*) FROM global.tenant_memberships tm
            WHERE tm.is_active = TRUE) as "memberCount"
         FROM departments d
         LEFT JOIN branches b ON b.id = d.branch_id AND b.deleted_at IS NULL
         LEFT JOIN departments pd ON pd.id = d.parent_department_id AND pd.deleted_at IS NULL
         LEFT JOIN global.users u ON u.id = d.head_user_id AND u.deleted_at IS NULL
         WHERE ${where}
         ORDER BY d.name ASC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        ...params,
        limit,
        offset,
      ),
      tx.$queryRawUnsafe<[{ count: string }]>(
        `SELECT COUNT(*)::text FROM departments d WHERE ${where}`,
        ...params,
      ),
    ]);

    return { departments: rows, total: parseInt(countRows[0].count, 10) };
  },

  async findById(tx: Prisma.TransactionClient, id: string): Promise<DepartmentWithRelations | null> {
    const rows = await tx.$queryRaw<DepartmentWithRelations[]>`
      SELECT
        d.id, d.name, d.code,
        d.branch_id as "branchId",
        d.parent_department_id as "parentDepartmentId",
        d.head_user_id as "headUserId",
        d.description, d.is_active as "isActive",
        d.created_by as "createdBy", d.updated_by as "updatedBy",
        d.created_at as "createdAt", d.updated_at as "updatedAt",
        b.name as "branchName",
        pd.name as "parentDepartmentName",
        (u.first_name || ' ' || u.last_name) as "headUserName",
        u.email as "headUserEmail",
        0 as "memberCount"
      FROM departments d
      LEFT JOIN branches b  ON b.id  = d.branch_id            AND b.deleted_at  IS NULL
      LEFT JOIN departments pd ON pd.id = d.parent_department_id AND pd.deleted_at IS NULL
      LEFT JOIN global.users u ON u.id  = d.head_user_id        AND u.deleted_at  IS NULL
      WHERE d.id = ${id}::uuid AND d.deleted_at IS NULL
    `;
    return rows[0] ?? null;
  },

  async create(
    tx: Prisma.TransactionClient,
    dto: CreateDepartmentDto & { createdBy: string },
  ): Promise<Department> {
    const rows = await tx.$queryRaw<Department[]>`
      INSERT INTO departments
        (name, code, branch_id, parent_department_id, head_user_id, description, created_by, updated_by)
      VALUES
        (${dto.name},
         ${dto.code ?? null},
         ${dto.branchId ?? null}::uuid,
         ${dto.parentDepartmentId ?? null}::uuid,
         ${dto.headUserId ?? null}::uuid,
         ${dto.description ?? null},
         ${dto.createdBy}::uuid,
         ${dto.createdBy}::uuid)
      RETURNING
        id, name, code,
        branch_id as "branchId",
        parent_department_id as "parentDepartmentId",
        head_user_id as "headUserId",
        description, is_active as "isActive",
        created_by as "createdBy", updated_by as "updatedBy",
        created_at as "createdAt", updated_at as "updatedAt"
    `;
    return rows[0];
  },

  async update(
    tx: Prisma.TransactionClient,
    id: string,
    dto: UpdateDepartmentDto & { updatedBy: string },
  ): Promise<Department | null> {
    const rows = await tx.$queryRaw<Department[]>`
      UPDATE departments SET
        name                 = COALESCE(${dto.name ?? null}, name),
        code                 = CASE WHEN ${dto.code !== undefined}::boolean THEN ${dto.code ?? null} ELSE code END,
        branch_id            = CASE WHEN ${dto.branchId !== undefined}::boolean THEN ${dto.branchId ?? null}::uuid ELSE branch_id END,
        parent_department_id = CASE WHEN ${dto.parentDepartmentId !== undefined}::boolean THEN ${dto.parentDepartmentId ?? null}::uuid ELSE parent_department_id END,
        head_user_id         = CASE WHEN ${dto.headUserId !== undefined}::boolean THEN ${dto.headUserId ?? null}::uuid ELSE head_user_id END,
        description          = CASE WHEN ${dto.description !== undefined}::boolean THEN ${dto.description ?? null} ELSE description END,
        is_active            = COALESCE(${dto.isActive ?? null}::boolean, is_active),
        updated_by           = ${dto.updatedBy}::uuid,
        updated_at           = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
      RETURNING
        id, name, code,
        branch_id as "branchId",
        parent_department_id as "parentDepartmentId",
        head_user_id as "headUserId",
        description, is_active as "isActive",
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
      UPDATE departments
      SET deleted_at = NOW(), updated_by = ${deletedBy}::uuid
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result === 1;
  },

  // Returns all departments for building the client-side tree
  async findAllFlat(tx: Prisma.TransactionClient): Promise<Department[]> {
    return tx.$queryRaw<Department[]>`
      SELECT
        id, name, code,
        branch_id as "branchId",
        parent_department_id as "parentDepartmentId",
        head_user_id as "headUserId",
        description, is_active as "isActive",
        created_by as "createdBy", updated_by as "updatedBy",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM departments
      WHERE deleted_at IS NULL
      ORDER BY name ASC
    `;
  },
};
