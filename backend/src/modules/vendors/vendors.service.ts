import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { NotFoundError } from '../../lib/errors';
import { vendorsRepository } from './vendors.repository';
import type {
  CreateVendorInput,
  UpdateVendorInput,
  ListVendorsInput,
  CreateVendorAssessmentInput,
} from './vendors.schema';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

export const vendorsService = {
  async list(schemaName: string, filters: ListVendorsInput) {
    return withTenantSchema(schemaName, (tx) =>
      vendorsRepository.findAll(tx, filters),
    );
  },

  async getById(schemaName: string, id: string) {
    const vendor = await withTenantSchema(schemaName, (tx) =>
      vendorsRepository.findById(tx, id),
    );
    if (!vendor) throw new NotFoundError('Vendor not found.');
    return vendor;
  },

  async create(schemaName: string, input: CreateVendorInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const { id } = await vendorsRepository.create(tx, { ...input, createdBy: actor.id });
      return vendorsRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdateVendorInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await vendorsRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!ok) throw new NotFoundError('Vendor not found.');
      return vendorsRepository.findById(tx, id);
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await vendorsRepository.softDelete(tx, id, actor.id);
      if (!ok) throw new NotFoundError('Vendor not found.');
    });
  },

  async listAssessments(schemaName: string, vendorId: string) {
    return withTenantSchema(schemaName, async (tx) => {
      const vendor = await vendorsRepository.findById(tx, vendorId);
      if (!vendor) throw new NotFoundError('Vendor not found.');
      return vendorsRepository.findAssessments(tx, vendorId);
    });
  },

  async createAssessment(
    schemaName: string,
    vendorId: string,
    input: CreateVendorAssessmentInput,
    actor: Actor,
  ) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const vendor = await vendorsRepository.findById(tx, vendorId);
      if (!vendor) throw new NotFoundError('Vendor not found.');
      const { id } = await vendorsRepository.createAssessment(tx, vendorId, {
        ...input,
        assessedBy: actor.id,
      });
      return vendorsRepository.findAssessmentById(tx, vendorId, id);
    });
  },
};
