import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { AppError, NotFoundError } from '../../lib/errors';
import { implementationService } from '../frameworks/implementation.service';
import { auditsRepository } from './audits.repository';
import type {
  CreateAuditInput,
  UpdateAuditInput,
  ListAuditsInput,
  CreateFindingInput,
  UpdateFindingInput,
} from './audits.schema';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

export const auditsService = {
  async list(schemaName: string, filters: ListAuditsInput) {
    return withTenantSchema(schemaName, (tx) =>
      auditsRepository.findAll(tx, filters),
    );
  },

  async getById(schemaName: string, id: string) {
    const audit = await withTenantSchema(schemaName, (tx) =>
      auditsRepository.findById(tx, id),
    );
    if (!audit) throw new NotFoundError('Audit not found.');
    return audit;
  },

  async create(schemaName: string, input: CreateAuditInput, actor: Actor) {
    if(input.auditType==='certification') {
      const implementation=(await implementationService.overview(schemaName,actor)).find(x=>[x.framework.id,x.framework.code].includes(input.frameworkRef??''));
      if(implementation?.status!=='implemented')throw new AppError('Complete the framework implementation and obtain independent sign-off before creating its certification assessment.',409,'IMPLEMENTATION_REQUIRED');
    }
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const { id } = await auditsRepository.create(tx, { ...input, createdBy: actor.id });
      return auditsRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdateAuditInput, actor: Actor) {
    const before=await this.getById(schemaName,id);
    if((input.auditType??before.auditType)==='certification') {
      const implementation=(await implementationService.overview(schemaName,actor)).find(x=>[x.framework.id,x.framework.code].includes(input.frameworkRef??before.frameworkRef??''));
      if(implementation?.status!=='implemented')throw new AppError('A current signed-off implementation is required for this certification assessment.',409,'IMPLEMENTATION_REQUIRED');
    }
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await auditsRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!ok) throw new NotFoundError('Audit not found.');
      return auditsRepository.findById(tx, id);
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await auditsRepository.softDelete(tx, id, actor.id);
      if (!ok) throw new NotFoundError('Audit not found.');
    });
  },

  async listFindings(schemaName: string, auditId: string) {
    return withTenantSchema(schemaName, async (tx) => {
      const audit = await auditsRepository.findById(tx, auditId);
      if (!audit) throw new NotFoundError('Audit not found.');
      return auditsRepository.findFindings(tx, auditId);
    });
  },

  async createFinding(
    schemaName: string,
    auditId: string,
    input: CreateFindingInput,
    actor: Actor,
  ) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const audit = await auditsRepository.findById(tx, auditId);
      if (!audit) throw new NotFoundError('Audit not found.');
      const { id } = await auditsRepository.createFinding(tx, auditId, {
        ...input,
        createdBy: actor.id,
      });
      return auditsRepository.findFindingById(tx, id);
    });
  },

  async updateFinding(
    schemaName: string,
    findingId: string,
    input: UpdateFindingInput,
    actor: Actor,
  ) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await auditsRepository.updateFinding(tx, findingId, input);
      if (!ok) throw new NotFoundError('Finding not found.');
      return auditsRepository.findFindingById(tx, findingId);
    });
  },

  async deleteFinding(schemaName: string, findingId: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await auditsRepository.deleteFinding(tx, findingId);
      if (!ok) throw new NotFoundError('Finding not found.');
    });
  },
};
