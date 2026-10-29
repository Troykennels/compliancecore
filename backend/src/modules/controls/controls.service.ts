import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { AppError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { controlsRepository } from './controls.repository';
import { closeResolvedControlActions } from '../frameworks/control-actions';
import type { CreateControlInput, UpdateControlInput, ListControlsInput } from './controls.schema';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };
async function checkControl(tx: Parameters<Parameters<typeof withTenantSchema>[1]>[0], input: {implementationStatus?:string;ownerId?:string|null;implementationNotes?:string|null;testingNotes?:string|null;frameworkId?:string|null}, actor:Actor, id?:string) {
 if(input.ownerId) {const member=await tx.$queryRawUnsafe<unknown[]>('SELECT 1 FROM global.tenant_memberships WHERE tenant_id=$1::uuid AND user_id=$2::uuid AND is_active AND deleted_at IS NULL',actor.tenantId,input.ownerId);if(!member.length)throw new AppError('The control owner must be an active member of this organisation.',422,'INVALID_OWNER');}
 if(input.implementationStatus==='not_applicable'&&!input.implementationNotes?.trim())throw new AppError('Record a justification for excluding this control.',422,'EXCLUSION_REASON_REQUIRED');
 if(input.implementationStatus==='implemented') {
  if(!id||!input.ownerId||!input.implementationNotes?.trim()||!input.testingNotes?.trim())throw new AppError('Assign an owner and record implementation and test notes before marking the control implemented.',409,'CONTROL_NOT_READY');
  const evidence=await tx.$queryRawUnsafe<unknown[]>("SELECT 1 FROM evidence_links l JOIN evidence e ON e.id=l.evidence_id JOIN evidence_versions v ON v.id=e.current_version_id WHERE l.linked_type='control' AND l.linked_id=$1::uuid AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()) AND v.upload_status='completed' LIMIT 1",id);
  if(!evidence.length)throw new AppError('Attach current evidence with a completed upload before marking the control implemented.',409,'EVIDENCE_REQUIRED');
 }
}

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
    if(actor.role==='control_owner')throw new ForbiddenError('A coordinator prepares and assigns new controls. You can update your assigned safeguards.');
    if(input.frameworkId&&input.implementationStatus==='not_applicable')throw new AppError('Create the control as planned, then record its applicability decision in the framework assessment.',409,'APPLICABILITY_WORKFLOW_REQUIRED');
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      await checkControl(tx,input,actor);
      if(input.frameworkId){const scope=await tx.$queryRawUnsafe<unknown[]>("SELECT 1 FROM framework_implementations WHERE framework_id=$1::uuid AND status<>'planning'",input.frameworkId);if(!scope.length)throw new AppError('Start the scoped framework implementation before adding its controls.',409,'SCOPE_REQUIRED');}
      const { id } = await controlsRepository.create(tx, { ...input, createdBy: actor.id });
      return controlsRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdateControlInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      await tx.$queryRawUnsafe('SELECT id FROM controls WHERE id=$1::uuid FOR UPDATE',id);
      const before=await controlsRepository.findById(tx,id);if(!before)throw new NotFoundError('Control not found.');
      if(actor.role==='control_owner'&&(before.ownerId!==actor.id||(input.ownerId!==undefined&&input.ownerId!==actor.id)))throw new ForbiddenError('You can update your assigned controls. A manager must change responsibility.');
      const afterStatus=input.implementationStatus??before.implementationStatus;
      if(actor.role==='control_owner'&&(afterStatus==='not_applicable'||before.implementationStatus==='not_applicable'))throw new ForbiddenError('A coordinator must review applicability. You cannot exclude an assigned safeguard.');
      if(before.frameworkId&&(afterStatus!==before.implementationStatus&&(afterStatus==='not_applicable'||before.implementationStatus==='not_applicable')||before.implementationStatus==='not_applicable'&&input.implementationNotes!==undefined&&input.implementationNotes!==before.implementationNotes))throw new AppError('Change inclusion or exclusion and its justification in the framework applicability assessment.',409,'APPLICABILITY_WORKFLOW_REQUIRED');
      if(input.frameworkId!==undefined&&input.frameworkId!==before.frameworkId)throw new AppError('Keep the assessed control in its framework. Create a separately scoped control if another framework is needed.',409,'CONTROL_FRAMEWORK_FIXED');
      await checkControl(tx,{...before,...input},actor,id);
      input={...input,lastReviewedAt:null};
      const ok = await controlsRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!ok) throw new NotFoundError('Control not found.');
      await closeResolvedControlActions(tx,id);
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
    if(actor.role==='control_owner')throw new ForbiddenError('An independent coordinator reviews controls.');
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const before=await controlsRepository.findById(tx,id);if(!before)throw new NotFoundError('Control not found.');
      if(before.ownerId===actor.id||before.createdBy===actor.id||before.updatedBy===actor.id)throw new ForbiddenError('Ask an independent reviewer to review this control.');
      if(before.implementationStatus!=='not_applicable'&&(!before.testingNotes?.trim()||!before.implementationNotes?.trim()||!before.ownerId))throw new AppError('Record responsibility, implementation notes and testing results before recording a review.',409,'CONTROL_NOT_READY');
      const ok = await controlsRepository.update(tx, id, {
        lastReviewedAt: new Date(),
        updatedBy: actor.id,
      } as never);
      if (!ok) throw new NotFoundError('Control not found.');
      await closeResolvedControlActions(tx,id);
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
