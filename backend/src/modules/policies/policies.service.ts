import { withTenantSchema } from '../../lib/prisma';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { AppError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { policiesRepository } from './policies.repository';
import type { CreatePolicyInput, UpdatePolicyInput, ListPoliciesInput } from './policies.schema';
import type { Prisma } from '@prisma/client';

type Actor = { id: string; email: string; role: string | null; tenantId: string | null };
async function activeOwner(tx:Prisma.TransactionClient,ownerId:string|null|undefined,actor:Actor) {
 if(!ownerId)return;
 const rows=await tx.$queryRawUnsafe<unknown[]>('SELECT 1 FROM global.tenant_memberships m JOIN global.users u ON u.id=m.user_id WHERE m.tenant_id=$1::uuid AND m.user_id=$2::uuid AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL',actor.tenantId,ownerId);
 if(!rows.length)throw new AppError('Choose an active member of this organisation as the policy owner.',422,'INVALID_OWNER');
}
function reviewable(p: {ownerId?:string|null;content?:string|null;reviewDueDate?:Date|null}) {
  if(!p.ownerId||!p.content?.trim()||!p.reviewDueDate||new Date(p.reviewDueDate).getTime()<Date.now())throw new AppError('Add a responsible owner, policy content and a future review date before submitting for approval.',422,'POLICY_NOT_READY');
}

export const policiesService = {
  async list(schemaName: string, filters: ListPoliciesInput) {
    return withTenantSchema(schemaName, (tx) =>
      policiesRepository.findAll(tx, filters),
    );
  },

  async getById(schemaName: string, id: string) {
    const policy = await withTenantSchema(schemaName, (tx) =>
      policiesRepository.findById(tx, id),
    );
    if (!policy) throw new NotFoundError('Policy not found.');
    return policy;
  },

  async create(schemaName: string, input: CreatePolicyInput, actor: Actor) {
    if(input.status!=='draft')throw new AppError('Create the policy as a draft, then submit it for independent approval.',409,'POLICY_REVIEW_REQUIRED');
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const { id } = await policiesRepository.create(tx, { ...input, createdBy: actor.id });
      await activeOwner(tx,input.ownerId,actor);
      await tx.$executeRawUnsafe("INSERT INTO policy_versions(policy_id,version_number,content,change_note,created_by) VALUES($1::uuid,1,$2,'Initial draft',$3::uuid) ON CONFLICT DO NOTHING",id,input.content??null,actor.id);
      return policiesRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdatePolicyInput, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      await tx.$queryRawUnsafe('SELECT id FROM policies WHERE id=$1::uuid FOR UPDATE',id);
      const before=await policiesRepository.findById(tx,id);if(!before)throw new NotFoundError('Policy not found.');
      await activeOwner(tx,input.ownerId??before.ownerId,actor);
      const contentChanged=input.content!==undefined&&input.content!==before.content;
      if(contentChanged)await tx.$executeRawUnsafe("INSERT INTO policy_versions(policy_id,version_number,content,change_note,created_by) VALUES($1::uuid,$2,$3,'Previous saved content',$4::uuid) ON CONFLICT DO NOTHING",id,before.currentVersion,before.content,before.createdBy??actor.id);
      if(input.status==='approved'||input.status==='published')throw new AppError('Approval and publication use their separate review actions.',409,'POLICY_REVIEW_REQUIRED');
      if(input.status==='in_review')reviewable({...before,...input});
      if(['approved','published'].includes(before.status)) {
        input={...input,status:input.status==='archived'?'archived':'draft'};
        await tx.$executeRawUnsafe('UPDATE policies SET approved_at=NULL,approved_by=NULL WHERE id=$1::uuid',id);
      }
      const ok = await policiesRepository.update(tx, id, { ...input, updatedBy: actor.id });
      if (!ok) throw new NotFoundError('Policy not found.');
      if(contentChanged){await tx.$executeRawUnsafe('UPDATE policies SET current_version=current_version+1 WHERE id=$1::uuid',id);await tx.$executeRawUnsafe("INSERT INTO policy_versions(policy_id,version_number,content,change_note,created_by) VALUES($1::uuid,$2,$3,'Content revised; approval required',$4::uuid)",id,before.currentVersion+1,input.content??null,actor.id);}
      return policiesRepository.findById(tx, id);
    });
  },

  async delete(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const ok = await policiesRepository.softDelete(tx, id, actor.id);
      if (!ok) throw new NotFoundError('Policy not found.');
    });
  },

  async publish(schemaName: string, id: string, actor: Actor) {
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      await tx.$queryRawUnsafe('SELECT id FROM policies WHERE id=$1::uuid FOR UPDATE',id);
      const before=await policiesRepository.findById(tx,id);if(!before)throw new NotFoundError('Policy not found.');
      reviewable(before);
      await activeOwner(tx,before.ownerId,actor);
      if(before.status!=='approved'||!before.approvedBy||!before.approvedAt)throw new AppError('An independently approved policy is required before publication.',409,'POLICY_REVIEW_REQUIRED');
      const ok = await policiesRepository.publish(tx, id, actor.id);
      if (!ok) throw new NotFoundError('Policy not found.');
      return policiesRepository.findById(tx, id);
    });
  },
  async approve(schemaName:string,id:string,actor:Actor) {
    if(!['owner','admin','compliance_manager','msp_admin'].includes(actor.role??''))throw new ForbiddenError('An authorised policy reviewer is required.');
    return withTenantSchema(schemaName,async tx=>{
      await setAuditSessionVars(tx,actor);await tx.$queryRawUnsafe('SELECT id FROM policies WHERE id=$1::uuid FOR UPDATE',id);
      const p=await policiesRepository.findById(tx,id);if(!p)throw new NotFoundError('Policy not found.');reviewable(p);
      await activeOwner(tx,p.ownerId,actor);
      if(p.status!=='in_review')throw new AppError('Submit the current policy for review first.',409,'POLICY_REVIEW_REQUIRED');
      if(p.ownerId===actor.id||p.createdBy===actor.id||p.updatedBy===actor.id)throw new ForbiddenError('The policy owner, author and last editor cannot approve their own work.');
      await tx.$executeRawUnsafe("UPDATE policies SET status='approved',approved_by=$2::uuid,approved_at=NOW(),updated_at=NOW() WHERE id=$1::uuid",id,actor.id);
      return policiesRepository.findById(tx,id);
    });
  },
  async versions(schemaName:string,id:string) {return withTenantSchema(schemaName,async tx=>{if(!await policiesRepository.findById(tx,id))throw new NotFoundError('Policy not found.');return tx.$queryRawUnsafe('SELECT version_number,content,change_note,created_at FROM policy_versions WHERE policy_id=$1::uuid ORDER BY version_number DESC',id);});},
};
