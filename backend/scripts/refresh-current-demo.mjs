// Refresh only the registered fictional demo, using the current workflow services.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import PDFDocument from 'pdfkit';
import {S3Client,PutObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
if(process.env.DEMO_REFRESH_APPROVED!=='orionsoftlimited-step2')throw Error('Explicit managed-demo refresh approval required');
const restored=process.env.DEMO_REFRESH_RESTORED==='true';
const target=new URL(process.env.DATABASE_URL);
if(restored)assert.equal(target.hostname,'127.0.0.1');
else assert.equal(process.env.RAILWAY_SERVICE_ID,'0315f3e9-e667-446d-8ced-1f22ddc5300d');
const {recordsService:s,obligationSchema,testSchema,actionSchema}=await import('../dist/modules/frameworks/compliance-records.service.js');
const {implementationService}=await import('../dist/modules/frameworks/implementation.service.js');
const {frameworksService}=await import('../dist/modules/frameworks/frameworks.service.js');
const {assessmentService,engagementSchema,worksheetRiskSchema}=await import('../dist/modules/frameworks/assessment.service.js');
const {scopeQuestions}=await import('../dist/modules/frameworks/assessment-rules.js');
const {policiesService}=await import('../dist/modules/policies/policies.service.js');
const {auditsService}=await import('../dist/modules/audits/audits.service.js');
const {createAuditSchema}=await import('../dist/modules/audits/audits.schema.js');
const {incidentsService}=await import('../dist/modules/incidents/incidents.service.js');
const {prisma}=await import('../dist/lib/prisma.js');
// Only the operator traverses the public database proxy. Web request limits stay unchanged.
const transaction=prisma.$transaction.bind(prisma);
prisma.$transaction=(callback,options)=>transaction(callback,{maxWait:10000,timeout:60000,...options});
const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10),today=day(0);
const disclaimer='FICTIONAL DEMONSTRATION ONLY. These records describe sample operations, not the actual staff, assets or compliance position of C&I Leasing Plc. No certification or regulatory filing is asserted.';
const reason=disclaimer+' The independent sample reviewer checked the recorded scope, named responsibility and current workpaper version.';
let phase='target',schema,tenantId,owner,reviewer;
const summary={restored,frameworkScopes:0,consultations:0,risks:0,policies:0,tests:0};
async function one(sql,args=[]){return (await c.query(sql,args)).rows[0];}
const q=t=>'"'+schema+'"."'+t+'"';
async function existing(table,where,args=[]){return one('SELECT * FROM '+q(table)+' WHERE '+where,args);}
async function serviceFinding(audit,title,controlId,testId){let f=await existing('audit_findings','audit_id=$1 AND title=$2',[audit.id,title]);if(!f)f=await auditsService.createFinding(schema,audit.id,{title,description:disclaimer+' A sample access review did not initially identify a second reviewer.',severity:'medium',status:'open',recommendation:'Record the reviewer, correct the process and independently retest the sample.',ownerId:owner.id,dueDate:new Date(day(14)),controlId,testId},owner);return f;}
async function evidenceFile(){
 const title='Demo: current compliance workflow workpapers';let e=await existing('evidence','title=$1 AND deleted_at IS NULL',[title]);if(e?.current_version_id)return e.id;
 const bytes=await new Promise((resolve,reject)=>{const doc=new PDFDocument({size:'A4',margin:48}),chunks=[];doc.on('data',b=>chunks.push(b));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.fontSize(22).text('ComplianceCore - demonstration workpapers');doc.moveDown().fontSize(10).text(disclaimer);for(const [heading,body]of [
  ['Scope consultation','Fictional fleet, marine, payroll and tracking service owners reviewed boundaries, dependencies, record handling and review responsibilities. All staff and sample account names are invented.'],
  ['Control test and sample','The fictional tester compares five simulated account entries with the sample approval list. Four match; the fifth initially lacks a second review. No actual account or device was inspected.'],
  ['Correction and effectiveness retest','The sample owner adds the missing second review and updates the fictional checklist. An independent sample reviewer repeats the five-record check and records the expected outcome.'],
  ['Targeted audit report','The targeted internal demonstration review covers the five invented access entries only. Its single finding is corrected and independently verified. The wider framework assessment remains in progress and has no certification outcome.'],
  ['Supplier and training examples','The fictional supplier questionnaire records service, access, contract, continuity and exceptions. A sample attendance list contains invented role labels only. These examples do not substantiate a real supplier or employee qualification.']])doc.moveDown().fontSize(14).text(heading).moveDown(.4).fontSize(10).text(body);doc.end();});
 const id=e?.id??crypto.randomUUID(),version=crypto.randomUUID(),key=`tenants/${tenantId}/presentation/step2/current-workpapers-v3.pdf`;
 if(!restored){const storage=new S3Client({region:process.env.AWS_REGION,endpoint:process.env.AWS_S3_ENDPOINT,forcePathStyle:process.env.AWS_S3_FORCE_PATH_STYLE==='true',credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY}});await storage.send(new PutObjectCommand({Bucket:process.env.AWS_S3_BUCKET,Key:key,Body:bytes,ContentType:'application/pdf'}));const head=await storage.send(new HeadObjectCommand({Bucket:process.env.AWS_S3_BUCKET,Key:key}));assert.equal(head.ContentLength,bytes.length);}
 if(!e)await c.query(`INSERT INTO ${q('evidence')}(id,title,description,status,created_by) VALUES($1,$2,$3,'active',$4)`,[id,title,disclaimer,owner.id]);
 await c.query(`INSERT INTO ${q('evidence_versions')}(id,evidence_id,version_number,file_name,file_key,file_size_bytes,mime_type,checksum_sha256,upload_status,change_note,uploaded_by) VALUES($1,$2,1,'demo-compliance-workpapers.pdf',$3,$4,'application/pdf',$5,'completed',$6,$7)`,[version,id,key,bytes.length,crypto.createHash('sha256').update(bytes).digest('hex'),'Current fictional workflow sample; no actual customer information.',owner.id]);
 await c.query(`UPDATE ${q('evidence')} SET current_version_id=$2 WHERE id=$1`,[id,version]);return id;
}
try{
 await c.query("SELECT pg_advisory_lock(hashtext('managed-demo-step2-refresh'))");
 const d=await one("SELECT d.*,t.schema_name,t.slug FROM global.presentation_demos d JOIN global.tenants t ON t.id=d.tenant_id WHERE d.demo_key='orionsoftlimited'");
 assert.ok(d&&d.slug==='orionsoftlimited-demo'&&/^tenant_[a-f0-9]{32}$/.test(d.schema_name),'Managed demo required');schema=d.schema_name;tenantId=d.tenant_id;
 const members=(await c.query('SELECT m.user_id id,m.role,u.email FROM global.tenant_memberships m JOIN global.users u ON u.id=m.user_id WHERE m.tenant_id=$1 AND m.is_active AND m.deleted_at IS NULL AND u.is_active',[tenantId])).rows;
 owner=members.find(m=>m.id===d.owner_id&&m.role==='owner');reviewer=members.find(m=>m.role==='admin'&&m.email==='ada.demo@example.invalid');assert.ok(owner&&reviewer);for(const a of [owner,reviewer])a.tenantId=tenantId;
 if(d.seed_version>=3){console.log(JSON.stringify({alreadyCurrent:true,seedVersion:d.seed_version,restored}));process.exitCode=0;}
 else{
  await c.query('SELECT set_config(\'app.current_user_id\',$1,false),set_config(\'app.current_user_role\',\'owner\',false)',[owner.id]);
  phase='evidence';const proof=await evidenceFile();summary.workpaper=proof;
  const frameworks=(await c.query(`SELECT DISTINCT f.id,f.code FROM framework_data.frameworks f JOIN ${q('controls')} x ON x.framework_id=f.id WHERE x.deleted_at IS NULL ORDER BY f.code`)).rows;
  const iso=frameworks.find(f=>f.code==='ISO27001');assert.ok(iso);
  const controls=(await c.query(`SELECT * FROM ${q('controls')} WHERE framework_id=$1 AND deleted_at IS NULL ORDER BY CASE WHEN title ILIKE '%access%' THEN 0 ELSE 1 END,control_ref`,[iso.id])).rows;assert.ok(controls.length>=3);
  const primary=controls[0],second=controls[1];
  for(const ctl of [primary,second])await c.query(`UPDATE ${q('controls')} SET owner_id=$2,implementation_notes=$3,testing_notes=$4,updated_by=$2,updated_at=NOW() WHERE id=$1`,[ctl.id,owner.id,disclaimer+' Apply the sample access checklist and retain the named reviewer.','Sample test outcomes are recorded as dated independently reviewed workpapers.']);
  phase='scope';for(const f of frameworks){
   await implementationService.save(schema,f.id,{scope:disclaimer+' Fictional fleet dispatch documents, marine supplier assurance, outsourced personnel records and Citracks sample-account access in Nigeria. No production devices or customer records are connected.',objective:'Show the practical compliance sequence, recorded evidence, independent review and remaining work without implying certification.',ownerId:owner.id,targetDate:day(60)},owner);await frameworksService.adopt(schema,f.id,owner);summary.frameworkScopes++;
   const consultation=await existing('scope_engagements','framework_id=$1 AND stakeholder=$2',[f.id,'Sample fleet, marine, HR and IT leads']);
   const answers=Object.fromEntries(scopeQuestions.map(question=>[question.key,question.key==='assets'?'Sample tracking access register; fictional payroll records; marine supplier assurance file; fleet dispatch checklist':disclaimer+' The sample service owners agreed the boundaries, named responsibility, supporting records and next review. Actual applicability must be verified before using real data.']));
   await assessmentService.engagement(schema,f.id,engagementSchema.parse({id:consultation?.id,stakeholder:'Sample fleet, marine, HR and IT leads',department:'Fleet, Marine, People and Telematics',consultedOn:today,answers,status:['ISO27001','NDPR','CIS_V8'].includes(f.code)?'confirmed':'draft'}),owner);summary.consultations++;
   await implementationService.preparation(schema,f.id,{obligations:disclaimer+' Review the source-backed internal duties and actual legal applicability; the legacy NDPR catalogue needs comparison with the current NDPA.',riskMethod:'Example method: likelihood 1-5 multiplied by impact 1-5. The owner explains the sample exposure and a separate reviewer checks remaining risk.',assessmentPeriod:'Fictional current-quarter operations and a 60-day follow-up window.',monitoring:'Sample control owners review monthly; unresolved actions remain open. No external certification or regulator filing is generated.'},owner);
  }
  phase='duties';const dutyTitle='Demo: controlled access and documented review';let duty=await existing('compliance_obligations','title=$1',[dutyTitle]);
  if(!duty){[duty]=await s.obligation(schema,obligationSchema.parse({title:dutyTitle,authority:'Fictional internal assurance requirement',sourceUrl:'https://www.iso.org/standard/27001',sourceVersion:'Public overview; fictional internal policy mapping',jurisdiction:'Nigeria - fictional demonstration scope',sector:'Sample fleet, marine, outsourcing and telematics',verifiedOn:today,effectiveOn:today,applicability:'applicable',rationale:disclaimer+' The sample internal policy requires a named access reviewer and retained evidence. The source is an overview, not the complete licensed standard or an actual client contract.',ownerId:owner.id,dueDate:day(14),reviewDate:day(60),evidenceId:proof,controlIds:[primary.id,second.id],status:'in_review'}),owner);}
  if(duty.status==='in_review')await s.reviewObligation(schema,duty.id,{decision:'approve',note:reason},reviewer);
  if(!await existing('compliance_obligations','title=$1',['Demo: verify personnel-data legal applicability']))await s.obligation(schema,obligationSchema.parse({title:'Demo: verify personnel-data legal applicability',authority:'Nigeria Data Protection Commission',sourceUrl:'https://ndpc.gov.ng/download/nigeria-data-protection-act-2023',sourceVersion:'NDPA 2023 - applicability still requires human review',jurisdiction:'Nigeria - fictional example only',sector:'Personnel outsourcing sample',verifiedOn:today,effectiveOn:null,applicability:'pending',rationale:disclaimer+' A responsible person must establish the actual processing roles, activities and current duties. No statutory deadline or legal conclusion is assumed.',ownerId:owner.id,dueDate:null,reviewDate:day(30),evidenceId:null,controlIds:[],status:'in_review'}),owner);
  phase='risks';const risks=(await c.query(`SELECT * FROM ${q('risks')} WHERE deleted_at IS NULL ORDER BY created_at,id`)).rows;
  for(const [i,r]of risks.entries()){
   await s.assignRiskContext(schema,{riskId:r.id,frameworkId:iso.id},owner);
   await assessmentService.risk(schema,iso.id,worksheetRiskSchema.parse({id:r.id,assetName:['Fleet dispatch checklist','Marine assurance file','Continuity exercise record','Fictional payroll records','Management assurance pack','Citracks sample access register'][i%6],assetType:'Demonstration information/service asset',title:r.title,threat:'Loss, misuse or interruption of the named fictional asset or service.',vulnerability:'The sample review is delayed or its independent approval is missing.',consequence:disclaimer+' The invented scenario could delay service, expose records or prevent management from relying on the assurance pack.',assessmentBasis:'Sample likelihood 3 and impact 4 illustrate a material exposure; no actual organisational risk rating is being asserted.',ownerId:owner.id,ratingConfirmed:true,inherentLikelihood:3,inherentImpact:4,treatment:'mitigate',mitigationPlan:'Apply the sample checklist, record named ownership and collect the reviewed evidence. Independently retest outstanding exceptions.',controlIds:[i%2?second.id:primary.id],treatmentDueDate:day(14+i),acceptanceNote:'',residualLikelihood:2,residualImpact:3,residualBasis:'For the fictional example, the reviewed checklist reduces likelihood; significant service or information harm remains possible.',status:'in_treatment'}),owner);
   if(i%2===0)await s.reviewRisk(schema,{riskId:r.id,decision:'approve',note:reason,expiresOn:day(60),controlIds:[primary.id]},reviewer);summary.risks++;
  }
  phase='applicability';for(const ctl of controls.slice(0,3))await implementationService.soa(schema,iso.id,ctl.id,true,disclaimer+' Included because the scoped example handles information, access and accountable review. The full licensed requirements still need a competent assessor.',owner,proof);
  phase='policies';const policies=(await c.query(`SELECT * FROM ${q('policies')} WHERE deleted_at IS NULL ORDER BY created_at,id LIMIT 3`)).rows;
  for(const [i,p]of policies.entries()){
   const suffix='\n\nCurrent demonstration workflow\n'+disclaimer+'\nOwner: fictional service lead. Review: a different authorised sample reviewer. Evidence: the current sample workpaper. Review frequency: every 60 days or following a material change. Staff read the published version; exceptions remain assigned until independently verified.';
   if(!String(p.content).includes('Current demonstration workflow'))await policiesService.update(schema,p.id,{content:(p.content??'')+suffix,status:'draft',ownerId:owner.id,reviewDueDate:new Date(day(60))},owner);
   const current=await policiesService.getById(schema,p.id);
   if(!['published','approved'].includes(current.status)){await policiesService.update(schema,p.id,{status:'in_review'},owner);await policiesService.approve(schema,p.id,reviewer);}if(current.status!=='published')await policiesService.publish(schema,p.id,owner);
   await s.assignAcknowledgments(schema,{policyId:p.id,userIds:[owner.id,reviewer.id],dueDate:day(14+i)},owner);summary.policies++;
  }
  const ownerAcks=(await s.workspace(schema,'acknowledgments',owner)).records.filter(r=>r.user_id===owner.id&&!r.superseded&&!r.acknowledged_at);if(ownerAcks[0])await s.acknowledge(schema,ownerAcks[0].id,owner);
  phase='tests';const tests=[];for(const [ctl,result]of [[primary,'pass'],[second,'fail']]){
   const notes=disclaimer+' Current sample '+result+' test: compare five invented access entries with the fictional approval list.';let test=await existing('control_tests','control_id=$1 AND notes=$2',[ctl.id,notes]);
   if(test&&(await s.workspace(schema,'tests',owner)).records.find(t=>t.id===test.id)?.stale)test=null;
   if(!test)[test]=await s.submitTest(schema,testSchema.parse({controlId:ctl.id,period:'Current demonstration review period',criteria:'Each sample access entry must have a named authorised owner and an independently reviewed approval.',sample:'Five invented sample-account entries, retained in the fictional workpaper; no production data was inspected.',method:'Compare the five sample entries to the named approval list and record the exception and retest result.',result,notes,evidenceIds:[proof]}),owner);
   if(test.status==='submitted')await s.reviewTest(schema,test.id,{decision:'approve',note:reason},reviewer);tests.push(test);summary.tests++;
  }
  phase='audit and CAPA';const auditTitle='Demo: targeted access assurance review';let audit=await existing('audits','title=$1 AND deleted_at IS NULL',[auditTitle]);
  if(!audit)audit=await auditsService.create(schema,createAuditSchema.parse({title:auditTitle,auditType:'internal',frameworkRef:iso.id,status:'in_progress',scope:disclaimer+' Five invented access entries; this is a targeted sample review, not a complete framework audit.',summary:'The initial sample reviewer field was missing. The fictional owner corrected the checklist and the independent reviewer verified the retest.',ownerId:owner.id,startDate:day(-2),endDate:today}),owner);
  const finding=await serviceFinding(audit,'Demo: missing independent review corrected',primary.id,tests[0].id);
  let task=await existing('tasks','title=$1 AND deleted_at IS NULL',['Demo: verify the access-review correction']);if(!task){const id=crypto.randomUUID();await c.query(`INSERT INTO ${q('tasks')}(id,title,description,assigned_to,created_by,status,priority,entity_type,entity_id) VALUES($1,$2,$3,$4,$4,'in_progress','high','finding',$5)`,[id,'Demo: verify the access-review correction',disclaimer,owner.id,finding.id]);task={id};}
  const action=actionSchema.parse({taskId:task.id,sourceKind:'finding',sourceId:finding.id,rootCause:'The fictional checklist did not explicitly require a separate reviewer before completion.',correction:'Add the missing named review and correct the five invented sample entries in the workpaper.',prevention:'Require the reviewer field and use independent workpaper checks at the next sample review.',effectivenessCriteria:'All five fictional entries have the required independent approval and no unexplained exception.',evidenceId:proof,dueDate:day(14)});
  const currentTask=await existing('tasks','id=$1',[task.id]);if(currentTask.corrective_action?.state!=='effective'){await s.action(schema,action,owner);await s.verifyAction(schema,task.id,{decision:'approve',note:reason},reviewer);}
  if(finding.status!=='resolved')await s.closeFinding(schema,{findingId:finding.id,evidenceId:proof,note:reason},reviewer);
  if(audit.status!=='completed'){await s.reviewAudit(schema,{auditId:audit.id,evidenceId:proof,note:reason},reviewer);await auditsService.update(schema,audit.id,{status:'completed'},owner);}
  let pendingTask=await existing('tasks','title=$1 AND deleted_at IS NULL',['Demo: review marine follow-up effectiveness']);if(!pendingTask){const id=crypto.randomUUID();await c.query(`INSERT INTO ${q('tasks')}(id,title,description,assigned_to,created_by,status,priority) VALUES($1,$2,$3,$4,$4,'in_progress','medium')`,[id,'Demo: review marine follow-up effectiveness',disclaimer,owner.id]);pendingTask={id};}if(!(await existing('tasks','id=$1',[pendingTask.id])).corrective_action)await s.action(schema,{...action,taskId:pendingTask.id,sourceKind:'control',sourceId:second.id},owner);
  phase='suppliers and training';const vendors=(await c.query(`SELECT id FROM ${q('vendors')} WHERE deleted_at IS NULL ORDER BY created_at,id LIMIT 2`)).rows;
  for(const [i,v]of vendors.entries()){const found=await existing('vendor_questionnaire_responses',"vendor_id=$1 AND responses->>'service'=$2",[v.id,disclaimer+' Sample outsourced assurance service.']);if(!found){const [record]=await s.submitVendor(schema,{vendorId:v.id,service:disclaimer+' Sample outsourced assurance service.',dataAccess:'Fictional service access is limited to invented sample records; no customer connection exists.',assurance:'Use the demonstration workpaper to explain the expected review and dated supporting proof.',contract:'Illustrative terms require named responsibilities, confidentiality, service review and escalation.',continuity:'The fictional service owner records alternatives and tests a sample handover arrangement.',exceptions:'This is an invented supplier example. No real supplier is approved or certified by this record.',evidenceId:proof,reviewDue:day(60)},owner);if(i===0)await s.reviewVendor(schema,record.id,{decision:'approve',note:reason},reviewer);}}
  const training=(await c.query(`SELECT id,user_id FROM ${q('training_records')} ORDER BY created_at,id LIMIT 4`)).rows;for(const r of training)await s.completeTraining(schema,{recordId:r.id,evidenceId:proof,note:reason},r.user_id===reviewer.id?owner:reviewer);
  phase='incidents';const incident=await one(`SELECT id FROM ${q('incidents')} WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`);if(incident)await s.incident(schema,{incidentId:incident.id,decision:'not_required',obligationId:null,awarenessAt:new Date(Date.now()-3600000).toISOString(),deadlineAt:null,recipient:'',rationale:disclaimer+' This isolated exercise uses invented accounts and no real personal information or external system. The sample review records no actual breach or notification. Real incidents require a separate factual and legal assessment.',evidenceId:proof},owner);
  await c.query('UPDATE global.presentation_demos SET seed_version=3 WHERE demo_key=$1 AND tenant_id=$2',['orionsoftlimited',tenantId]);
  const state=await implementationService.get(schema,iso.id,owner);summary.seedVersion=3;summary.frameworkStatus=state.status;summary.frameworkGates=state.gates.map(g=>({key:g.key,done:g.done}));summary.passed=true;
  await fs.mkdir('../verification/demo-refresh-20261026',{recursive:true});await fs.writeFile('../verification/demo-refresh-20261026/'+(restored?'restored-demo-refresh.json':'online-demo-refresh.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 }
 // Version four demonstrates the current audit and participant screens without
 // replacing retained proof or re-completing existing records.
 phase='current readiness examples';
 const {trainingService}=await import('../dist/modules/training/training.service.js');
 const {createTrainingSchema,assignTrainingRecordsSchema}=await import('../dist/modules/training/training.schema.js');
 const currentAuditTitle='Demo: quarterly evidence review - awaiting independent review';
 let currentAudit=await existing('audits','title=$1 AND deleted_at IS NULL',[currentAuditTitle]);
 if(!currentAudit)currentAudit=await auditsService.create(schema,createAuditSchema.parse({title:currentAuditTitle,auditType:'internal',status:'in_progress',ownerId:owner.id,startDate:today,endDate:day(14),scope:disclaimer+' Review the fictional policy receipts, training assignments and sample access workpapers. This is a limited internal review, not certification.',summary:'Work in progress: the owner collects the report and supporting proof. A different authorised reviewer must check the current report before the audit can be completed.'}),owner);
 const currentTrainingTitle='Demo: evidence handling and independent review';
 let currentTraining=await existing('training_programs','title=$1 AND deleted_at IS NULL',[currentTrainingTitle]);
 if(!currentTraining)currentTraining=await trainingService.create(schema,createTrainingSchema.parse({title:currentTrainingTitle,description:disclaimer+' Open Participants and assignments to see who is assigned. Use Training proof to record attendance or assessment evidence and have it checked by an authorised person other than the participant. An assignment alone does not prove completion.',category:'Compliance awareness',provider:'Fictional internal demonstration',isMandatory:true,ownerId:owner.id,status:'active'}),owner);
 const participantRows=await trainingService.listRecords(schema,currentTraining.id);
 const missingParticipants=[owner.id,reviewer.id].filter(id=>!participantRows.some(r=>(r.userId??r.user_id)===id));
 if(missingParticipants.length)await trainingService.assignRecords(schema,currentTraining.id,assignTrainingRecordsSchema.parse({userIds:missingParticipants,dueDate:day(14),status:'assigned'}),owner);
 await c.query('UPDATE global.presentation_demos SET seed_version=GREATEST(seed_version,4) WHERE demo_key=$1 AND tenant_id=$2',['orionsoftlimited',tenantId]);
 const readiness={passed:true,seedVersion:4,restored,auditAwaitingReview:currentAudit.id,trainingProgramme:currentTraining.id,newAssignments:missingParticipants.length,recordsDeleted:0,passwordChanged:false,retainedEvidenceReplaced:false};
 await fs.mkdir('../verification/readiness-closure-20261026',{recursive:true});
 await fs.writeFile('../verification/readiness-closure-20261026/demo-account-update.json',JSON.stringify(readiness,null,2));
 console.log(JSON.stringify(readiness));
 // Older fictional seeds used completed statuses without the new review proof.
 // Keep their records, but return unsupported claims to the appropriate workflow.
 phase='legacy demo consistency';
 await c.query('SELECT set_config(\'app.current_user_id\',$1,false),set_config(\'app.current_user_role\',\'owner\',false)',[owner.id]);
 const resetTraining=await c.query(`UPDATE ${q('training_records')} SET status='assigned',completed_at=NULL WHERE status='completed' AND completion_evidence_version_id IS NULL`);
 const legacyPolicies=(await c.query(`SELECT id FROM ${q('policies')} WHERE deleted_at IS NULL AND status='published' AND content NOT LIKE '%Current demonstration workflow%'`)).rows;
 for(const p of legacyPolicies)await policiesService.update(schema,p.id,{status:'draft'},owner);
 const legacyAudits=(await c.query(`SELECT id FROM ${q('audits')} WHERE deleted_at IS NULL AND status='completed' AND report_evidence_version_id IS NULL`)).rows;
 for(const a of legacyAudits)await auditsService.update(schema,a.id,{status:'in_progress'},owner);
 const legacyFindings=(await c.query(`SELECT id FROM ${q('audit_findings')} WHERE status IN ('resolved','accepted') AND closure_evidence_version_id IS NULL`)).rows;
 for(const f of legacyFindings)await auditsService.updateFinding(schema,f.id,{status:'open'},owner);
 // Keep a genuine independent-review action available to the owner demo login.
 const pending=await existing('tasks','title=$1 AND deleted_at IS NULL',['Demo: review marine follow-up effectiveness']);
 const coordinator=members.find(m=>m.role==='compliance_manager');
 if(pending?.corrective_action?.state==='awaiting_verification'&&pending.assigned_to===owner.id&&coordinator){
  await c.query(`UPDATE ${q('tasks')} SET assigned_to=$2,updated_at=NOW() WHERE id=$1`,[pending.id,coordinator.id]);
  await s.action(schema,actionSchema.parse({...pending.corrective_action,taskId:pending.id,dueDate:day(14)}),reviewer);
 }
 const consistency={passed:true,restored,trainingReturnedForVerification:resetTraining.rowCount,policiesReturnedToDraft:legacyPolicies.length,auditsReturnedForReview:legacyAudits.length,findingsReopened:legacyFindings.length,recordsDeleted:0};
 await fs.writeFile('../verification/demo-refresh-20261026/'+(restored?'restored':'online')+'-demo-consistency.json',JSON.stringify(consistency,null,2));console.log(JSON.stringify(consistency));
}catch(error){console.error('Managed demo refresh failed at '+phase+': '+error.message);process.exitCode=1;}
finally{await c.query("SELECT pg_advisory_unlock(hashtext('managed-demo-step2-refresh'))").catch(()=>{});await c.end();await prisma.$disconnect();}
process.exit(process.exitCode??0);
