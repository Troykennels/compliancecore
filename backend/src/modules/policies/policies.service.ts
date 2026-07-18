import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { NotFoundError } from '../../lib/errors';
import { policiesRepository } from './policies.repository';
import type { CreatePolicyInput, UpdatePolicyInput, ListPoliciesInput } from './policies.schema';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

export const policiesService = {
  async list(schemaName: string, filters: ListPoliciesInput) {
    return withTenantSchema(schemaName, (tx) =>
      policiesRepository.findAll(tx, filters),
    );
  },

  async getById(schemaName: string, id: string) {
    const policy = await withTenantSchema(schemaName, (tx) =>
      policiesRepository.findById(tx, id),
    );
    if (!policy) throw new NotFoundError('Policy not found.');
    return policy;
  },

  async create(schemaName: string, input: CreatePolicyInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const { id } = await policiesRepository.create(tx, { ...input, createdBy: actor.id });
      return policiesRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdatePolicyInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await policiesRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!ok) throw new NotFoundError('Policy not found.');
      return policiesRepository.findById(tx, id);
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await policiesRepository.softDelete(tx, id, actor.id);
      if (!ok) throw new NotFoundError('Policy not found.');
    });
  },

  async publish(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await policiesRepository.publish(tx, id, actor.id);
      if (!ok) throw new NotFoundError('Policy not found.');
      return policiesRepository.findById(tx, id);
    });
  },
};
