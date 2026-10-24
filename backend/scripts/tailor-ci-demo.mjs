import pg from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import PDFDocument from 'pdfkit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { organisation, disclaimer, policies, risks, tasks, evidence } from './ci-demo-content.mjs';

if (process.env.DEMO_SEED_CONFIRM !== 'orionsoftlimited') throw Error('Explicit managed-demo confirmation required');
const target = new URL(process.env.DATABASE_URL || '');
const local = ['localhost','127.0.0.1'].includes(target.hostname);
if (local && !target.pathname.startsWith('/compliance_renewal_task_presentation_')) throw Error('Dedicated presentation fixture required');
const privateDir = path.join(process.env.LOCALAPPDATA || os.homedir(), 'OrionSoft');
if (!local) {
  if (process.env.RAILWAY_PROJECT_ID !== '267fa757-0e83-4343-a319-da9bb2d35fb6' || process.env.RAILWAY_SERVICE_ID !== '0315f3e9-e667-446d-8ced-1f22ddc5300d') throw Error('Verified production binding required');
  const backup = await fs.stat(path.join(privateDir,'ComplianceCore-private-20261023','before-ci-demo-20261024.dump'));
  if (backup.size < 1000) throw Error('Fresh verified backup required');
}
const client = new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
let changed = 0;
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('orionsoftlimited-presentation-demo-v1'))");
  const registry = (await client.query(`SELECT d.*, t.schema_name, t.slug, u.email FROM global.presentation_demos d JOIN global.tenants t ON t.id=d.tenant_id JOIN global.users u ON u.id=d.owner_id WHERE d.demo_key='orionsoftlimited' FOR UPDATE OF d`)).rows[0];
  if (!registry || registry.slug !== 'orionsoftlimited-demo' || registry.email !== 'compliance-demo@orionsoftlimited.com' || !/^tenant_[a-f0-9]{32}$/.test(registry.schema_name)) throw Error('Managed demo identity mismatch');
  if (registry.seed_version >= 2) { await client.query('ROLLBACK'); console.log(JSON.stringify({alreadyTailored:true,version:registry.seed_version})); }
  else {
    const {tenant_id:tenant, owner_id:owner, schema_name:schema} = registry;
    const q = table => `"${schema}"."${table}"`;
    const id = (table,label) => {
      const h=crypto.createHash('sha256').update(`${tenant}:${table}:${label}`).digest('hex');
      return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
    };
    async function update(table,label,fields) {
      if (![table,...Object.keys(fields)].every(x=>/^[a-z_][a-z0-9_]*$/.test(x))) throw Error('Invalid demo field');
      const result = await client.query(`UPDATE ${q(table)} SET ${Object.keys(fields).map((k,i)=>`"${k}"=$${i+2}`).join(',')} WHERE id=$1 RETURNING id`,[id(table,label),...Object.values(fields)]);
      if (result.rowCount !== 1) throw Error(`Expected managed ${table} record is missing`);
      changed++;
      return result.rows[0].id;
    }
    await client.query(`UPDATE global.tenants SET name=$2, industry='Leasing, fleet, marine, outsourcing and telematics',website='https://www.c-ileasing.com',updated_at=now() WHERE id=$1`,[tenant,organisation]);
    const depts = [
      ['Governance & Compliance','Group Governance & Compliance','Coordinate evidence and the management assurance pack across the four business lines.'],
      ['Information Security','Citracks / Telematics','Review tracking-data access and record security assurance actions; no live tracking connection.'],
      ['Operations','Fleet Management','Track sample vehicle document reviews, driver readiness and dispatch assurance.'],
      ['People & Training','Personnel Outsourcing','Demonstrate personnel-data controls, payroll evidence reviews and assigned learning.'],
      ['Finance & Procurement','Marine Services','Track sample contractor assurance, crew document reviews and mobilisation evidence.'],
    ];
    for (const [old,name,description] of depts) await update('departments',old,{name,description:`${disclaimer}\n\n${description}`});
    for (const [i,name,city] of [[4,'Calabar Operations','Calabar'],[5,'Enugu Operations','Enugu'],[6,'Benin Operations','Benin']]) {
      await client.query(`INSERT INTO ${q('branches')}(id,name,code,country,city,timezone,created_by) VALUES($1,$2,$3,'Nigeria',$4,'Africa/Lagos',$5) ON CONFLICT(id) DO NOTHING`,[id('branches',name),name,`DEMO-${i}`,city,owner]);
    }
    for (const [old,title,business,procedure] of policies) {
      const policyId=id('policies',old);
      const current=(await client.query(`SELECT current_version FROM ${q('policies')} WHERE id=$1`,[policyId])).rows[0];
      if (!current) throw Error('Managed policy missing');
      const version=current.current_version+1;
      const content=`# ${title}\n\n${disclaimer}\n\n## Business line\n${business}\n\n## Day-to-day workflow\n${procedure}\n\n## Ownership and evidence\nAssign a responsible owner, record a due date, link the supporting evidence and submit the review decision. Escalation examples are disabled in this demonstration.\n\n## Review\nReview after the sample exercise and record approved changes. Operational procedures and applicable requirements must be agreed with the organisation before deployment.`;
      await update('policies',old,{title,description:`${business}: illustrative ownership, evidence and approval workflow. ${disclaimer}`,content,current_version:version,tags:['demonstration',business],approved_at:null,approved_by:null,status:old==='Supplier Due Diligence Standard'?'in_review':'draft'});
      await client.query(`INSERT INTO ${q('policy_versions')}(id,policy_id,version_number,content,change_note,created_by) VALUES($1,$2,$3,$4,'C&I presentation scenario; earlier demonstration version retained',$5)`,[crypto.randomUUID(),policyId,version,content,owner]);
    }
    for (const [old,title,category,scenario,mitigation_plan] of risks) await update('risks',old,{title,category,description:`${disclaimer}\n\n${scenario}`,mitigation_plan});
    const suppliers=[
      ['Example Cloud Services','Example Citracks Hosting Partner','Technology hosting','Synthetic hosting assurance and access review'],
      ['Example Payroll Partner','Example Outsourced Payroll Partner','Payroll support','Synthetic personnel-data access and payroll review'],
      ['Example Managed Security','Example Marine Support Partner','Marine contractor','Synthetic contractor safety and mobilisation assurance'],
      ['Example Facilities Group','Example Fleet Maintenance Partner','Vehicle maintenance','Synthetic workshop assurance and document review'],
    ];
    for(const [old,name,category,services_provided] of suppliers){await update('vendors',old,{name,category,services_provided,description:`${disclaimer}\nFictional supplier; no live integration or claimed relationship.`});await update('vendor_assessments',old,{name:`${category} assurance review (demo)`,notes:`${disclaimer}\nReview the sample checklist, evidence gaps and assigned follow-up.`});}
    const auditRows=[['Quarterly Internal Controls Review','Fleet Dispatch & Document Readiness Review','Sample fleet document reviews, driver authorisation and maintenance sign-off.'],['Supplier Assurance Review','Marine Contractor Assurance Review','Sample marine contractor evidence, reviewer ownership and approval decision.'],['Business Continuity Readiness Review','Outsourcing & Citracks Data Access Review','Sample payroll and tracking-platform access reviews, learning and follow-up.']];
    for(const [old,title,scope] of auditRows){await update('audits',old,{title,scope:`${disclaimer}\n${scope}`,auditor_name:'Demonstration Assurance Reviewer',summary:'Fictional assurance exercise; no external audit or certification claim.'});await update('audit_findings',old,{title:`Sample action: document reviewer sign-off`,description:`${disclaimer}\n${scope} The illustrative checklist needs reviewer name and review date.`,recommendation:'Assign a responsible reviewer, attach the dated checklist and verify closure.'});}
    const trainingRows=[['Annual Security Awareness','Fleet Driver Safety & Dispatch Briefing','Fleet Safety'],['Data Protection Essentials','Outsourced Personnel Privacy & Payroll Awareness','Privacy'],['Incident Response Tabletop','Marine HSE & Continuity Tabletop','Marine Safety'],['Supplier Risk Workshop','Citracks Access & Incident Awareness','Information Security']];
    for(const [old,title,category] of trainingRows)await update('training_programs',old,{title,category,description:`${disclaimer}\nShow assignment, learning status and recorded completion evidence for this business-line briefing.`});
    for(const [old,title,description] of tasks) {await update('tasks',old,{title,description:`${disclaimer}\n\n${description}`});await update('task_comments',old,{body:'Demonstration update: the business-line reviewer is checking the sample checklist and recording evidence for approval.'});}
    const calendars=[['Quarterly governance committee','Four-business-line assurance meeting'],['Policy approval workshop','Fleet policy review workshop'],['Internal audit review','Marine contractor assurance review'],['Security awareness briefing','Outsourced personnel privacy briefing'],['Supplier assurance checkpoint','Fleet maintenance supplier checkpoint'],['Continuity exercise debrief','Fleet and marine continuity debrief']];
    for(const [old,title]of calendars)await update('compliance_calendar_events',old,{title,description:`${disclaimer}\nCoordinate the accountable team, evidence and follow-up.`,reminder_days:[]});
    const expiryRows=[['Cyber insurance renewal','Sample fleet vehicle insurance review','insurance'],['Business continuity review','Sample crew certificate review','certification'],['Supplier agreement review','Sample marine contractor agreement review','vendor_agreement'],['Domain registration renewal','Sample Citracks hosting agreement review','vendor_agreement'],['Policy approval refresh','Sample outsourcing privacy procedure review','policy']];
    for(const [old,name,entity_type]of expiryRows)await update('expiry_items',old,{name,entity_type,description:`${disclaimer}\nTrack the example due date, renewal owner and linked evidence; not a real certificate.`,notes:'Example dates only; validate applicable documents and deadlines during onboarding.',reminder_days:[]});
    await update('incidents','sample-incident',{title:'Simulated Citracks account access investigation',description:`${disclaimer}\nTabletop only: investigate a hypothetical tracking-account access alert.`,root_cause:'Fictional tabletop: an unexpected account-access report requires review.',remediation:'Review sample access rights, record the containment decision and attach closure evidence.',affected_systems:['Citracks demonstration account environment']});
    await update('incident_updates','sample-incident',{body:'TABLETOP ONLY: sample account access reviewed; containment decision recorded for the demonstration.'});
    await update('approval_workflows','policy-review',{name:'Marine contractor assurance standard approval',description:'Illustrative review: compliance lead prepares the standard, a separate authorised reviewer records the decision.'});
    await update('approval_workflow_steps','policy-review',{name:'Group Compliance approval',instructions:'Review the fictional marine supplier standard, sample evidence and outstanding exceptions before deciding.'});
    await update('approval_requests','policy-review',{title:'Approve marine supplier assurance standard',description:`${disclaimer}\nReview the sample standard and document the decision.`});
    await update('approval_request_steps','policy-review',{name:'Group Compliance review'});
    await update('escalation_rules','overdue-followup',{name:'Critical fleet and marine action follow-up (disabled)',description:'Example escalation design for overdue assurance actions. Disabled; no messages are sent.',is_active:false});
    const alerts=[['Policy review is ready','Marine standard awaits your decision','/approvals'],['Supplier assessment updated','Fleet maintenance supplier review updated','/vendors'],['Training progress available','Outsourcing privacy briefing progress ready','/training'],['Internal audit finding assigned','Fleet dispatch readiness action assigned','/audits'],['Assurance pack ready to review','Four-business-line management pack ready','/reports']];
    for(const [old,title,action_url]of alerts)await update('notifications',old,{title:`Demo: ${title}`,body:'Fictional C&I Leasing presentation example. Open the linked module to review ownership, evidence and next steps.',action_url});
    await update('scheduled_reports','weekly-pack',{name:'C&I four-business-line assurance pack (demo)',is_active:false});
    // Keep framework titles and requirements intact. Tailor the implementation
    // narrative instead of passing invented sector controls off as a standard.
    await client.query(`UPDATE ${q('controls')} SET implementation_notes=$1,testing_notes=$2 WHERE metadata->>'demo'='true'`,[`${disclaimer}\nApply the control to the sample fleet, marine, outsourcing or Citracks workflow. Assign an owner, attach the relevant review evidence and track remediation.`, 'Illustrative control status only. Management must validate applicability and test effectiveness before using real assurance scores.']);
    const s3=new S3Client({region:process.env.AWS_REGION,endpoint:process.env.AWS_S3_ENDPOINT,forcePathStyle:process.env.AWS_S3_FORCE_PATH_STYLE==='true',credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY}});
    for(const [i,[old,title,scenario,steps]]of evidence.entries()) {
      const evidenceId=id('evidence',old);
      const version=(await client.query(`SELECT COALESCE(max(version_number),0)+1 AS next FROM ${q('evidence_versions')} WHERE evidence_id=$1`,[evidenceId])).rows[0].next;
      const body=await new Promise((resolve,reject)=>{const doc=new PDFDocument({size:'A4',margin:48,info:{Title:title,Author:'Orion Soft Limited'}}),chunks=[];doc.on('data',x=>chunks.push(x));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);doc.fillColor('#172554').fontSize(23).text('ComplianceCore');doc.fontSize(10).text('BY ORION SOFT LIMITED');doc.moveDown(2).fontSize(17).text(title);doc.moveDown().fontSize(11).text(organisation);for(const line of [disclaimer,scenario,steps,'Use ComplianceCore to record the owner, due date, supporting documents, review decision and follow-up.','This sample is not a real certificate, audit finding, dispatch approval or employee record.'])doc.moveDown().text(line);doc.end();});
      const key=`tenants/${tenant}/presentation/ci-v2/${i+1}.pdf`,versionId=crypto.randomUUID();
      await s3.send(new PutObjectCommand({Bucket:process.env.AWS_S3_BUCKET,Key:key,Body:body,ContentType:'application/pdf'}));
      await client.query(`INSERT INTO ${q('evidence_versions')}(id,evidence_id,version_number,file_name,file_key,file_size_bytes,mime_type,checksum_sha256,upload_status,change_note,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,'application/pdf',$7,'completed','C&I presentation version; original evidence retained',$8)`,[versionId,evidenceId,version,`ci-demo-${i+1}.pdf`,key,body.length,crypto.createHash('sha256').update(body).digest('hex'),owner]);
      await update('evidence',old,{title:`Demo: ${title}`,description:`${disclaimer}\n${scenario}`,ocr_text:`${disclaimer}\n${title}\n${steps}`,current_version_id:versionId});
      await client.query(`INSERT INTO ${q('evidence_events')}(evidence_id,event_type,actor_id,actor_email,metadata) VALUES($1,'uploaded',$2,$3,$4::jsonb)`,[evidenceId,owner,registry.email,JSON.stringify({demo:true,version,fileName:`ci-demo-${i+1}.pdf`})]);
    }
    const invoices=[
      [{description:'One-time Enterprise onboarding: workspace configuration, agreed control mapping, sample-data handover and administrator orientation (illustrative scope)',quantity:1,unitAmount:5000000,amount:5000000},{description:'Enterprise annual subscription: 12 months for the price of 10 months at NGN 480,000 (illustrative starting price; commercial scope to be agreed)',quantity:1,unitAmount:4800000,amount:4800000}],
      [{description:'Enterprise annual subscription renewal only: 12 months; excludes the one-time onboarding fee (illustrative)',quantity:1,unitAmount:4800000,amount:4800000}],
      [{description:'Enterprise monthly subscription renewal only: one month; excludes the one-time onboarding fee (illustrative)',quantity:1,unitAmount:480000,amount:480000}],
    ];
    for(const [i,lineItems]of invoices.entries()) {
      const result=await client.query(`UPDATE global.invoices SET line_items=$3::jsonb,metadata=metadata || $4::jsonb,billing_period_end=billing_period_start + CASE WHEN $5 THEN interval '1 month' ELSE interval '1 year' END,updated_at=now() WHERE tenant_id=$1 AND number=$2 AND status='draft' AND metadata->>'demo'='true' RETURNING id`,[tenant,`DEMO-ORION-00${i+1}`,JSON.stringify(lineItems),JSON.stringify({demo:true,notPayable:true,presentation:'C&I Leasing Plc',illustrative:true}),i===2]);
      if(result.rowCount!==1)throw Error('Managed draft invoice missing; refusing to change other invoices');
    }
    await client.query(`UPDATE global.presentation_demos SET seed_version=2 WHERE tenant_id=$1`,[tenant]);
    await client.query('COMMIT');
    const accessPath=local?path.join(os.tmpdir(),'compliance-presentation-20261023','demo-access-local.json'):path.join(privateDir,'ComplianceCore-Demo-Access.private.json');
    const access=JSON.parse(await fs.readFile(accessPath,'utf8'));
    if(access.tenantId!==tenant)throw Error('Access file binding mismatch');
    access.organisation=organisation;
    await fs.writeFile(accessPath,JSON.stringify(access,null,2),{mode:0o600});
    console.log(JSON.stringify({tailored:true,organisation,recordsUpdated:changed,newEvidenceVersions:6,externalMessagesSent:0,customerContractsChanged:0}));
  }
} catch(error) {await client.query('ROLLBACK').catch(()=>{});console.error('C&I demo preparation failed:',error.name, error.message?.startsWith('Expected managed')?error.message:'private details suppressed');process.exitCode=1;}
finally {await client.end();}
