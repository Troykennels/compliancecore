// Explicit operator actions for the existing managed demo. Never prints secrets.
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const root=path.join(process.env.LOCALAPPDATA,'OrionSoft/ComplianceCore-private-20261023');
const privateDir=path.join(root,'demo-refresh-20261026');
const settings=JSON.parse(await fs.readFile(path.join(root,'production-env.private.json'),'utf8'));
assert.equal(settings.FRONTEND_URL,'https://compliancecore-sand.vercel.app');
assert.equal(settings.RAILWAY_SERVICE_ID,'0315f3e9-e667-446d-8ced-1f22ddc5300d');
const restored=process.argv.includes('--restored'),action=process.argv[2];
const receipt=JSON.parse(await fs.readFile('../verification/demo-refresh-20261026/cloud-backup-restore.json','utf8'));
assert.ok(receipt.passed&&receipt.cloudReadOnly&&receipt.consistentNativeSnapshot,'Verified fresh backup required');
let url=settings.DATABASE_URL;
if(restored){assert.match(receipt.localRestoreDatabase,/^compliance_cloud_restore_[a-f0-9]{10}$/);url='postgresql://compliance_restore@127.0.0.1:55444/'+receipt.localRestoreDatabase;}
const env={...process.env,...settings,DATABASE_URL:url,PROVISIONING_DATABASE_URL:url,RUNTIME_DATABASE_ROLE:'compliance_runtime_20261026',RUNTIME_IDENTITY_OUTPUT_DIR:privateDir};
if(['migrate','identity','seed'].includes(action)&&!restored&&!process.argv.includes('--approved'))throw Error('Explicit approved production action required');
async function child(script,args=[],extra={}){const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[script,...args],{env:Object.fromEntries(Object.entries({...env,...extra}).filter(([,v])=>v!==''&&v!==undefined)),stdio:'inherit',windowsHide:true});p.on('error',reject);p.on('exit',resolve);});process.exitCode=code??1;}
const quote=v=>'"'+v.replaceAll('"','""')+'"';
if(action==='migrate')await child('scripts/step2-release-migrations.mjs',['--apply','--production-change-approved']);
else if(action==='identity')await child('scripts/prepare-runtime-identity.mjs',['--apply','--production-change-approved']);
else if(action==='seed')await child('scripts/refresh-current-demo.mjs',[],{DEMO_REFRESH_APPROVED:'orionsoftlimited-step2',DEMO_REFRESH_RESTORED:restored?'true':'false',SMTP_HOST:'127.0.0.1',SMTP_PORT:'1',SMTP_USER:'fixture',SMTP_PASS:'fixture',BREVO_API_KEY:'',ENABLE_REDIS:'false',REDIS_URL:'redis://127.0.0.1:1',PAYSTACK_SECRET_KEY:'',GROQ_API_KEY:'fixture-disabled'});
else if(['before','after'].includes(action)){
 assert.equal(restored,false,'Preservation receipt is for the actual online database');
 const c=new pg.Client({connectionString:url});await c.connect();
 try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const demo=(await c.query("SELECT d.tenant_id,t.schema_name FROM global.presentation_demos d JOIN global.tenants t ON t.id=d.tenant_id WHERE d.demo_key='orionsoftlimited' AND t.slug='orionsoftlimited-demo'")).rows[0];assert.ok(demo);
  const file=path.join(privateDir,'non-demo-before.private.json');let tables;
  if(action==='before')tables=(await c.query("SELECT c.table_schema,c.table_name,array_agg(c.column_name::text ORDER BY c.ordinal_position) columns FROM information_schema.columns c JOIN information_schema.tables t USING(table_schema,table_name) WHERE t.table_type='BASE TABLE' AND c.table_schema~'^tenant_[a-f0-9]{32}$' AND c.table_schema<>$1 GROUP BY c.table_schema,c.table_name ORDER BY 1,2",[demo.schema_name])).rows;
  else tables=JSON.parse(await fs.readFile(file,'utf8')).tables;
  const fingerprints=[];
  for(const t of tables){const r=(await c.query(`SELECT count(*)::int n,md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY md5(to_jsonb(x)::text))::text,'[]')) h FROM (SELECT ${t.columns.map(quote).join(',')} FROM ${quote(t.table_schema)}.${quote(t.table_name)}) x`)).rows[0];fingerprints.push({s:t.table_schema,t:t.table_name,...r});}
  const contracts=(await c.query("SELECT id,tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end,next_invoice_amount,currency FROM global.subscriptions WHERE tenant_id<>$1 ORDER BY id",[demo.tenant_id])).rows;
  if(action==='before'){await fs.writeFile(file,JSON.stringify({tables,fingerprints,contracts}));console.log(JSON.stringify({capturedNonDemoTables:tables.length,customerContracts:contracts.length,privateFingerprintsOnly:true}));}
  else{const before=JSON.parse(await fs.readFile(file,'utf8'));assert.deepEqual(fingerprints,before.fingerprints,'Non-demo business data changed');assert.equal(JSON.stringify(contracts),JSON.stringify(before.contracts),'Customer commercial terms changed');const result={passed:true,nonDemoTablesUnchanged:tables.length,customerContractsUnchanged:contracts.length,scope:'All original columns of non-demo tenant tables and customer commercial terms'};await fs.writeFile('../verification/demo-refresh-20261026/customer-preservation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
  await c.query('COMMIT');
 }finally{await c.end();}
}else throw Error('Select before, migrate, identity, seed or after');
