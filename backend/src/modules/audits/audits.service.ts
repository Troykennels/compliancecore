import { assertActiveMembers } from '../../lib/active-member';
import { assertDateRange } from '../../lib/date-range';
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
    assertDateRange(input);
    await assertActiveMembers(schemaName,[input.ownerId]);
    if(input.status==='completed')throw new AppError('Plan the audit, record its report and obtain independent review before completion.',409,'AUDIT_REVIEW_REQUIRED');
    if(input.auditType==='certification') {
      const implementation=(await implementationService.overview(schemaName,actor)).find(x=>[x.framework.id,x.framework.code].includes(input.frameworkRef??''));
      if(implementation?.profile.outcome!=='certification')throw new AppError('This framework uses assessment, attestation or regulatory reporting rather than a certification workflow. Choose the appropriate audit type.',422,'CERTIFICATION_NOT_APPLICABLE');
      if(implementation.status!=='implemented')throw new AppError('Complete the compliance assessment and obtain independent sign-off before the certification assessment.',409,'IMPLEMENTATION_REQUIRED');
    }
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const { id } = await auditsRepository.create(tx, { ...input, createdBy: actor.id });
      return auditsRepository.findById(tx, id);
    });
  },

  async update(schemaName: string, id: string, input: UpdateAuditInput, actor: Actor) {
    await assertActiveMembers(schemaName,[input.ownerId]);
    const before=await this.getById(schemaName,id);
    if((input.auditType??before.auditType)==='certification') {
      const implementation=(await implementationService.overview(schemaName,actor)).find(x=>[x.framework.id,x.framework.code].includes(input.frameworkRef??before.frameworkRef??''));
      if(implementation?.profile.outcome!=='certification')throw new AppError('Certification is not the applicable assessment route for this framework.',422,'CERTIFICATION_NOT_APPLICABLE');
      if(implementation.status!=='implemented')throw new AppError('A current signed-off compliance assessment is required before certification.',409,'IMPLEMENTATION_REQUIRED');
    }
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      await tx.$queryRawUnsafe('SELECT id FROM audits WHERE id=$1::uuid FOR UPDATE',id);
      const current=await auditsRepository.findById(tx,id);
      if(!current)throw new NotFoundError('Audit not found.');
      assertDateRange({...current,...input});
      const reportChanged=Object.keys(input).some(key=>key!=='status');
      if(input.status==='completed'){
        if(current.status==='cancelled')throw new AppError('Reopen this cancelled audit and obtain a fresh report review before completion.',409,'AUDIT_REVIEW_REQUIRED');
        const reviewed=await tx.$queryRawUnsafe<Array<{reviewed_by:string|null}>>("SELECT a.reviewed_by FROM audits a JOIN evidence e ON e.id=a.report_evidence_id JOIN evidence_versions v ON v.id=e.current_version_id WHERE a.id=$1::uuid AND a.reviewed_at IS NOT NULL AND a.scope IS NOT NULL AND a.summary IS NOT NULL AND a.end_date IS NOT NULL AND a.report_evidence_version_id=e.current_version_id AND e.deleted_at IS NULL AND e.status='active' AND v.upload_status='completed' AND (e.retention_date IS NULL OR e.retention_date>NOW()) FOR UPDATE OF a",id);
        if(!reviewed[0]?.reviewed_by)throw new AppError('Attach the final report and obtain an independent review before completing the audit.',409,'AUDIT_REVIEW_REQUIRED');
        const pending = await tx.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM audit_requests r WHERE r.audit_id=$1::uuid AND r.deleted_at IS NULL AND
          (r.status<>'accepted' OR NOT EXISTS(SELECT 1 FROM audit_request_evidence l WHERE l.request_id=r.id)
           OR EXISTS(SELECT 1 FROM audit_request_evidence l JOIN evidence e ON e.id=l.evidence_id JOIN evidence_versions v ON v.id=l.evidence_version_id
             WHERE l.request_id=r.id AND (e.deleted_at IS NOT NULL OR e.status<>'active' OR v.upload_status<>'completed' OR e.retention_date<=NOW()))) LIMIT 1`,id);
        if(pending.length)throw new AppError('Accept every active evidence request and retain its valid evidence before completing the audit.',409,'AUDIT_REQUESTS_PENDING');
        if(Object.keys(input).some(key=>key!=='status'))throw new AppError('Save report changes first, obtain a fresh review, then complete the audit.',409,'AUDIT_REVIEW_REQUIRED');
      }
      if(reportChanged||input.status==='cancelled')await tx.$executeRawUnsafe('UPDATE audits SET reviewed_by=NULL,reviewed_at=NULL WHERE id=$1::uuid',id);
      const changes={...input,...(reportChanged&&current.status==='completed'&&!input.status?{status:'in_progress' as const}:{}),updatedBy:actor.id};
      const ok = await auditsRepository.update(tx, id, changes);
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
    await assertActiveMembers(schemaName,[input.ownerId]);
    if(['resolved','accepted'].includes(input.status??''))throw new AppError('Create the finding as open. Close it after corrective work and independent verification.',409,'FINDING_REVIEW_REQUIRED');
    return withTenantSchema(schemaName, async (tx) => {
      await setAuditSessionVars(tx, actor);
      const audit = await auditsRepository.findById(tx, auditId);
      if (!audit) throw new NotFoundError('Audit not found.');
      if(input.controlId){const rows=await tx.$queryRawUnsafe<unknown[]>('SELECT 1 FROM controls WHERE id=$1::uuid AND deleted_at IS NULL',input.controlId);if(!rows.length)throw new NotFoundError('Related control');}
      if(input.testId){const rows=await tx.$queryRawUnsafe<Array<{control_id:string;test_data:{auditId?:string}}>>('SELECT control_id,test_data FROM control_tests WHERE id=$1::uuid',input.testId);if(!rows.length||(input.controlId&&rows[0].control_id!==input.controlId)||(rows[0].test_data.auditId&&rows[0].test_data.auditId!==auditId))throw new AppError('Choose a test from the related audit and safeguard.',422);input={...input,controlId:rows[0].control_id};}
      const { id } = await auditsRepository.createFinding(tx, auditId, {
        ...input,
        createdBy: actor.id,
      });
      await tx.$executeRawUnsafe('UPDATE audit_findings SET control_id=$2::uuid,test_id=$3::uuid WHERE id=$1::uuid',id,input.controlId??null,input.testId??null);
      if(audit.status==='completed')await tx.$executeRawUnsafe("UPDATE audits SET status='in_progress',reviewed_by=NULL,reviewed_at=NULL,updated_at=NOW() WHERE id=$1::uuid",auditId);
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
      if(['resolved','accepted'].includes(input.status??''))throw new AppError('Use the independent finding closure action after verifying corrective-task effectiveness.',409,'FINDING_REVIEW_REQUIRED');
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
