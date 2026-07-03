import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { NotFoundError } from '../../lib/errors';
import { controlsRepository } from './controls.repository';
import type { CreateControlInput, UpdateControlInput, ListControlsInput } from './controls.schema';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

export const controlsService = {
  async list(schemaName: string, filters: ListControlsInput) {
    return withTenantSchema(schemaName, (tx) =>
      controlsRepository.findAll(tx, filters),
    );
  },

  async getById(schemaName: string, id: string) {
    const control = await withTenantSchema(schemaName, (tx) =>
      controlsRepository.findById(tx, id),
    );
    if (!control) throw new NotFoundError('Control not found.');
    return control;
  },

  async create(schemaName: string, input: CreateControlInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const { id } = await controlsRepository.create(tx, { ...input, createdBy: actor.id });
      return controlsRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdateControlInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await controlsRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!ok) throw new NotFoundError('Control not found.');
      return controlsRepository.findById(tx, id);
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await controlsRepository.softDelete(tx, id, actor.id);
      if (!ok) throw new NotFoundError('Control not found.');
    });
  },

  async markReviewed(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await controlsRepository.update(tx, id, {
        lastReviewedAt: new Date(),
        updatedBy: actor.id,
      } as never);
      if (!ok) throw new NotFoundError('Control not found.');
      return controlsRepository.findById(tx, id);
    });
  },

  async getStatusCounts(schemaName: string) {
    return withTenantSchema(schemaName, (tx) =>
      controlsRepository.getStatusCounts(tx),
    );
  },

  async getOverdue(schemaName: string) {
    return withTenantSchema(schemaName, (tx) =>
      controlsRepository.findOverdue(tx),
    );
  },
};
