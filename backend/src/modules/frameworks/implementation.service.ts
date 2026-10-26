import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { withTenantSchema } from '../../lib/prisma';
import { AppError, NotFoundError, ForbiddenError } from '../../lib/errors';
import { setAuditSessionVars } from '../../middleware/audit.middleware';
import { implementationGates, implementationSnapshot, effectiveImplementationStatus, type ImplementationControl, type ImplementationPolicy } from './implementation-rules';

type Tx=Prisma.TransactionClient;
type Actor={id:string;email:string;role:string|null;tenantId:string|null};
interface Preparation {baseline?:string;risks?:string;managementReview?:string;internalAuditId?:string|null;trainingProgramId?:string|null}
interface Plan {framework_id:string;scope:string;objective:string;owner_id:string;target_date:Date;status:string;review_hash:string|null;review_due_at:Date|null;submitted_by:string|null;approved_by:string|null;approved_at:Date|null;review_note:string|null;preparation:Preparation}
interface Framework {id:string;code:string;name:string;short_name:string|null;library_count:number;library_refs:string[]}
type Control=ImplementationControl & {framework_id:string; updated_at:Date};
type Policy=ImplementationPolicy & {framework_ids:string[];updated_at:Date};
export const implementationPlanSchema=z.object({scope:z.string().trim().min(30).max(5000),objective:z.string().trim().min(20).max(3000),ownerId:z.string().uuid(),targetDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Enter a valid date.')});
function manager(actor:Actor) { if(!['owner','admin','compliance_manager','msp_admin'].includes(actor.role??''))throw new ForbiddenError('Only an owner, administrator or compliance manager can change an implementation plan.'); }
async function lock(tx:Tx,id:string) {await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text','framework-implementation:'+id);}
async function event(tx:Tx,id:string,actor:Actor,action:string,note:string|null=null) {await tx.$executeRawUnsafe('INSERT INTO framework_implementation_events(framework_id,actor_id,action,note) VALUES($1::uuid,$2::uuid,$3,$4)',id,actor.id,action,note);}
async function load(tx:Tx,tenantId:string|null) {
 const frameworks=await tx.$queryRawUnsafe<Framework[]>(`SELECT f.id,f.code,f.name,f.short_name,(SELECT count(*)::int FROM framework_data.framework_controls l WHERE l.framework_id=f.id) library_count,ARRAY(SELECT l.control_ref FROM framework_data.framework_controls l WHERE l.framework_id=f.id ORDER BY l.control_ref) library_refs FROM framework_data.frameworks f WHERE f.deleted_at IS NULL ORDER BY f.name`);
 const plans=await tx.$queryRawUnsafe<Plan[]>("SELECT p.*,COALESCE(NULLIF(concat_ws(' ',u.first_name,u.last_name),''),u.email) owner_name FROM framework_implementations p LEFT JOIN global.users u ON u.id=p.owner_id");
 const controls=await tx.$queryRawUnsafe<Control[]>(`SELECT c.*, EXISTS(SELECT 1 FROM global.tenant_memberships m JOIN global.users u ON u.id=m.user_id WHERE m.tenant_id=$1::uuid AND m.user_id=c.owner_id AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL) owner_active,
 (SELECT count(*)::int FROM evidence_links l JOIN evidence e ON e.id=l.evidence_id JOIN evidence_versions v ON v.id=e.current_version_id WHERE l.linked_type='control' AND l.linked_id=c.id AND e.deleted_at IS NULL AND e.status='active' AND (e.retention_date IS NULL OR e.retention_date>NOW()) AND v.upload_status='completed') current_evidence
 ,(SELECT COALESCE(NULLIF(concat_ws(' ',u.first_name,u.last_name),''),u.email) FROM global.users u WHERE u.id=c.owner_id) owner_name
 FROM controls c WHERE c.deleted_at IS NULL ORDER BY c.control_ref,c.id`,tenantId);
 const policies=await tx.$queryRawUnsafe<Policy[]>(`SELECT p.*,EXISTS(SELECT 1 FROM global.tenant_memberships m JOIN global.users u ON u.id=m.user_id WHERE m.tenant_id=$1::uuid AND m.user_id=p.owner_id AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL) owner_active FROM policies p WHERE p.deleted_at IS NULL ORDER BY p.id`,tenantId);
 const evidence=await tx.$queryRawUnsafe<Array<{linked_id:string;[key:string]:unknown}>>(`SELECT l.linked_id,l.id link_id,e.id,e.status,e.retention_date,e.current_version_id,v.checksum_sha256,v.upload_status FROM evidence_links l JOIN evidence e ON e.id=l.evidence_id LEFT JOIN evidence_versions v ON v.id=e.current_version_id WHERE l.linked_type='control' AND e.deleted_at IS NULL ORDER BY l.id`);
 const soa=await tx.$queryRawUnsafe<Array<{control_id:string;applicable:boolean;justification:string;decided_by:string;decided_at:Date}>>('SELECT * FROM framework_control_applicability ORDER BY control_id');
 const audits=await tx.$queryRawUnsafe<Array<{id:string;title:string;framework_ref:string|null;audit_type:string;status:string;summary:string|null;scope:string|null;end_date:Date|null;updated_at:Date}>>('SELECT * FROM audits WHERE deleted_at IS NULL ORDER BY id');
 const findings=await tx.$queryRawUnsafe<Array<{audit_id:string;status:string}>>('SELECT * FROM audit_findings ORDER BY id');
 const training=await tx.$queryRawUnsafe<Array<{id:string;title:string;status:string}>>('SELECT id,title,status FROM training_programs WHERE deleted_at IS NULL ORDER BY id');
 const trainingRecords=await tx.$queryRawUnsafe<Array<{program_id:string;user_id:string;status:string;completed_at:Date|null}>>('SELECT * FROM training_records ORDER BY id');
 const tasks=await tx.$queryRawUnsafe<Array<{id:string;framework_id:string;status:string}>>('SELECT id,framework_id,status FROM tasks WHERE deleted_at IS NULL AND framework_id IS NOT NULL ORDER BY id');
 return {frameworks,plans,controls,policies,evidence,soa,audits,findings,training,trainingRecords,tasks};
}
type Loaded=Awaited<ReturnType<typeof load>>;
function state(data:Loaded,id:string) {
 const framework=data.frameworks.find(f=>f.id===id);if(!framework)throw new NotFoundError('Framework not found.');
 const plan=data.plans.find(p=>p.framework_id===id)??null;
 const controls=data.controls.filter(c=>c.framework_id===id);
 const policies=data.policies.filter(p=>(p.framework_ids??[]).includes(id)||(p.framework_ids??[]).includes(framework.code));
 const ids=new Set(controls.map(c=>c.id));
 const baseGates=implementationGates(plan,controls,policies);
 const soa=data.soa.filter(s=>ids.has(s.control_id));
 const prep=plan?.preparation??{};
 const audit=data.audits.find(a=>a.id===prep.internalAuditId);
 const findings=data.findings.filter(f=>f.audit_id===audit?.id);
 const training=data.training.find(t=>t.id===prep.trainingProgramId);
 const trainingRecords=data.trainingRecords.filter(t=>t.program_id===training?.id);
 const owners=new Set(controls.filter(c=>c.implementation_status!=='not_applicable').map(c=>c.owner_id).filter(Boolean));if(plan)owners.add(plan.owner_id);
 const tasks=data.tasks.filter(t=>t.framework_id===id);
 const completeLibrary=framework.library_count>0&&framework.library_refs.every(ref=>controls.some(c=>c.control_ref===ref));
 const gates=[baseGates[0],
 {key:'baseline',title:'Assess current gaps and risks',done:Boolean(prep.baseline?.trim()&&prep.risks?.trim()),detail:'Record the current position, gaps, priorities and risk treatment decisions before claiming readiness.',href:'/risks'},
 {key:'soa',title:'Review the Statement of Applicability',done:completeLibrary&&controls.length>0&&controls.every(c=>soa.some(s=>s.control_id===c.id&&s.justification.trim().length>=20&&s.applicable===(c.implementation_status!=='not_applicable'))),detail:`${soa.length}/${controls.length} applicability decisions recorded. Every library requirement must be covered; exclusions need a reason.`,href:'/frameworks'},
 baseGates[1],baseGates[2],baseGates[3],
 {key:'training',title:'Train the responsible people',done:Boolean(training?.status==='active'&&owners.size>0&&[...owners].every(owner=>trainingRecords.some(t=>t.user_id===owner&&t.status==='completed'&&t.completed_at))),detail:'Link an active training programme with completed records for the implementation owner and every applicable control owner.',href:'/training'},
 baseGates[4],baseGates[5],
 {key:'internal_audit',title:'Complete internal audit and corrections',done:Boolean(audit?.audit_type==='internal'&&audit.status==='completed'&&audit.scope?.trim()&&audit.summary?.trim()&&audit.end_date&&new Date(audit.end_date).getTime()<=Date.now()&&[id,framework.code].includes(audit.framework_ref??'')&&findings.every(f=>['resolved','accepted'].includes(f.status))&&tasks.every(t=>['completed','cancelled'].includes(t.status))),detail:'Link a completed internal audit for this framework, record its conclusion and close or formally accept findings. Resolve the implementation action list.',href:'/audits'},
 {key:'management_review',title:'Record management review',done:Boolean(prep.managementReview?.trim()),detail:'Record management decisions, remaining accepted risks, resources and the next review arrangements.',href:'/frameworks'}];
 const hash=implementationSnapshot({scope:plan?.scope,objective:plan?.objective,owner:plan?.owner_id,target:plan?.target_date,prep,soa,controls,policies,audit,findings,training,trainingRecords,tasks,evidence:data.evidence.filter(e=>ids.has(e.linked_id))});
 const status=effectiveImplementationStatus(plan,hash,gates);
 const applicable=controls.filter(c=>c.implementation_status!=='not_applicable');
 return {framework,plan,status,gates,hash,controls,policies,soa,progress:Math.round(gates.filter(g=>g.done).length/gates.length*100),stats:{controls:controls.length,applicable:applicable.length,implemented:applicable.filter(c=>c.implementation_status==='implemented').length,evidenced:applicable.filter(c=>Number(c.current_evidence)>0).length,unassigned:applicable.filter(c=>!c.owner_id||!c.owner_active).length,overdue:applicable.filter(c=>c.due_date&&new Date(c.due_date).getTime()<Date.now()&&c.implementation_status!=='implemented').length}};
}
function publicState(s:ReturnType<typeof state>) {
 const {hash:_hash,controls,policies,...rest}=s;
 return {...rest,controls:controls.map(c=>({id:c.id,controlRef:c.control_ref,title:c.title,status:c.implementation_status,ownerId:c.owner_id,ownerName:(c as Control&{owner_name?:string}).owner_name??null,hasEvidence:Number(c.current_evidence)>0,reviewedAt:c.last_reviewed_at})),policies:policies.map(p=>({id:p.id,title:p.title,status:p.status,reviewDueDate:p.review_due_date}))};
}
export const implementationService={
 async overview(schema:string,actor:Actor) {return withTenantSchema(schema,async tx=>{const data=await load(tx,actor.tenantId);return data.frameworks.filter(f=>data.plans.some(p=>p.framework_id===f.id)||data.controls.some(c=>c.framework_id===f.id)).map(f=>publicState(state(data,f.id)));},{timeout:20000});},
 async get(schema:string,id:string,actor:Actor) {return withTenantSchema(schema,async tx=>{const data=await load(tx,actor.tenantId);const s=publicState(state(data,id));const events=await tx.$queryRawUnsafe('SELECT action,actor_id,created_at,note FROM framework_implementation_events WHERE framework_id=$1::uuid ORDER BY created_at DESC LIMIT 30',id);return {...s,events,auditOptions:data.audits.filter(a=>[id,s.framework.code].includes(a.framework_ref??'')).map(a=>({id:a.id,title:a.title,status:a.status})),trainingOptions:data.training};},{timeout:20000});},
 async preparation(schema:string,id:string,input:Preparation,actor:Actor) {
  manager(actor);return withTenantSchema(schema,async tx=>{await lock(tx,id);await setAuditSessionVars(tx,actor);const result=await tx.$executeRawUnsafe("UPDATE framework_implementations SET preparation=$2::jsonb,status=CASE WHEN status='planning' THEN 'planning' ELSE 'in_progress' END,review_hash=NULL,updated_at=NOW() WHERE framework_id=$1::uuid",id,JSON.stringify(input));if(!result)throw new AppError('Save the implementation scope first.',409,'SCOPE_REQUIRED');await event(tx,id,actor,'preparation_updated');return {saved:true};});
 },
 async soa(schema:string,id:string,controlId:string,applicable:boolean,justification:string,actor:Actor) {
  manager(actor);return withTenantSchema(schema,async tx=>{await lock(tx,id);await setAuditSessionVars(tx,actor);const c=await tx.$queryRawUnsafe<unknown[]>('SELECT 1 FROM controls WHERE id=$1::uuid AND framework_id=$2::uuid AND deleted_at IS NULL',controlId,id);if(!c.length)throw new NotFoundError('Control not found in this framework.');
   await tx.$executeRawUnsafe('INSERT INTO framework_control_applicability(control_id,applicable,justification,decided_by) VALUES($1::uuid,$2,$3,$4::uuid) ON CONFLICT(control_id) DO UPDATE SET applicable=$2,justification=$3,decided_by=$4::uuid,decided_at=NOW()',controlId,applicable,justification,actor.id);
   await tx.$executeRawUnsafe("UPDATE controls SET implementation_status=CASE WHEN NOT $2 THEN 'not_applicable' WHEN implementation_status='not_applicable' THEN 'planned' ELSE implementation_status END,implementation_notes=CASE WHEN NOT $2 THEN $3 ELSE implementation_notes END,last_reviewed_at=NULL,updated_by=$4::uuid,updated_at=NOW() WHERE id=$1::uuid",controlId,applicable,justification,actor.id);
   await event(tx,id,actor,'soa_decision',controlId+': '+(applicable?'included':'excluded'));return {saved:true};});
 },
 async members(schema:string,actor:Actor) {return withTenantSchema(schema,tx=>tx.$queryRawUnsafe(`SELECT u.id,COALESCE(NULLIF(concat_ws(' ',u.first_name,u.last_name),''),u.email) name FROM global.tenant_memberships m JOIN global.users u ON u.id=m.user_id WHERE m.tenant_id=$1::uuid AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL ORDER BY name`,actor.tenantId));},
 async save(schema:string,id:string,input:z.infer<typeof implementationPlanSchema>,actor:Actor) {
  manager(actor);if(input.targetDate<new Date().toISOString().slice(0,10))throw new AppError('Choose a current or future target date.',422,'INVALID_TARGET_DATE');
  return withTenantSchema(schema,async tx=>{
   await lock(tx,id);await setAuditSessionVars(tx,actor);
   const f=await tx.$queryRawUnsafe<Array<{id:string}>>('SELECT id FROM framework_data.frameworks WHERE id=$1::uuid AND deleted_at IS NULL AND is_active',id);if(!f.length)throw new NotFoundError('Active framework not found.');
   const owner=await tx.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM global.tenant_memberships m JOIN global.users u ON u.id=m.user_id WHERE m.user_id=$1::uuid AND m.tenant_id=$2::uuid AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL`,input.ownerId,actor.tenantId);if(!owner.length)throw new AppError('Choose an active member of this organisation as owner.',422,'INVALID_OWNER');
   await tx.$executeRawUnsafe(`INSERT INTO framework_implementations(framework_id,scope,objective,owner_id,target_date,created_by) VALUES($1::uuid,$2,$3,$4::uuid,$5::date,$6::uuid) ON CONFLICT(framework_id) DO UPDATE SET scope=$2,objective=$3,owner_id=$4::uuid,target_date=$5::date,status=CASE WHEN framework_implementations.status='planning' THEN 'planning' ELSE 'in_progress' END,review_hash=NULL,submitted_by=NULL,submitted_at=NULL,approved_by=NULL,approved_at=NULL,review_due_at=NULL,updated_at=NOW()`,id,input.scope,input.objective,input.ownerId,input.targetDate,actor.id);
   await event(tx,id,actor,'scope_saved');return {saved:true};
  });
 },
 async review(schema:string,id:string,action:'submit'|'approve'|'return',note:string,actor:Actor) {
  if(action==='submit')manager(actor);
  if(action!=='submit'&&!['owner','admin','compliance_manager','auditor','msp_admin'].includes(actor.role??''))throw new ForbiddenError('An authorised independent reviewer is required.');
  return withTenantSchema(schema,async tx=>{
   await lock(tx,id);await setAuditSessionVars(tx,actor);const s=state(await load(tx,actor.tenantId),id);
   if(!s.plan)throw new AppError('Define the implementation scope first.',409,'SCOPE_REQUIRED');
   if(action==='return') {if(note.trim().length<10)throw new AppError('Explain the changes needed before returning this plan.',422,'REVIEW_NOTE_REQUIRED');await tx.$executeRawUnsafe(`UPDATE framework_implementations SET status='in_progress',review_hash=NULL,submitted_by=NULL,submitted_at=NULL,updated_at=NOW() WHERE framework_id=$1::uuid`,id);}
   else {
    if(s.gates.some(g=>!g.done))throw new AppError('Complete every implementation step before review or sign-off.',409,'IMPLEMENTATION_INCOMPLETE',{gates:s.gates});
    if(action==='submit') {
     if(s.plan.status==='planning')throw new AppError('Start the implementation before requesting review.',409,'IMPLEMENTATION_NOT_STARTED');
     await tx.$executeRawUnsafe(`UPDATE framework_implementations SET status='in_review',submitted_by=$2::uuid,submitted_at=NOW(),review_hash=$3,updated_at=NOW() WHERE framework_id=$1::uuid`,id,actor.id,s.hash);
    } else {
     if(s.plan.status!=='in_review'||s.plan.review_hash!==s.hash)throw new AppError('The records changed or are not awaiting review. Submit the current implementation again.',409,'STALE_IMPLEMENTATION');
     if(s.plan.owner_id===actor.id||s.plan.submitted_by===actor.id)throw new ForbiddenError('The implementation owner and submitter cannot approve their own implementation.');
     if(note.trim().length<20)throw new AppError('Record the review performed and the sign-off conclusion.',422,'REVIEW_NOTE_REQUIRED');
     await tx.$executeRawUnsafe(`UPDATE framework_implementations SET status='implemented',approved_by=$2::uuid,approved_at=NOW(),review_due_at=NOW()+INTERVAL '90 days',review_note=$3,updated_at=NOW() WHERE framework_id=$1::uuid`,id,actor.id,note);
    }
   }
   await event(tx,id,actor,action,note);return {saved:true};
  },{timeout:20000});
 },
 async actions(schema:string,id:string,actor:Actor) {
  manager(actor);return withTenantSchema(schema,async tx=>{
   await lock(tx,id);await setAuditSessionVars(tx,actor);const s=state(await load(tx,actor.tenantId),id);if(!s.plan||s.plan.status==='planning')throw new AppError('Start a scoped implementation first.',409,'SCOPE_REQUIRED');
   let created=0;
   for(const c of s.controls) {
    const needsWork=c.implementation_status!=='not_applicable'&&(c.implementation_status!=='implemented'||!c.owner_active||!c.implementation_notes?.trim()||!c.testing_notes?.trim()||!c.last_reviewed_at||new Date(c.last_reviewed_at).getTime()+c.review_frequency_days*86400000<Date.now()||Number(c.current_evidence)===0);
    if(needsWork)created+=await tx.$executeRawUnsafe(`INSERT INTO tasks(title,description,assigned_to,assigned_by,due_date,priority,status,entity_type,entity_id,framework_id,tags,created_by) SELECT $1,$2,$3::uuid,$4::uuid,$5::date,'high','todo','control',$6::uuid,$7::uuid,ARRAY['framework-implementation'],$4::uuid WHERE NOT EXISTS(SELECT 1 FROM tasks WHERE entity_type='control' AND entity_id=$6::uuid AND framework_id=$7::uuid AND 'framework-implementation'=ANY(tags) AND deleted_at IS NULL AND status NOT IN ('completed','cancelled'))`,'Complete '+c.control_ref,`Implementation action for ${s.framework.name}: confirm applicability, assign responsibility, record implementation and testing notes, attach current evidence and request review.`,c.owner_active?c.owner_id:s.plan.owner_id,actor.id,s.plan.target_date,c.id,id);
    else await tx.$executeRawUnsafe(`UPDATE tasks SET status='completed',completed_at=NOW(),updated_at=NOW() WHERE entity_type='control' AND entity_id=$1::uuid AND framework_id=$2::uuid AND 'framework-implementation'=ANY(tags) AND deleted_at IS NULL AND status NOT IN ('completed','cancelled')`,c.id,id);
   }
   await event(tx,id,actor,'actions_synchronised',`${created} new control actions`);return {created};
  },{timeout:30000});
 }
};
