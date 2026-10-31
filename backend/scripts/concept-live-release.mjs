// Exact-source ComplianceCore release. Credentials and command logs stay outside Git.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';

const repo=path.resolve(import.meta.dirname,'../..');
const privateRoot=path.join(process.env.LOCALAPPDATA,'OrionSoft/ComplianceCore-private-20261023');
const folder=path.join(privateRoot,'concept-release-20261031');
const evidence=path.join(repo,'verification/live-20261031');
await fs.mkdir(folder,{recursive:true});await fs.mkdir(evidence,{recursive:true});
const settings=JSON.parse(await fs.readFile(path.join(privateRoot,'production-env.private.json'),'utf8'));
const target=JSON.parse(await fs.readFile(path.join(privateRoot,'vercel-target.private.json'),'utf8'));
const PROJECT='267fa757-0e83-4343-a319-da9bb2d35fb6',SERVICE='0315f3e9-e667-446d-8ced-1f22ddc5300d';
assert.equal(settings.RAILWAY_PROJECT_ID,PROJECT);assert.equal(settings.RAILWAY_SERVICE_ID,SERVICE);
assert.equal(settings.FRONTEND_URL,'https://compliancecore-sand.vercel.app');assert.equal(target.projectId,'prj_Toi3vZFuaWT66u14pWT99DRHw3Iv');
const railway=path.join(process.env.APPDATA,'npm/node_modules/@railway/cli/bin/railway.js');
const vercel=path.join(process.env.LOCALAPPDATA,'npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js');
const receiptFile=path.join(folder,'release.private.json');
const qi=name=>'"'+name.replaceAll('"','""')+'"';
async function command(executable,args,{cwd=repo,env=process.env,log='command.private.log'}={}){
 let output='',errors='';const code=await new Promise((resolve,reject)=>{const child=spawn(executable,args,{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>errors+=b);child.on('error',reject);child.on('close',resolve);});
 await fs.writeFile(path.join(folder,log),output+'\n'+errors);assert.equal(code,0,'Command failed; diagnostic retained privately: '+log);return output;
}
const read=async name=>JSON.parse(await fs.readFile(path.join(folder,name),'utf8'));
const save=async(name,value)=>fs.writeFile(path.join(folder,name),JSON.stringify(value,null,2));
async function publicReceipt(name,value){await fs.writeFile(path.join(evidence,name),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));}
async function deployments(){return JSON.parse(await command(process.execPath,[railway,'deployment','list','--project',PROJECT,'--service',SERVICE,'--environment','production','--limit','4','--json'],{log:'railway-status.private.log'}));}
async function vercelRequest(route){for(let attempt=0;attempt<2;attempt++){const auth=JSON.parse(await fs.readFile(path.join(process.env.APPDATA,'com.vercel.cli/Data/auth.json'),'utf8'));const response=await fetch('https://api.vercel.com'+route,{headers:{Authorization:'Bearer '+auth.token}});if(response.ok)return response.json();if(attempt===0&&[401,403].includes(response.status)){await command(process.execPath,[vercel,'whoami'],{log:'vercel-auth-refresh.private.log'});continue;}throw Error('Vercel metadata read failed: '+response.status);}}
async function candidates(){const release=await read('release.private.json');const data=await vercelRequest(`/v6/deployments?projectId=${target.projectId}&teamId=${target.orgId}&limit=20`);return data.deployments.filter(d=>d.meta?.sourceCommit===release.commit).map(d=>({id:d.uid,url:d.url,state:d.state}));}
function provisioningUrl(env){const url=new URL(env.PROVISIONING_DATABASE_URL||settings.DATABASE_URL),external=new URL(settings.DATABASE_URL);if(url.hostname.endsWith('.railway.internal')){url.hostname=external.hostname;url.port=external.port;}assert.equal(url.hostname,external.hostname);assert.equal(url.pathname,external.pathname);return url;}
async function database(){const env=await read('provider-env.private.json');const client=new pg.Client({connectionString:provisioningUrl(env).href});await client.connect();return {client,env};}
async function fingerprints(client,tables){const sql=tables.map(t=>`SELECT '${t.table_schema}' s,'${t.table_name}' t,count(*)::int n,md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY md5(to_jsonb(r)::text))::text,'[]')) h FROM ${qi(t.table_schema)}.${qi(t.table_name)} r`).join(' UNION ALL ');return (await client.query(sql)).rows.sort((a,b)=>(a.s+'.'+a.t).localeCompare(b.s+'.'+b.t));}
const action=process.argv[2];
try{
 if(action==='preflight'){
  const actual=JSON.parse(await command(process.execPath,[railway,'variable','list','--project',PROJECT,'--service',SERVICE,'--environment','production','--json'],{log:'provider-vars.private.log'}));
  assert.equal(actual.FRONTEND_URL,settings.FRONTEND_URL);assert(actual.DATABASE_URL);await save('provider-env.private.json',actual);
  const commit=(await command('git',['rev-parse','HEAD'],{log:'source.private.log'})).trim();assert.equal(commit,'807a4491d8a266ced80b56a5d4a05ec9bd7ef760');
  const backend=(await deployments()).find(d=>d.status==='SUCCESS');assert(backend,'No successful backend release found.');
  const project=await vercelRequest(`/v9/projects/${target.projectId}?teamId=${target.orgId}`);
  const previousFrontend=project.targets?.production;assert(previousFrontend?.id,'Previous Vercel deployment unavailable.');
  await save('release.private.json',{commit,previousBackend:backend.id,previousFrontend:{id:previousFrontend.id,url:previousFrontend.url},createdAt:new Date().toISOString()});
  const {client}=await database();try{
   const url=provisioningUrl(actual),baseline=new URL(settings.DATABASE_URL);
   assert.equal(url.hostname,baseline.hostname,'Backup and migration database hosts differ.');assert.equal(url.pathname,baseline.pathname);
   const tenants=(await client.query('SELECT schema_name FROM global.tenants WHERE deleted_at IS NULL AND schema_name IS NOT NULL')).rows;
   const required=['privacy_processing_activities','privacy_requests','privacy_impact_assessments','audit_participants','audit_requests','audit_request_evidence','audit_request_comments','assessment_outcomes'];
   const state=[];for(const tenant of tenants){assert.match(tenant.schema_name,/^tenant_[a-f0-9]{32}$/);const present=(await client.query('SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_name=ANY($2::text[])',[tenant.schema_name,required])).rows.map(r=>r.table_name);const def=(await client.query("SELECT column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name='controls' AND column_name='implementation_status'",[tenant.schema_name])).rows[0]?.column_default;state.push({missing:required.filter(t=>!present.includes(t)),newControlDefault:!!def?.includes('not_assessed')});}
   await publicReceipt('preflight.json',{passed:true,commit,previousBackend:backend.id,previousFrontend:previousFrontend.id,activeTenants:tenants.length,tenantState:state,productionWrites:false});
  }finally{await client.end();}
 }else if(action==='prepare'){
  const release=await read('release.private.json');const source=path.join(folder,'source-'+release.commit.slice(0,12)),archive=source+'.zip';
  await command('git',['archive','--format=zip','--output',archive,release.commit],{log:'archive.private.log'});
  await command('powershell.exe',['-NoProfile','-NonInteractive','-Command','Expand-Archive -LiteralPath $env:RELEASE_ARCHIVE -DestinationPath $env:RELEASE_SOURCE'],{env:{...process.env,RELEASE_ARCHIVE:archive,RELEASE_SOURCE:source},log:'expand.private.log'});
  await fs.mkdir(path.join(source,'frontend/.vercel'),{recursive:true});await fs.writeFile(path.join(source,'frontend/.vercel/project.json'),JSON.stringify(target));
  await save('release.private.json',{...release,source,archive});console.log(JSON.stringify({prepared:true,commit:release.commit}));
 }else if(action==='validate-restore'){
  const backup=JSON.parse(await fs.readFile(path.join(evidence,'cloud-backup-restore.json'),'utf8'));assert(backup.passed&&backup.consistentNativeSnapshot);assert.match(backup.localRestoreDatabase,/^compliance_cloud_restore_[a-f0-9]+$/);
  const local='postgresql://compliance_restore@127.0.0.1:55444/'+backup.localRestoreDatabase;
  const output=await command(process.execPath,['scripts/migrate-tenants.mjs','--validate'],{cwd:path.join(repo,'backend'),env:{...process.env,DATABASE_URL:local,PROVISIONING_DATABASE_URL:local},log:'restore-migration-validation.private.log'});
  const count=(output.match(/validated \(rolled back\)/g)||[]).length;const preflight=JSON.parse(await fs.readFile(path.join(evidence,'preflight.json'),'utf8'));assert.equal(count,preflight.activeTenants);assert(count>0);
  await publicReceipt('restore-migration-validation.json',{passed:true,tenantSchemasValidated:count,allTenantTemplatesValidated:true,rolledBack:true,productionWrites:false,backupSha256:backup.sha256});
 }else if(action==='migrate'){
  assert(process.argv.includes('--approved'),'Authorised release flag required.');
  const backup=JSON.parse(await fs.readFile(path.join(evidence,'cloud-backup-restore.json'),'utf8'));assert(backup.passed&&backup.consistentNativeSnapshot);assert(JSON.parse(await fs.readFile(path.join(evidence,'restore-migration-validation.json'),'utf8')).passed);
  const {client,env}=await database();try{
   await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await client.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='90s';SET LOCAL TIME ZONE 'UTC'");
   const tables=(await client.query("SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND (table_schema IN ('global','framework_data') OR table_schema~'^tenant_[a-f0-9]{32}$') ORDER BY 1,2")).rows;
   const tenants=(await client.query('SELECT schema_name FROM global.tenants WHERE deleted_at IS NULL AND schema_name IS NOT NULL ORDER BY schema_name')).rows.map(r=>r.schema_name);assert(tenants.every(s=>/^tenant_[a-f0-9]{32}$/.test(s)));
   const stable=tables.filter(t=>!['controls','audit_log'].includes(t.table_name));const before=await fingerprints(client,stable);const controlsBefore={},controlProjection={},eligible={};
   for(const schema of tenants){
    const def=(await client.query("SELECT column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name='controls' AND column_name='implementation_status'",[schema])).rows[0]?.column_default;
    controlsBefore[schema]=(await client.query(`SELECT id,implementation_status FROM ${qi(schema)}.controls ORDER BY id`)).rows;
    controlProjection[schema]=(await client.query(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(c)-'implementation_status'-'updated_at' ORDER BY id)::text,'[]')) h FROM ${qi(schema)}.controls c`)).rows[0].h;
    eligible[schema]=def?.includes('not_assessed')?[]:(await client.query(`SELECT c.id FROM ${qi(schema)}.controls c WHERE c.implementation_status='not_implemented' AND c.owner_id IS NULL AND c.last_reviewed_at IS NULL AND NULLIF(TRIM(COALESCE(c.implementation_notes,'')),'') IS NULL AND NULLIF(TRIM(COALESCE(c.testing_notes,'')),'') IS NULL AND c.updated_at<=c.created_at+INTERVAL '1 minute' AND NOT EXISTS(SELECT 1 FROM ${qi(schema)}.evidence_links l WHERE l.linked_type='control' AND l.linked_id=c.id) AND NOT EXISTS(SELECT 1 FROM ${qi(schema)}.control_tests t WHERE t.control_id=c.id) AND NOT EXISTS(SELECT 1 FROM ${qi(schema)}.risk_control_links r WHERE r.control_id=c.id)`)).rows.map(r=>r.id);
   }
   const files=(await fs.readdir(path.join(repo,'database/tenant-template'))).filter(name=>/^(017|018|019|020)_.*\.sql$/.test(name)).sort();assert.equal(files.length,4);
   const sql=await Promise.all(files.map(file=>fs.readFile(path.join(repo,'database/tenant-template',file),'utf8')));
   const runtimeUser=decodeURIComponent(new URL(env.DATABASE_URL).username);
   const newTables=['privacy_processing_activities','privacy_requests','privacy_impact_assessments','audit_participants','audit_requests','audit_request_evidence','audit_request_comments','assessment_outcomes'];
   for(const schema of tenants){await client.query(`SET LOCAL search_path=${qi(schema)},framework_data,global,public`);for(const statement of sql)await client.query(statement.replaceAll('{{SCHEMA}}',schema));for(const table of newTables)await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE ${qi(schema)}.${qi(table)} TO ${qi(runtimeUser)}`);}
   const after=await fingerprints(client,stable);assert.deepEqual(after,before,'Existing non-control records changed during migration.');
   for(const schema of tenants){const afterProjection=(await client.query(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(c)-'implementation_status'-'updated_at' ORDER BY id)::text,'[]')) h FROM ${qi(schema)}.controls c`)).rows[0].h;assert.equal(afterProjection,controlProjection[schema]);const permitted=new Set(eligible[schema]);const expected=controlsBefore[schema].map(row=>({...row,implementation_status:permitted.has(row.id)?'not_assessed':row.implementation_status}));assert.deepEqual((await client.query(`SELECT id,implementation_status FROM ${qi(schema)}.controls ORDER BY id`)).rows,expected);for(const table of newTables){const access=(await client.query("SELECT bool_and(has_table_privilege($1,$2,p)) allowed FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p",[runtimeUser,schema+'.'+table])).rows[0].allowed;assert(access,'Runtime access missing on new table.');}}
   await save('before-migration-fingerprints.private.json',{before,controlsBefore,eligible});await client.query('COMMIT');
   await publicReceipt('migrations.json',{passed:true,appliedAtomically:true,templates:files,tenants:tenants.length,existingStableTablesUnchanged:stable.length,accountsAndBillingPreserved:true,untouchedControlsReclassified:Object.values(eligible).reduce((n,ids)=>n+ids.length,0),runtimeAccessVerified:true,backupSha256:backup.sha256});
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{await client.end();}
 }else if(action==='preservation'){
  const backup=JSON.parse(await fs.readFile(path.join(evidence,'cloud-backup-restore.json'),'utf8'));assert.match(backup.localRestoreDatabase,/^compliance_cloud_restore_[a-f0-9]+$/);
  const restored=new pg.Client({connectionString:'postgresql://compliance_restore@127.0.0.1:55444/'+backup.localRestoreDatabase});const {client,env}=await database();
  try{await restored.connect();await restored.query("SET TIME ZONE 'UTC'");await client.query("SET TIME ZONE 'UTC'");
   const queries={accounts:'SELECT id,email,password_hash,is_active FROM global.users ORDER BY id',memberships:'SELECT id,tenant_id,user_id,role,is_active FROM global.tenant_memberships ORDER BY id',organisations:'SELECT id,name,slug,schema_name,deleted_at FROM global.tenants ORDER BY id',subscriptions:"SELECT to_jsonb(s)-'updated_at' row FROM global.subscriptions s ORDER BY id",plans:"SELECT to_jsonb(p)-'updated_at' row FROM global.subscription_plans p ORDER BY id"};
   const counts={};for(const [label,query] of Object.entries(queries)){const before=(await restored.query(query)).rows,after=(await client.query(query)).rows;const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');assert.equal(hash(after),hash(before),label+' changed after deployment.');counts[label]=after.length;}
   const latest=JSON.parse(await command(process.execPath,[railway,'variable','list','--project',PROJECT,'--service',SERVICE,'--environment','production','--json'],{log:'provider-vars-after.private.log'}));
   for(const key of ['DATABASE_URL','PROVISIONING_DATABASE_URL','JWT_PRIVATE_KEY_BASE64','JWT_PUBLIC_KEY_BASE64','ENCRYPTION_KEY','COOKIE_SECRET','SIGNATURE_SECRET','FRONTEND_URL'])assert.equal(latest[key],env[key],'Provider identity/configuration changed: '+key);
   await publicReceipt('preservation.json',{passed:true,counts,passwordsAndMembershipsPreserved:true,subscriptionTermsPreserved:true,providerIdentityKeysPreserved:true,sourceBackupSha256:backup.sha256});
  }finally{await restored.end();await client.end();}
 }else if(action==='backend'){
  assert(process.argv.includes('--approved'));assert(JSON.parse(await fs.readFile(path.join(evidence,'migrations.json'),'utf8')).passed);const release=await read('release.private.json');
  await command(process.execPath,[railway,'up','--project',PROJECT,'--environment','production','--service',SERVICE,'--detach','--message','Compliance workspace redesign '+release.commit],{cwd:release.source,log:'railway-deploy.private.log'});console.log(JSON.stringify({backendUploaded:true,commit:release.commit}));
 }else if(action==='backend-status'){
  console.log(JSON.stringify((await deployments()).map(d=>({id:d.id,status:d.status,message:d.meta?.cliMessage??d.meta?.deploymentMessage??d.meta?.message,createdAt:d.createdAt}))));
 }else if(action==='frontend'){
  assert(process.argv.includes('--approved'));const release=await read('release.private.json');
  await command(process.execPath,[vercel,'deploy','--prod','--skip-domain','--yes','--json','--build-env','VITE_API_URL=https://compliancecore-api-production.up.railway.app','--build-env','VITE_APP_ENV=production','--meta','sourceCommit='+release.commit],{cwd:path.join(release.source,'frontend'),env:{...process.env,VERCEL_PROJECT_ID:target.projectId,VERCEL_ORG_ID:target.orgId},log:'vercel-deploy.private.log'});console.log(JSON.stringify({frontendUploaded:true,commit:release.commit,candidates:await candidates()}));
 }else if(action==='frontend-status'){console.log(JSON.stringify(await candidates()));
 }else if(action==='promote'){
  assert(process.argv.includes('--approved'));const release=await read('release.private.json'),ready=(await candidates()).find(d=>d.state==='READY');assert(ready,'No ready candidate for the release.');
  assert(JSON.parse(await fs.readFile(path.join(evidence,'live-http-checks.json'),'utf8')).passed);assert(JSON.parse(await fs.readFile(path.join(evidence,'preservation.json'),'utf8')).passed);
  const successful=(await deployments()).find(d=>d.status==='SUCCESS'&&String(d.meta?.cliMessage??d.meta?.deploymentMessage??d.meta?.message??'').includes(release.commit));assert(successful,'The exact backend release is not successful.');
  await command(process.execPath,[vercel,'promote','https://'+ready.url,'--yes','--timeout','3m'],{cwd:path.join(release.source,'frontend'),env:{...process.env,VERCEL_PROJECT_ID:target.projectId,VERCEL_ORG_ID:target.orgId},log:'vercel-promote.private.log'});
  await publicReceipt('deployment.json',{promoted:true,commit:release.commit,backendDeployment:successful.id,frontendDeployment:ready.id,url:settings.FRONTEND_URL,promotedAt:new Date().toISOString()});
 }else throw Error('Choose preflight, prepare, migrate, backend, backend-status, frontend, frontend-status or promote.');
}catch(error){console.error('Release action failed:',error.message);process.exitCode=1;}
