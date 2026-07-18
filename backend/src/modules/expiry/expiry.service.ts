import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { NotFoundError } from '../../lib/errors';
import { expiryRepository } from './expiry.repository';
import type { CreateExpiryItemInput, UpdateExpiryItemInput, ListExpiryItemsInput } from './expiry.schema';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

export const expiryService = {
  async list(schemaName: string, filters: ListExpiryItemsInput) {
    return withTenantSchema(schemaName, (tx) => expiryRepository.findAll(tx, filters));
  },

  async getById(schemaName: string, id: string) {
    const item = await withTenantSchema(schemaName, (tx) => expiryRepository.findById(tx, id));
    if (!item) throw new NotFoundError('Expiry item not found.');
    return item;
  },

  async create(schemaName: string, input: CreateExpiryItemInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const { id } = await expiryRepository.create(tx, { ...input, createdBy: actor.id });
      return expiryRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdateExpiryItemInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await expiryRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!ok) throw new NotFoundError('Expiry item not found.');
      return expiryRepository.findById(tx, id);
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await expiryRepository.softDelete(tx, id, actor.id);
      if (!ok) throw new NotFoundError('Expiry item not found.');
    });
  },

  async getStatusCounts(schemaName: string) {
    return withTenantSchema(schemaName, (tx) => expiryRepository.countByStatus(tx));
  },

  async expiringSoon(schemaName: string, daysAhead: number) {
    return withTenantSchema(schemaName, (tx) => expiryRepository.findExpiringSoon(tx, daysAhead));
  },
};
