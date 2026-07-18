import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { NotFoundError } from '../../lib/errors';
import { risksRepository } from './risks.repository';
import type { RiskStats } from './risks.types';
import type { CreateRiskInput, UpdateRiskInput, ListRisksInput } from './risks.schema';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

export const risksService = {
  async list(schemaName: string, filters: ListRisksInput) {
    return withTenantSchema(schemaName, (tx) =>
      risksRepository.findAll(tx, filters),
    );
  },

  async getById(schemaName: string, id: string) {
    const risk = await withTenantSchema(schemaName, (tx) =>
      risksRepository.findById(tx, id),
    );
    if (!risk) throw new NotFoundError('Risk not found.');
    return risk;
  },

  async create(schemaName: string, input: CreateRiskInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const { id } = await risksRepository.create(tx, { ...input, createdBy: actor.id });
      return risksRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdateRiskInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await risksRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!ok) throw new NotFoundError('Risk not found.');
      return risksRepository.findById(tx, id);
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await risksRepository.softDelete(tx, id, actor.id);
      if (!ok) throw new NotFoundError('Risk not found.');
    });
  },

  async getStats(schemaName: string): Promise<RiskStats> {
    return withTenantSchema(schemaName, async (tx) => {
      const [byStatus, byLevel] = await Promise.all([
        risksRepository.getStatusCounts(tx),
        risksRepository.getLevelCounts(tx),
      ]);
      return { byStatus, byLevel };
    });
  },
};
