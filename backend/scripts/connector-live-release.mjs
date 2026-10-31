// Explicit-target additive release. Secrets, archives and command output stay private.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import pg from 'pg';
const repo=path.resolve(import.meta.dirname,'../..');
const root=path.join(process.env.LOCALAPPDATA,'OrionSoft/ComplianceCore-private-20261023');
const folder=path.join(root,'ai-connectors-release-20261031');
const out=path.join(repo,'verification/ai-connectors-20261031');
await fs.mkdir(folder,{recursive:true});await fs.mkdir(out,{recursive:true});
const settings=JSON.parse(await fs.readFile(path.join(root,'production-env.private.json'),'utf8'));
const target=JSON.parse(await fs.readFile(path.join(root,'vercel-target.private.json'),'utf8'));
const project='267fa757-0e83-4343-a319-da9bb2d35fb6',service='0315f3e9-e667-446d-8ced-1f22ddc5300d';
assert.equal(settings.RAILWAY_PROJECT_ID,project);assert.equal(settings.RAILWAY_SERVICE_ID,service);assert.equal(target.projectId,'prj_Toi3vZFuaWT66u14pWT99DRHw3Iv');
const railway=path.join(process.env.APPDATA,'npm/node_modules/@railway/cli/bin/railway.js');
const vercel=path.join(process.env.LOCALAPPDATA,'npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js');
const read=async name=>JSON.parse(await fs.readFile(path.join(folder,name),'utf8'));
const save=(name,value)=>fs.writeFile(path.join(folder,name),JSON.stringify(value,null,2));
async function receipt(name,value){await fs.writeFile(path.join(out,name),JSON.stringify(value,null,2));console.log(JSON.stringify(value));}
async function command(executable,args,options={}){let stdout='',stderr='';const code=await new Promise((resolve,reject)=>{const child=spawn(executable,args,{cwd:repo,windowsHide:true,env:process.env,...options,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('error',reject);child.on('close',resolve);});await fs.writeFile(path.join(folder,crypto.randomUUID()+'.private.log'),stdout+'\n'+stderr);assert.equal(code,0,'Command failed; diagnostic retained in the private release folder.');return stdout;}
async function vc(route){for(let i=0;i<2;i++){const auth=JSON.parse(await fs.readFile(path.join(process.env.APPDATA,'com.vercel.cli/Data/auth.json'),'utf8'));const r=await fetch('https://api.vercel.com'+route,{headers:{Authorization:'Bearer '+auth.token}});if(r.ok)return r.json();if(i===0&&[401,403].includes(r.status)){await command(process.execPath,[vercel,'whoami']);continue;}throw Error('Provider metadata unavailable: '+r.status);}}
async function backends(){return JSON.parse(await command(process.execPath,[railway,'deployment','list','--project',project,'--service',service,'--environment','production','--limit','5','--json']));}
async function candidates(){const rel=await read('release.private.json');const result=await vc(`/v6/deployments?projectId=${target.projectId}&teamId=${target.orgId}&limit=15`);return result.deployments.filter(d=>d.meta?.sourceCommit===rel.commit).map(d=>({id:d.uid,url:d.url,state:d.state}));}
async function database(){const actual=await read('provider-env.private.json');const url=new URL(actual.PROVISIONING_DATABASE_URL||settings.DATABASE_URL),external=new URL(settings.DATABASE_URL);if(url.hostname.endsWith('.railway.internal')){url.hostname=external.hostname;url.port=external.port;}assert.equal(url.hostname,external.hostname);assert.equal(url.pathname,external.pathname);const client=new pg.Client({connectionString:url.href});await client.connect();return {client,actual};}
const action=process.argv[2];
try{
 if(action==='prepare'){
  const commit=(await command('git',['rev-parse','HEAD'])).trim();assert.match(commit,/^[a-f0-9]{40}$/);
  const actual=JSON.parse(await command(process.execPath,[railway,'variable','list','--project',project,'--service',service,'--environment','production','--json']));assert.equal(actual.FRONTEND_URL,'https://compliancecore-sand.vercel.app');await save('provider-env.private.json',actual);
  const previousBackend=(await backends()).find(d=>d.status==='SUCCESS');const previousFrontend=(await vc(`/v9/projects/${target.projectId}?teamId=${target.orgId}`)).targets.production;assert(previousBackend&&previousFrontend);
  const source=path.join(folder,'source-'+commit.slice(0,12)+'-prepared'),archive=source+'.zip';
  await command('git',['archive','--format=zip','--output',archive,commit]);
  await command('python',['-c',"import os,pathlib,zipfile\nroot=pathlib.Path(os.environ['RELEASE_SOURCE']).resolve()\nassert not root.exists(), 'Release destination already exists'\nwith zipfile.ZipFile(os.environ['RELEASE_ARCHIVE']) as archive:\n assert all((root/i.filename).resolve().is_relative_to(root) for i in archive.infolist()), 'Archive member escapes destination'\n archive.extractall(root)"],{env:{...process.env,RELEASE_ARCHIVE:archive,RELEASE_SOURCE:source}});
  await fs.mkdir(path.join(source,'frontend/.vercel'),{recursive:true});await fs.writeFile(path.join(source,'frontend/.vercel/project.json'),JSON.stringify(target));
  await save('release.private.json',{commit,source,previousBackend:previousBackend.id,previousFrontend:previousFrontend.id,createdAt:new Date().toISOString()});await receipt('source.json',{commit,previousBackend:previousBackend.id,previousFrontend:previousFrontend.id,cleanGitArchive:true});
 }else if(action==='migrate'){
  assert(process.argv.includes('--approved'));
  const rel=await read('release.private.json');const sql=await fs.readFile(path.join(rel.source,'database/migrations/016_notification_integrations.sql'),'utf8');
  const {client,actual}=await database();try{
   await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'");await client.query('SELECT pg_advisory_xact_lock(20261031,16)');
   const queries={accounts:'SELECT id,email,password_hash,is_active FROM global.users ORDER BY id',memberships:'SELECT id,tenant_id,user_id,role,is_active FROM global.tenant_memberships ORDER BY id',subscriptions:"SELECT to_jsonb(s)-'updated_at' row FROM global.subscriptions s ORDER BY id"};
   const before={};for(const [name,query]of Object.entries(queries))before[name]=crypto.createHash('sha256').update(JSON.stringify((await client.query(query)).rows)).digest('hex');
   await client.query(sql);await client.query("INSERT INTO global.schema_migrations(version,description) VALUES('016','016_notification_integrations.sql') ON CONFLICT DO NOTHING");
   const role=new URL(actual.DATABASE_URL).username;assert.match(role,/^[a-z_][a-z0-9_]{0,62}$/);await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON global.notification_integrations,global.integration_deliveries TO "${role}"`);
   for(const [name,query]of Object.entries(queries))assert.equal(crypto.createHash('sha256').update(JSON.stringify((await client.query(query)).rows)).digest('hex'),before[name],name+' changed during additive migration');
   await client.query('COMMIT');await receipt('migration.json',{passed:true,commit:rel.commit,additiveTables:2,existingAccountsMembershipsSubscriptionsUnchanged:true,providerMessagesSent:false});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{await client.end();}
 }else if(action==='backend'){
  assert(process.argv.includes('--approved'));assert(JSON.parse(await fs.readFile(path.join(out,'migration.json'),'utf8')).passed);const rel=await read('release.private.json');await command(process.execPath,[railway,'up','--project',project,'--service',service,'--environment','production','--detach','--message','AI and notification connectors '+rel.commit],{cwd:rel.source});console.log(JSON.stringify({uploaded:true,commit:rel.commit}));
 }else if(action==='frontend'){
  assert(process.argv.includes('--approved'));const rel=await read('release.private.json');await command(process.execPath,[vercel,'deploy','--prod','--skip-domain','--yes','--json','--build-env','VITE_API_URL=https://compliancecore-api-production.up.railway.app','--build-env','VITE_APP_ENV=production','--meta','sourceCommit='+rel.commit],{cwd:path.join(rel.source,'frontend'),env:{...process.env,VERCEL_PROJECT_ID:target.projectId,VERCEL_ORG_ID:target.orgId}});console.log(JSON.stringify(await candidates()));
 }else if(action==='status'){
  console.log(JSON.stringify({backend:(await backends()).map(d=>({id:d.id,status:d.status,message:d.meta?.cliMessage})),frontend:await candidates()}));
 }else if(action==='promote'){
  assert(process.argv.includes('--approved'));const rel=await read('release.private.json');const backend=(await backends()).find(d=>d.status==='SUCCESS'&&d.meta?.cliMessage?.includes(rel.commit));const frontend=(await candidates()).find(d=>d.state==='READY');assert(backend&&frontend,'Exact source release is not ready.');assert(JSON.parse(await fs.readFile(path.join(out,'live-api.json'),'utf8')).passed,'Live API acceptance required.');
  await command(process.execPath,[vercel,'promote','https://'+frontend.url,'--yes','--timeout','3m'],{cwd:path.join(rel.source,'frontend'),env:{...process.env,VERCEL_PROJECT_ID:target.projectId,VERCEL_ORG_ID:target.orgId}});
  await receipt('deployment.json',{promoted:true,commit:rel.commit,backendDeployment:backend.id,frontendDeployment:frontend.id,url:settings.FRONTEND_URL,at:new Date().toISOString()});
 }else throw Error('Choose prepare, migrate, backend, frontend, status or promote.');
}catch(error){console.error(error.message);process.exitCode=1;}
