import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { NotFoundError } from '../../lib/errors';
import { trainingRepository } from './training.repository';
import type {
  CreateTrainingInput,
  UpdateTrainingInput,
  ListTrainingsInput,
  AssignTrainingRecordsInput,
} from './training.schema';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

export const trainingService = {
  async list(schemaName: string, filters: ListTrainingsInput) {
    return withTenantSchema(schemaName, (tx) =>
      trainingRepository.findAll(tx, filters),
    );
  },

  async getById(schemaName: string, id: string) {
    const program = await withTenantSchema(schemaName, (tx) =>
      trainingRepository.findById(tx, id),
    );
    if (!program) throw new NotFoundError('Training program not found.');
    return program;
  },

  async create(schemaName: string, input: CreateTrainingInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const { id } = await trainingRepository.create(tx, { ...input, createdBy: actor.id });
      return trainingRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdateTrainingInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await trainingRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!ok) throw new NotFoundError('Training program not found.');
      return trainingRepository.findById(tx, id);
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await trainingRepository.softDelete(tx, id, actor.id);
      if (!ok) throw new NotFoundError('Training program not found.');
    });
  },

  async listRecords(schemaName: string, programId: string) {
    return withTenantSchema(schemaName, async (tx) => {
      const program = await trainingRepository.findById(tx, programId);
      if (!program) throw new NotFoundError('Training program not found.');
      return trainingRepository.findRecords(tx, programId);
    });
  },

  async assignRecords(
    schemaName: string,
    programId: string,
    input: AssignTrainingRecordsInput,
    actor: Actor,
  ) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const program = await trainingRepository.findById(tx, programId);
      if (!program) throw new NotFoundError('Training program not found.');
      await trainingRepository.assignRecords(tx, programId, input);
      return trainingRepository.findRecords(tx, programId);
    });
  },
};
