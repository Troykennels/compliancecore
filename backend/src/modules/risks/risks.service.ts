import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { AppError, NotFoundError } from '../../lib/errors';
import { risksRepository } from './risks.repository';
import type { RiskStats } from './risks.types';
import type { CreateRiskInput, UpdateRiskInput, ListRisksInput } from './risks.schema';
import { assertActiveMembers } from '../../lib/active-member';

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
    if(['accepted','mitigated','closed'].includes(input.status??''))throw new AppError('Record the assessment and treatment first, then request an independent remaining-risk review.',409,'RISK_REVIEW_REQUIRED');
    await assertActiveMembers(schemaName,[input.ownerId]);
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const { id } = await risksRepository.create(tx, { ...input, createdBy: actor.id });
      return risksRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdateRiskInput, actor: Actor) {
    if(['accepted','mitigated','closed'].includes(input.status??''))throw new AppError('Record the assessment and treatment first, then request an independent remaining-risk review.',409,'RISK_REVIEW_REQUIRED');
    await assertActiveMembers(schemaName,[input.ownerId]);
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await risksRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!ok) throw new NotFoundError('Risk not found.');
      // A legacy editor cannot silently keep an assessment confirmation after
      // changing the underlying scenario, ratings, ownership or response.
      if(Object.keys(input).some(key=>!['reviewDate','nextReviewDate'].includes(key)))await tx.$executeRawUnsafe('UPDATE risks SET rating_confirmed=FALSE,residual_basis=NULL WHERE id=$1::uuid AND framework_id IS NOT NULL',id);
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
