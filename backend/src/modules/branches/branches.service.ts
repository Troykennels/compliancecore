import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { NotFoundError, ConflictError } from '../../lib/errors';
import { branchesRepository } from './branches.repository';
import { CreateBranchInput, UpdateBranchInput, ListBranchesInput } from './branches.schema';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

export const branchesService = {
  async list(schemaName: string, filters: ListBranchesInput) {
    return withTenantSchema(schemaName, (tx) =>
      branchesRepository.findAll(tx, filters),
    );
  },

  async getById(schemaName: string, id: string) {
    return withTenantSchema(schemaName, async (tx) => {
      const branch = await branchesRepository.findById(tx, id);
      if (!branch) throw new NotFoundError(`Branch ${id} not found.`);
      return branch;
    });
  },

  async create(schemaName: string, input: CreateBranchInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      if (input.code) {
        const existing = await tx.$queryRaw<[{ id: string }?]>`
          SELECT id FROM branches WHERE code = ${input.code} AND deleted_at IS NULL LIMIT 1
        `;
        if (existing.length > 0) {
          throw new ConflictError(`A branch with code "${input.code}" already exists.`);
        }
      }

      return branchesRepository.create(tx, { ...input, createdBy: actor.id });
    });
  },

  async update(schemaName: string, id: string, input: UpdateBranchInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      const branch = await branchesRepository.findById(tx, id);
      if (!branch) throw new NotFoundError(`Branch ${id} not found.`);

      if (input.code && input.code !== branch.code) {
        const existing = await tx.$queryRaw<[{ id: string }?]>`
          SELECT id FROM branches WHERE code = ${input.code} AND id != ${id}::uuid AND deleted_at IS NULL LIMIT 1
        `;
        if (existing.length > 0) {
          throw new ConflictError(`A branch with code "${input.code}" already exists.`);
        }
      }

      const updated = await branchesRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!updated) throw new NotFoundError(`Branch ${id} not found.`);
      return updated;
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      // Check if any departments reference this branch
      const deptCount = await tx.$queryRaw<[{ count: string }]>`
        SELECT COUNT(*)::text FROM departments WHERE branch_id = ${id}::uuid AND deleted_at IS NULL
      `;
      if (parseInt(deptCount[0].count, 10) > 0) {
        throw new ConflictError(
          'Cannot delete a branch that has active departments. Reassign or delete the departments first.',
        );
      }

      const deleted = await branchesRepository.softDelete(tx, id, actor.id);
      if (!deleted) throw new NotFoundError(`Branch ${id} not found.`);
    });
  },
};
