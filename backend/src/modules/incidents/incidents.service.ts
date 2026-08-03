import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { NotFoundError } from '../../lib/errors';
import { incidentsRepository } from './incidents.repository';
import type {
  CreateIncidentInput, UpdateIncidentInput, ListIncidentsInput, AddIncidentUpdateInput,
} from './incidents.schema';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };

export const incidentsService = {
  async list(schemaName: string, filters: ListIncidentsInput) {
    return withTenantSchema(schemaName, (tx) => incidentsRepository.findAll(tx, filters));
  },

  async stats(schemaName: string) {
    return withTenantSchema(schemaName, (tx) => incidentsRepository.stats(tx));
  },

  async getById(schemaName: string, id: string) {
    const incident = await withTenantSchema(schemaName, (tx) => incidentsRepository.findById(tx, id));
    if (!incident) throw new NotFoundError('Incident not found.');
    return incident;
  },

  async create(schemaName: string, input: CreateIncidentInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const { id } = await incidentsRepository.create(tx, { ...input, createdBy: actor.id });
      // Open the timeline with the report itself, so the log reads as a complete
      // account from first notification rather than starting at the first edit.
      await incidentsRepository.addUpdate(tx, id, {
        body: `Incident reported by ${actor.email}.`,
        entryType: 'note',
        authorId: actor.id,
      });
      return incidentsRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdateIncidentInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      const before = await incidentsRepository.findById(tx, id);
      if (!before) throw new NotFoundError('Incident not found.');

      const ok = await incidentsRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!ok) throw new NotFoundError('Incident not found.');

      // Record the changes an auditor will ask about. Written from the diff so
      // the timeline cannot drift from what actually happened to the record.
      const entries: { body: string; entryType: AddIncidentUpdateInput['entryType'] }[] = [];
      if (input.status !== undefined && input.status !== before.status) {
        entries.push({ body: `Status changed from ${before.status} to ${input.status}.`, entryType: 'status_change' });
      }
      if (input.severity !== undefined && input.severity !== before.severity) {
        entries.push({ body: `Severity changed from ${before.severity} to ${input.severity}.`, entryType: 'severity_change' });
      }
      if (input.assignedTo !== undefined && input.assignedTo !== before.assignedTo) {
        entries.push({
          body: input.assignedTo ? 'Incident reassigned.' : 'Incident unassigned.',
          entryType: 'assignment',
        });
      }
      if (input.regulatorNotifiedAt !== undefined && input.regulatorNotifiedAt && !before.regulatorNotifiedAt) {
        entries.push({ body: 'Supervisory authority notified.', entryType: 'notification' });
      }
      if (input.dataSubjectsNotifiedAt !== undefined && input.dataSubjectsNotifiedAt && !before.dataSubjectsNotifiedAt) {
        entries.push({ body: 'Affected data subjects notified.', entryType: 'notification' });
      }

      for (const e of entries) {
        await incidentsRepository.addUpdate(tx, id, { ...e, authorId: actor.id });
      }

      return incidentsRepository.findById(tx, id);
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await incidentsRepository.softDelete(tx, id, actor.id);
      if (!ok) throw new NotFoundError('Incident not found.');
    });
  },

  async listUpdates(schemaName: string, id: string) {
    return withTenantSchema(schemaName, async (tx) => {
      const incident = await incidentsRepository.findById(tx, id);
      if (!incident) throw new NotFoundError('Incident not found.');
      return incidentsRepository.findUpdates(tx, id);
    });
  },

  async addUpdate(schemaName: string, id: string, input: AddIncidentUpdateInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const incident = await incidentsRepository.findById(tx, id);
      if (!incident) throw new NotFoundError('Incident not found.');
      const { id: updateId } = await incidentsRepository.addUpdate(tx, id, {
        body: input.body,
        entryType: input.entryType ?? 'note',
        authorId: actor.id,
      });
      const updates = await incidentsRepository.findUpdates(tx, id);
      return updates.find((u) => u.id === updateId) ?? null;
    });
  },
};
