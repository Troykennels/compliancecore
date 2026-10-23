import pg from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

if (process.env.DEMO_SEED_CONFIRM !== 'orionsoftlimited') throw Error('Explicit DEMO_SEED_CONFIRM=orionsoftlimited is required');
const dbURL = process.env.DATABASE_URL;
if (!dbURL) throw Error('DATABASE_URL is required');
const isLocal = ['127.0.0.1','localhost'].includes(new URL(dbURL).hostname);
if (isLocal && !new URL(dbURL).pathname.startsWith('/compliance_renewal_task_')) throw Error('Dedicated disposable database required for local seed');
const directory = isLocal ? path.join(os.tmpdir(),'compliance-presentation-20261023') : path.join(process.env.LOCALAPPDATA || os.homedir(),'OrionSoft');
await fs.mkdir(directory,{recursive:true});
const accessPath = path.join(directory,isLocal?'demo-access-local.json':'ComplianceCore-Demo-Access.private.json');
let access;
try { access=JSON.parse(await fs.readFile(accessPath,'utf8')); } catch { access={email:'compliance-demo@orionsoftlimited.com',password:`Orion!${crypto.randomBytes(18).toString('base64url')}9`}; }
await fs.writeFile(accessPath,JSON.stringify(access,null,2),{mode:0o600});
const c=new pg.Client({connectionString:dbURL});
await c.connect();
const date = days => new Date(Date.now()+days*86400000).toISOString();
const ids = new Map();
let tenantId,schema,owner;
let inserted=0;
let phase='database';
const jsonColumns=new Map();
async function put(table,label,data) {
  if (!/^[a-z_]+$/.test(table)) throw Error('Invalid fixture table');
  const h=crypto.createHash('sha256').update(`${tenantId}:${table}:${label}`).digest('hex');
  const id=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
  ids.set(`${table}:${label}`,id);
  const cols=['id',...Object.keys(data)];
  for(const column of cols)if(!/^[a-z_][a-z0-9_]*$/.test(column))throw Error('Invalid fixture column');
  if(!jsonColumns.has(table))jsonColumns.set(table,new Set((await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND data_type IN ('json','jsonb')`,[schema,table])).rows.map(r=>r.column_name)));
  const values=[id,...Object.entries(data).map(([k,v])=>v!==null&&jsonColumns.get(table).has(k)?JSON.stringify(v):v)];
  const result=await c.query(`INSERT INTO "${schema}"."${table}"(${cols.map(k=>`"${k}"`).join(',')}) VALUES(${values.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT(id) DO NOTHING`,values);
  inserted+=result.rowCount;
  return id;
}
async function document(title,lines) {
  return new Promise(resolve=>{
    const chunks=[],doc=new PDFDocument({size:'A4',margin:55,info:{Title:title,Author:'ORION SOFT LIMITED',CreationDate:new Date('2026-10-23T00:00:00Z')}});
    doc.on('data',x=>chunks.push(x));doc.on('end',()=>resolve(Buffer.concat(chunks)));
    doc.fillColor('#172554').fontSize(24).text('ComplianceCore');doc.fontSize(10).text('BY ORION SOFT LIMITED');
    doc.moveDown(2).fillColor('#9a3412').fontSize(11).text('DEMONSTRATION ONLY - fictional presentation evidence');
    doc.moveDown().fillColor('#0f172a').fontSize(18).text(title);doc.moveDown().fontSize(11).text('Organisation: orionsoftlimited');
    for(const line of lines)doc.moveDown().text(line);
    doc.moveDown(2).fillColor('#64748b').fontSize(9).text('Prepared for product demonstration. This document does not certify compliance, constitute an external audit or contain customer information.');
    doc.end();
  });
}
try {
  await c.query('BEGIN');
  await c.query(`SELECT pg_advisory_xact_lock(hashtext('orionsoftlimited-presentation-demo-v1'))`);
  await c.query(`CREATE TABLE IF NOT EXISTS global.presentation_demos(demo_key text PRIMARY KEY,tenant_id uuid NOT NULL UNIQUE REFERENCES global.tenants(id) ON DELETE CASCADE,owner_id uuid NOT NULL REFERENCES global.users(id),seed_version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now())`);
  const registry=await c.query(`SELECT d.*,t.schema_name FROM global.presentation_demos d JOIN global.tenants t ON t.id=d.tenant_id WHERE demo_key='orionsoftlimited'`);
  if(registry.rows[0]) { tenantId=registry.rows[0].tenant_id;schema=registry.rows[0].schema_name;owner=registry.rows[0].owner_id; }
  else {
    if((await c.query(`SELECT 1 FROM global.users WHERE email=$1`,[access.email])).rowCount)throw Error('Demo email already belongs to an existing account; refusing to overwrite it');
    if((await c.query(`SELECT 1 FROM global.tenants WHERE slug='orionsoftlimited-demo'`)).rowCount)throw Error('Demo slug already exists outside the managed registry');
    owner=crypto.randomUUID();tenantId=crypto.randomUUID();schema='tenant_'+tenantId.replaceAll('-','');
    await c.query(`INSERT INTO global.users(id,email,password_hash,first_name,last_name,email_verified_at,is_active,onboarding_completed_at,updated_at) VALUES($1,$2,$3,'Orion','Demo Administrator',now(),true,now(),now())`,[owner,access.email,await bcrypt.hash(access.password,12)]);
    await c.query(`INSERT INTO global.tenants(id,name,slug,schema_name,plan,is_active,onboarding_done_at,industry,website,country,city,timezone,size,notification_settings,updated_at)
      VALUES($1,'orionsoftlimited','orionsoftlimited-demo',$2,'enterprise',true,now(),'Technology & professional services','https://orionsoftlimited.com','Nigeria','Lagos','Africa/Lagos','51-200',$3::jsonb,now())`,[tenantId,schema,JSON.stringify({digestFrequency:'never',emailAlerts:{},demo:true})]);
    await c.query(`INSERT INTO global.tenant_memberships(tenant_id,user_id,role,is_active,joined_at) VALUES($1,$2,'owner',true,now())`,[tenantId,owner]);
    if(!/^tenant_[a-f0-9]{32}$/.test(schema))throw Error('Invalid schema');
    await c.query(`CREATE SCHEMA "${schema}"`);
    const templateDir=fileURLToPath(new URL('../../database/tenant-template/',import.meta.url));
    for(const file of (await fs.readdir(templateDir)).filter(f=>f.endsWith('.sql')).sort())await c.query((await fs.readFile(path.join(templateDir,file),'utf8')).replaceAll('{{SCHEMA}}',schema));
    await c.query(`INSERT INTO global.presentation_demos(demo_key,tenant_id,owner_id) VALUES('orionsoftlimited',$1,$2)`,[tenantId,owner]);
  }
  if(!/^tenant_[a-f0-9]{32}$/.test(schema))throw Error('Invalid managed demo schema');
  await c.query(`SET LOCAL search_path TO "${schema}",global,public`);
  const team=[owner];
  for(const [first,last,role] of [['Ada','Okafor','admin'],['Tunde','Bello','compliance_manager'],['Grace','Mensah','auditor']]) {
    const email=`${first.toLowerCase()}.demo@example.invalid`;
    let person=(await c.query(`SELECT id FROM global.users WHERE email=$1`,[email])).rows[0];
    if(person && !(await c.query(`SELECT 1 FROM global.tenant_memberships WHERE user_id=$1 AND tenant_id=$2`,[person.id,tenantId])).rowCount)throw Error('Supporting demo identity belongs to another tenant');
    if(!person)person=(await c.query(`INSERT INTO global.users(email,password_hash,first_name,last_name,email_verified_at,is_active,onboarding_completed_at,updated_at) VALUES($1,$2,$3,$4,now(),true,now(),now()) RETURNING id`,[email,await bcrypt.hash(crypto.randomBytes(24).toString('base64url'),10),first,last])).rows[0];
    await c.query(`INSERT INTO global.tenant_memberships(tenant_id,user_id,role,is_active,joined_at) VALUES($1,$2,$3::global."UserRole",true,now()) ON CONFLICT(tenant_id,user_id) DO NOTHING`,[tenantId,person.id,role]);team.push(person.id);
  }
  const branches=[];
  for(const [i,name,city] of [[0,'Lagos Head Office','Lagos'],[1,'Abuja Operations','Abuja'],[2,'Port Harcourt Office','Port Harcourt']])branches.push(await put('branches',name,{name,code:`DEMO-${i+1}`,is_headquarters:i===0,country:'Nigeria',city,timezone:'Africa/Lagos',created_by:owner}));
  for(const [i,name] of ['Governance & Compliance','Information Security','Operations','People & Training','Finance & Procurement'].entries())await put('departments',name,{name,code:`DEPT-${i+1}`,branch_id:branches[i%3],head_user_id:team[i%team.length],description:`Demonstration ${name.toLowerCase()} function with assigned ownership.`,created_by:owner});
  const frameworks=(await c.query(`SELECT id,code,name FROM framework_data.frameworks WHERE is_active=true ORDER BY CASE WHEN code ILIKE '%27001%' THEN 0 WHEN code ILIKE '%NDPR%' THEN 1 ELSE 2 END LIMIT 3`)).rows;
  const controls=[];
  for(const f of frameworks) {
    const library=(await c.query(`SELECT * FROM framework_data.framework_controls WHERE framework_id=$1 ORDER BY control_ref LIMIT 10`,[f.id])).rows;
    for(const [i,ctl] of library.entries())controls.push(await put('controls',`${f.code}-${ctl.control_ref}`,{framework_id:f.id,control_ref:ctl.control_ref,title:ctl.title,description:ctl.description,category:ctl.category||'Governance',criticality:['high','medium','low'][i%3],implementation_status:['implemented','implemented','partially_implemented','planned','not_implemented'][i%5],implementation_notes:'Fictional demonstration: ownership, supporting evidence and remediation are tracked in ComplianceCore.',owner_id:team[i%team.length],due_date:date(7+i).slice(0,10),last_reviewed_at:date(-4),created_by:owner,metadata:{demo:true}}));
  }
  const policyContent='# Information Security & Governance Policy\n\nDEMONSTRATION ONLY — ORION SOFT LIMITED\n\n## Purpose\nProtect information through accountable control owners, evidence-based assurance and timely remediation.\n\n## Responsibilities\nThe compliance lead maintains the control register. Department heads approve access and review evidence. All staff complete annual awareness training.\n\n## Control procedures\n1. Review access rights quarterly.\n2. Maintain encrypted backups and test recovery.\n3. Record incidents promptly and assign accountable owners.\n4. Review critical suppliers before contract renewal.\n\n## Review\nReview annually or after a material change. This fictional policy is provided only to demonstrate document governance.';
  const policies=[];
  for(const [i,title] of ['Information Security Policy','Data Protection Procedure','Supplier Due Diligence Standard','Business Continuity Policy','Incident Response Procedure'].entries()) {
    const policy=await put('policies',title,{title,description:'Fictional governance document for the Orion product demonstration.',document_type:i%2?'procedure':'policy',status:i===2?'in_review':'published',content:policyContent,current_version:1,owner_id:team[i%4],review_due_date:date(60+i*14).slice(0,10),framework_ids:frameworks.map(f=>f.id),tags:['demonstration','governance'],approved_at:i===2?null:date(-6),approved_by:i===2?null:owner,created_by:owner});
    policies.push(policy);await put('policy_versions',title,{policy_id:policy,version_number:1,content:policyContent,change_note:'Initial demonstration version',created_by:owner});
  }
  const risks=[];
  for(const [i,title] of ['Privileged access not reviewed on time','Delayed supplier assurance evidence','Recovery objectives not tested','Staff phishing susceptibility','Regulatory reporting deadline missed','Unapproved changes to production'].entries())risks.push(await put('risks',title,{title,description:'Synthetic risk scenario used for product presentation.',category:['security','third_party','operational','security','compliance','operational'][i],inherent_likelihood:3+i%2,inherent_impact:4,inherent_score:(3+i%2)*4,residual_likelihood:2,residual_impact:3,residual_score:6,treatment:'mitigate',status:i%3===0?'mitigated':'in_treatment',mitigation_plan:'Assign an accountable owner, collect evidence and review the treatment at the next governance meeting.',owner_id:team[i%4],review_date:date(-5).slice(0,10),next_review_date:date(21+i).slice(0,10),created_by:owner}));
  const vendors=[];
  for(const [i,name] of ['Example Cloud Services','Example Payroll Partner','Example Managed Security','Example Facilities Group'].entries()) {
    const vendor=await put('vendors',name,{name,description:'Fictional supplier — no live integration or commercial relationship.',category:['Cloud infrastructure','Payroll services','Security monitoring','Facilities'][i],website:'https://example.invalid',contact_name:'Demonstration Contact',contact_email:'supplier@example.invalid',risk_level:['high','medium','low','medium'][i],status:i===1?'under_review':'active',services_provided:'Demonstration supplier service',data_processed:i===1?'Fictional staff records':'No customer data in this demonstration',owner_id:team[i%4],onboarded_at:date(-90).slice(0,10),next_review_date:date(30+i*5).slice(0,10),created_by:owner});
    vendors.push(vendor);await put('vendor_assessments',name,{vendor_id:vendor,name:'Demonstration annual supplier review',status:i===1?'in_progress':'completed',score:i===1?null:82+i,notes:'Synthetic assessment for product demonstration only.',assessed_by:owner,assessed_at:i===1?null:date(-7),due_date:date(14).slice(0,10)});
  }
  const audits=[];
  for(const [i,title] of ['Quarterly Internal Controls Review','Supplier Assurance Review','Business Continuity Readiness Review'].entries()) {
    const audit=await put('audits',title,{title,audit_type:'internal',framework_ref:frameworks[0]?.code||'Internal controls',status:i===0?'in_progress':i===1?'completed':'planned',auditor_name:'Grace Mensah — demonstration auditor',scope:'Selected controls, policies and evidence in the fictional Orion demonstration organisation.',summary:'Demonstration review for presentation; no independent certification is asserted.',start_date:date(i===2?14:-14).slice(0,10),end_date:date(i===2?21:7).slice(0,10),owner_id:team[3],created_by:owner});audits.push(audit);
    await put('audit_findings',title,{audit_id:audit,title:'Review evidence needs an accountable owner',description:'Demonstration finding: the quarterly access review evidence should identify the reviewer and approval date.',severity:i===1?'low':'medium',status:i===1?'resolved':'in_remediation',recommendation:'Attach the reviewed access register and record the approval.',owner_id:team[1],due_date:date(14).slice(0,10),created_by:owner});
  }
  const programs=[];
  for(const [i,title] of ['Annual Security Awareness','Data Protection Essentials','Incident Response Tabletop','Supplier Risk Workshop'].entries()) {
    const program=await put('training_programs',title,{title,description:'Fictional learning programme for the product demonstration.',category:i===1?'Privacy':'Security',provider:'Orion Soft Limited — demonstration',duration_minutes:45+i*15,is_mandatory:i<2,status:'active',owner_id:team[1],created_by:owner});programs.push(program);
    for(const [j,user] of team.entries())await put('training_records',`${title}-${user}`,{program_id:program,user_id:user,status:j%3===0?'completed':j%3===1?'in_progress':'assigned',score:j%3===0?90:null,due_date:date(21).slice(0,10),completed_at:j%3===0?date(-3):null});
  }
  const tasks=[];
  for(const [i,title] of ['Complete quarterly access review','Approve information security policy','Collect supplier assurance evidence','Run backup recovery exercise','Review staff training completion','Prepare executive assurance pack','Confirm incident remediation actions','Review certificate renewal schedule'].entries()) {
    const task=await put('tasks',title,{title,description:'Demonstration task: record progress, attach evidence and confirm completion with the control owner.',assigned_to:team[i%4],assigned_by:owner,due_date:date(5+i),priority:i%3===0?'high':'medium',status:['in_progress','in_review','todo','completed'][i%4],entity_type:'control',entity_id:controls[i%controls.length],framework_id:frameworks[0]?.id,estimated_hours:2+i%3,actual_hours:i%4===3?2:null,tags:['demonstration','assurance'],completed_at:i%4===3?date(-2):null,created_by:owner});tasks.push(task);
    await put('task_comments',title,{task_id:task,user_id:team[1],body:'Demo update: the responsible team has reviewed the requirement and is collecting supporting evidence.'});
  }
  for(const [i,title] of ['Quarterly governance committee','Policy approval workshop','Internal audit review','Security awareness briefing','Supplier assurance checkpoint','Continuity exercise debrief'].entries())await put('compliance_calendar_events',title,{title,description:'Fictional scheduled governance activity for demonstration.',event_type:['meeting','review','audit','training','assessment','meeting'][i],status:i===4?'completed':'upcoming',start_date:date(i===4?-3:3+i),end_date:date(i===4?-3:3+i),assigned_to:team[i%4],priority:i===2?'high':'medium',framework_id:frameworks[0]?.id,reminder_days:[],created_by:owner,metadata:{demo:true}});
  for(const [i,name] of ['Cyber insurance renewal','Business continuity review','Supplier agreement review','Domain registration renewal','Policy approval refresh'].entries())await put('expiry_items',name,{name,description:'Demonstration renewal record; not a real certificate or coverage claim.',entity_type:['insurance','policy','vendor_agreement','domain','policy'][i],expiry_date:date(25+i*19).slice(0,10),renewal_date:date(18+i*19).slice(0,10),owner_id:team[i%4],status:i===0?'expiring_soon':'active',reminder_days:[],notes:'Synthetic presentation data',created_by:owner,metadata:{demo:true}});
  const incident=await put('incidents','sample-incident',{reference:'DEMO-INC-001',title:'Simulated suspicious sign-in investigation',description:'Fictional incident used to demonstrate triage, ownership and remediation.',category:'security',severity:'medium',status:'contained',occurred_at:date(-5),detected_at:date(-5),contained_at:date(-4),is_data_breach:false,reported_by:team[1],assigned_to:team[2],root_cause:'Demonstration tabletop: an anomalous sign-in was investigated.',remediation:'Validate account activity, review access controls and document the decision.',affected_systems:['Demonstration identity environment'],tags:['demonstration','tabletop'],created_by:owner});
  await put('incident_updates','sample-incident',{incident_id:incident,entry_type:'containment',body:'DEMO: triage completed; the fictional account was contained and the control owner notified.',author_id:team[1]});
  const workflow=await put('approval_workflows','policy-review',{name:'Policy review & approval',description:'Demonstration two-person governance workflow.',entity_type:'policy',is_active:true,created_by:owner});
  const step=await put('approval_workflow_steps','policy-review',{workflow_id:workflow,step_order:1,name:'Principal approval',approver_type:'user',approver_id:owner,allow_self_approval:false,require_signature:false,deadline_hours:72,instructions:'Review the fictional policy and record your decision.'});
  const approval=await put('approval_requests','policy-review',{workflow_id:workflow,title:'Review supplier due diligence standard',description:'Demonstration approval request with an assigned reviewer.',entity_type:'policy',entity_id:policies[2],status:'pending',priority:'medium',requested_by:team[1],deadline:date(5),metadata:{demo:true}});
  await put('approval_request_steps','policy-review',{request_id:approval,workflow_step_id:step,step_order:1,name:'Owner review',status:'active',approver_type:'user',assigned_to:owner,allow_self_approval:false,require_signature:false,activated_at:date(-1),deadline:date(5)});
  const rule=await put('escalation_rules','overdue-followup',{name:'High-priority remediation follow-up',description:'Demonstration rule, disabled to avoid sending synthetic alerts.',trigger_type:'task_overdue',entity_type:'task',conditions:{days_overdue:3,priority:['high','critical']},escalation_chain:[{delay_hours:24,action:'notify',target_type:'assignee',message:'Review your overdue remediation task.'}],is_active:false,created_by:owner});
  await put('escalation_events','resolved-followup',{rule_id:rule,entity_type:'task',entity_id:tasks[3],status:'resolved',triggered_at:date(-6),resolved_at:date(-2),metadata:{demo:true}});
  for(const [i,title,path] of [[0,'Policy review is ready','/approvals'],[1,'Supplier assessment updated','/vendors'],[2,'Training progress available','/training'],[3,'Internal audit finding assigned','/audits'],[4,'Assurance pack ready to review','/reports']])await put('notifications',title,{user_id:owner,title:`Demo: ${title}`,body:'Synthetic presentation notification. Open the linked module to explore the example.',notification_type:'system',priority:i===3?'high':'medium',action_url:path,read_at:i===2?date(-1):null,created_at:date(-i/24)});
  const {buildFrameworkScore}=await import('../dist/modules/compliance-score/score.service.js');
  const stats=(await c.query(`SELECT framework_id AS "frameworkId",implementation_status AS "implementationStatus",criticality,count(*)::integer AS count FROM "${schema}".controls WHERE deleted_at IS NULL GROUP BY framework_id,implementation_status,criticality`)).rows;
  const current=buildFrameworkScore(stats,null,'All Frameworks');
  for(let i=11;i>=0;i--)await put('compliance_score_snapshots',`snapshot-${i}`,{snapshot_date:date(-i*7).slice(0,10),overall_score:Math.max(0,(current.score||0)-i*1.5),framework_scores:Object.fromEntries(frameworks.map(f=>{const score=buildFrameworkScore(stats.filter(s=>s.frameworkId===f.id),f.id,f.name);return[f.id,{...score,score:Math.max(0,(score.score||0)-i*1.5)}]})),control_counts:current.controlCounts});
  await put('scheduled_reports','weekly-pack',{name:'Weekly executive assurance pack (demo)',frequency:'weekly',day_of_week:1,hour:8,recipients:[access.email],format:'pdf',is_active:false,next_run_at:date(7),last_run_at:date(-7),last_run_status:'success',created_by:owner});
  const plan=(await c.query(`SELECT id FROM global.subscription_plans WHERE slug='enterprise'`)).rows[0];
  if(!plan)throw Error('Initialize billing tables before provisioning the demo');
  await c.query(`INSERT INTO global.subscriptions(tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end,next_invoice_amount,currency) SELECT $1,$2,'active','yearly',now(),now()+interval '1 year',0,'NGN' WHERE NOT EXISTS(SELECT 1 FROM global.subscriptions WHERE tenant_id=$1)`,[tenantId,plan.id]);
  await c.query(`INSERT INTO global.tenant_onboarding(tenant_id,status) VALUES($1,'demo') ON CONFLICT(tenant_id) DO NOTHING`,[tenantId]);
  await c.query(`INSERT INTO global.api_keys(tenant_id,created_by,name,key_hash,key_prefix,permissions,revoked_at) SELECT $1,$2,'Demo integration key (revoked)', $3,'demo_revoked',ARRAY['controls:read'],now() WHERE NOT EXISTS(SELECT 1 FROM global.api_keys WHERE tenant_id=$1 AND name='Demo integration key (revoked)')`,[tenantId,owner,crypto.randomBytes(32).toString('hex')]);
  await c.query(`INSERT INTO global.webhooks(tenant_id,created_by,name,url,secret_hash,events,is_active,updated_at) SELECT $1,$2,'Demo assurance webhook (disabled)','https://example.invalid/demo-webhook',$3,ARRAY['control.updated'],false,now() WHERE NOT EXISTS(SELECT 1 FROM global.webhooks WHERE tenant_id=$1 AND name='Demo assurance webhook (disabled)')`,[tenantId,owner,crypto.randomBytes(32).toString('hex')]);
  for(const [i,amount] of [9800000,4800000,480000].entries())await c.query(`INSERT INTO global.invoices(tenant_id,subscription_id,number,status,amount_due,amount_paid,currency,billing_period_start,billing_period_end,due_date,line_items,metadata)
    SELECT $1,id,$2,'draft',$3,0,'NGN',now(),now()+interval '1 year',now()+interval '30 days',$4::jsonb,'{"demo":true,"notPayable":true}'::jsonb FROM global.subscriptions WHERE tenant_id=$1 ON CONFLICT(number) DO NOTHING`,[tenantId,`DEMO-ORION-00${i+1}`,amount,JSON.stringify([{description:'DEMONSTRATION ONLY — illustrative onboarding/subscription. Not a payment request.',quantity:1,unitAmount:amount,amount}])]);
  await c.query('COMMIT');
  access={...access,url:process.env.FRONTEND_URL||'https://compliancecore-sand.vercel.app',organisation:'orionsoftlimited',tenantId};
  await fs.writeFile(accessPath,JSON.stringify(access,null,2),{mode:0o600});
  // Files are real PDFs stored in this demo tenant's own prefix, never fictitious
  // "uploaded" placeholders. A failed upload remains retryable on the next run.
  const s3=new S3Client({region:process.env.AWS_REGION||'eu-west-1',...(process.env.AWS_S3_ENDPOINT?{endpoint:process.env.AWS_S3_ENDPOINT}:{}),forcePathStyle:process.env.AWS_S3_FORCE_PATH_STYLE==='true',credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID||'',secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY||''}});
  phase='evidence upload';
  const category=(await c.query(`SELECT id FROM "${schema}".evidence_categories ORDER BY sort_order LIMIT 1`)).rows[0]?.id;
  for(const [i,title] of ['Quarterly Access Review','Backup Recovery Test','Supplier Assurance Checklist','Policy Approval Record','Security Awareness Attendance','Incident Tabletop Summary'].entries()) {
    const key=`tenants/${tenantId}/presentation/${i+1}.pdf`;
    const existing=(await c.query(`SELECT file_size_bytes,checksum_sha256 FROM "${schema}".evidence_versions WHERE file_key=$1`,[key])).rows[0];
    if(existing){const stored=await s3.send(new HeadObjectCommand({Bucket:process.env.AWS_S3_BUCKET,Key:key}));if(Number(stored.ContentLength)!==Number(existing.file_size_bytes))throw Error('Existing demo file size mismatch; refusing to overwrite evidence');continue;}
    const body=await document(title,['Scope: the fictional Orion presentation organisation.','Owner: Demo Compliance Team.','Outcome: sample evidence for exploring review, versioning and audit traceability.','Follow-up: assign outstanding actions, review supporting records and document approval.']);
    await s3.send(new PutObjectCommand({Bucket:process.env.AWS_S3_BUCKET,Key:key,Body:body,ContentType:'application/pdf'}));
    await c.query('BEGIN');
    const evidence=await put('evidence',title,{title:`Demo: ${title}`,description:'Fictional presentation evidence — downloadable branded sample PDF.',category_id:category||null,status:'active',ocr_status:'completed',ocr_text:`DEMONSTRATION ONLY. ${title}. Evidence prepared for orionsoftlimited product presentation.`,collected_at:date(-5),collected_by:owner,created_by:owner});
    const version=await put('evidence_versions',title,{evidence_id:evidence,version_number:1,file_name:`demo-${i+1}.pdf`,file_key:key,file_size_bytes:body.length,mime_type:'application/pdf',checksum_sha256:crypto.createHash('sha256').update(body).digest('hex'),upload_status:'completed',change_note:'Initial synthetic presentation document',uploaded_by:owner});
    await c.query(`UPDATE "${schema}".evidence SET current_version_id=$2 WHERE id=$1 AND current_version_id IS NULL`,[evidence,version]);
    await put('evidence_links',title,{evidence_id:evidence,linked_type:'control',linked_id:controls[i%controls.length],linked_by:owner});
    await put('evidence_events',title,{evidence_id:evidence,event_type:'uploaded',actor_id:owner,actor_email:access.email,metadata:{demo:true,fileName:`demo-${i+1}.pdf`}});
    await c.query('COMMIT');
  }
  const signatures=await import('../dist/modules/signatures/signatures.service.js');
  if(!(await c.query(`SELECT 1 FROM "${schema}".digital_signatures WHERE document_id=$1 AND user_id=$2`,[policies[0],owner])).rowCount)await signatures.createSignature(schema,owner,{documentType:'policy',documentId:policies[0],ipAddress:'127.0.0.1',userAgent:'Orion presentation demo provisioning'});
  const {prisma}=await import('../dist/config/database.js');await prisma.$disconnect();
  access={...access,url:process.env.FRONTEND_URL||'https://compliancecore-sand.vercel.app',organisation:'orionsoftlimited',tenantId};
  await fs.writeFile(accessPath,JSON.stringify(access,null,2),{mode:0o600});
  if(!isLocal)await fs.writeFile(path.join(directory,'ComplianceCore-Demo-Access.txt'),`COMPLIANCECORE — ORION SOFT LIMITED DEMO\n\nURL: ${access.url}\nEmail: ${access.email}\nPassword: ${access.password}\nOrganisation: orionsoftlimited\n\nPrivate handover file — do not publish. The demo contains fictional sample data. No real payment is required; sample invoices are draft and non-payable. Enable background alerts on the presentation device in Settings > Notifications.\n`,{mode:0o600});
  console.log(JSON.stringify({demoReady:true,organisation:'orionsoftlimited',email:access.email,tenantId,recordsInserted:inserted,credentialFile:accessPath.replace('.private.json','.txt'),externalCustomerMessagesSent:0}));
} catch(err) {await c.query('ROLLBACK').catch(()=>{});console.error('Demo provisioning failed:',phase,err.message,'status',err.$metadata?.httpStatusCode||'n/a');process.exitCode=1;}
finally {await c.end();}
