import { assertActiveMembers } from '../../lib/active-member';
import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { AppError, ForbiddenError, NotFoundError } from '../../lib/errors';
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
    await assertActiveMembers(schemaName,[input.assignedTo]);
    if(['closed','resolved'].includes(input.status))throw new AppError('Report and investigate the incident before closure review.',409);
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
    await assertActiveMembers(schemaName,[input.assignedTo]);
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);

      const before = await incidentsRepository.findById(tx, id);
      if (!before) throw new NotFoundError('Incident not found.');

      const materialChange = ['detectedAt','isDataBreach','affectedDataSubjects','description','category','severity'].some(key => {
        const value=(input as Record<string,unknown>)[key],prior=(before as unknown as Record<string,unknown>)[key];
        if(value===undefined)return false;
        return key==='detectedAt' ? new Date(String(value)).getTime()!==new Date(String(prior)).getTime() : JSON.stringify(value)!==JSON.stringify(prior);
      });
      if(['closed','resolved'].includes(input.status??'')){
        if(materialChange)throw new AppError('Save changed incident facts and record a fresh notification decision before closing.',409);
        if(actor.id===before.reportedBy||actor.id===before.assignedTo)throw new ForbiddenError('Ask an independent authorised reviewer to close this incident.');
        if(!['owner','admin','compliance_manager'].includes(actor.role??''))throw new ForbiddenError();
        const saved=await tx.$queryRawUnsafe<Array<{notification_decision:{decision?:string}|null}>>('SELECT notification_decision FROM incidents WHERE id=$1::uuid',id);
        const current=await tx.$queryRawUnsafe<Array<{valid:boolean}>>(`SELECT
          (notification_decision->>'obligationId' IS NULL OR EXISTS(SELECT 1 FROM compliance_obligations o WHERE o.id::text=notification_decision->>'obligationId' AND o.revision::text=notification_decision->>'obligationRevision' AND o.status='active' AND o.review_date>=CURRENT_DATE AND (o.effective_on IS NULL OR o.effective_on<=CURRENT_DATE)))
          AND (notification_decision->>'evidenceId' IS NULL OR EXISTS(SELECT 1 FROM evidence e JOIN evidence_versions v ON v.id=e.current_version_id WHERE e.id::text=notification_decision->>'evidenceId' AND e.current_version_id::text=notification_decision->>'evidenceVersionId' AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()) AND v.upload_status='completed')) valid
          FROM incidents WHERE id=$1::uuid`,id);
        if(!current[0]?.valid)throw new AppError('The notification source or proof changed. Record a fresh decision before closure.',409);
        if(!['submitted','not_required'].includes(saved[0]?.notification_decision?.decision??'')||!(input.rootCause??before.rootCause)?.trim()||!(input.remediation??before.remediation)?.trim()||!(input.lessonsLearned??before.lessonsLearned)?.trim())throw new AppError('Record root cause, remediation, lessons and a verified notification decision before closure.',409,'INCIDENT_NOT_READY');
      }
      if(materialChange)await tx.$executeRawUnsafe('UPDATE incidents SET notification_decision=NULL WHERE id=$1::uuid',id);
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
