import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors';
import { departmentsRepository } from './departments.repository';
import {
  CreateDepartmentInput,
  UpdateDepartmentInput,
  ListDepartmentsInput,
} from './departments.schema';
import { Department, DepartmentTreeNode } from './departments.types';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

function buildTree(departments: Department[]): DepartmentTreeNode[] {
  const nodeMap = new Map<string, DepartmentTreeNode>();
  const roots: DepartmentTreeNode[] = [];

  for (const dept of departments) {
    nodeMap.set(dept.id, { ...dept, children: [] });
  }
  for (const node of nodeMap.values()) {
    if (node.parentDepartmentId) {
      const parent = nodeMap.get(node.parentDepartmentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node); // orphaned (parent was deleted)
      }
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export const departmentsService = {
  async list(schemaName: string, filters: ListDepartmentsInput) {
    if (filters.tree) {
      const departments = await withTenantSchema(schemaName, (tx) =>
        departmentsRepository.findAllFlat(tx),
      );
      return { tree: buildTree(departments), total: departments.length };
    }
    return withTenantSchema(schemaName, (tx) =>
      departmentsRepository.findAll(tx, filters),
    );
  },

  async getById(schemaName: string, id: string) {
    return withTenantSchema(schemaName, async (tx) => {
      const dept = await departmentsRepository.findById(tx, id);
      if (!dept) throw new NotFoundError(`Department ${id} not found.`);
      return dept;
    });
  },

  async create(schemaName: string, input: CreateDepartmentInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      if (input.code) {
        const existing = await tx.$queryRaw<[{ id: string }?]>`
          SELECT id FROM departments WHERE code = ${input.code} AND deleted_at IS NULL LIMIT 1
        `;
        if (existing.length > 0) {
          throw new ConflictError(`A department with code "${input.code}" already exists.`);
        }
      }

      // Prevent self-reference (paranoia — can't happen on create, but defensive)
      return departmentsRepository.create(tx, { ...input, createdBy: actor.id });
    });
  },

  async update(schemaName: string, id: string, input: UpdateDepartmentInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      const dept = await departmentsRepository.findById(tx, id);
      if (!dept) throw new NotFoundError(`Department ${id} not found.`);

      // Prevent circular hierarchy
      if (input.parentDepartmentId === id) {
        throw new ValidationError('A department cannot be its own parent.');
      }

      if (input.code && input.code !== dept.code) {
        const existing = await tx.$queryRaw<[{ id: string }?]>`
          SELECT id FROM departments WHERE code = ${input.code} AND id != ${id}::uuid AND deleted_at IS NULL LIMIT 1
        `;
        if (existing.length > 0) {
          throw new ConflictError(`A department with code "${input.code}" already exists.`);
        }
      }

      const updated = await departmentsRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!updated) throw new NotFoundError(`Department ${id} not found.`);
      return updated;
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      // Check if any child departments exist
      const childCount = await tx.$queryRaw<[{ count: string }]>`
        SELECT COUNT(*)::text FROM departments
        WHERE parent_department_id = ${id}::uuid AND deleted_at IS NULL
      `;
      if (parseInt(childCount[0].count, 10) > 0) {
        throw new ConflictError(
          'Cannot delete a department that has sub-departments. Move or delete them first.',
        );
      }

      const deleted = await departmentsRepository.softDelete(tx, id, actor.id);
      if (!deleted) throw new NotFoundError(`Department ${id} not found.`);
    });
  },
};
