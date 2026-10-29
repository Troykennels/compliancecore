// Reviewed Step2 deltas only. Default plan is read-only; --validate always rolls back.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import pg from 'pg';
const apply=process.argv.includes('--apply'),validate=process.argv.includes('--validate');assert.ok(!(apply&&validate),'Choose apply or validate.');const url=new URL(process.env.PROVISIONING_DATABASE_URL??process.env.DATABASE_URL??'');
const local=['127.0.0.1','localhost'].includes(url.hostname);if(apply&&!local&&!process.argv.includes('--production-change-approved'))throw Error('Production writes require explicit approval. Use the read-only plan or isolated restored-copy validation.');
const root=path.resolve(import.meta.dirname,'../..');const c=new pg.Client({connectionString:url.href});await c.connect();const globalFile='014_global_compliance_history.sql';const tenantFiles=['015_compliance_assessments.sql','016_compliance_governance.sql'];
try{
 const schemas=(await c.query("SELECT schema_name FROM global.tenants WHERE deleted_at IS NULL AND schema_name IS NOT NULL ORDER BY schema_name")).rows.map(r=>r.schema_name);assert.ok(schemas.every(s=>/^tenant_[a-f0-9]{32}$/.test(s)),'Unexpected tenant schema.');
 if(!apply&&!validate){console.log(JSON.stringify({mode:'read-only plan',global:globalFile,tenantTemplates:tenantFiles,tenants:schemas.length,rollback:'Revert application release while retaining additive tables; transaction rollback for validation; full backup restore only into an explicitly approved target.'}));}
 else{
  const global=await fs.readFile(path.join(root,'database/migrations',globalFile),'utf8');const templates=await Promise.all(tenantFiles.map(f=>fs.readFile(path.join(root,'database/tenant-template',f),'utf8')));
  // One atomic release transaction: no partially upgraded organisation set.
  await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='90s'");await c.query(global);
  for(const schema of schemas){await c.query('SET LOCAL search_path="'+schema+'",framework_data,global,public');for(const sql of templates)await c.query(sql.replaceAll('{{SCHEMA}}',schema));}
  await c.query("INSERT INTO global.schema_migrations(version,description) VALUES('014',$1) ON CONFLICT(version) DO NOTHING",[globalFile]);
  await c.query(validate?'ROLLBACK':'COMMIT');console.log(JSON.stringify({passed:true,mode:validate?'validated and rolled back':'applied atomically',tenants:schemas.length,global:globalFile,tenantTemplates:tenantFiles,credentialsPrinted:false}));
 }
}catch(e){await c.query('ROLLBACK').catch(()=>{});console.error('Release migration failed:',e.message);process.exitCode=1;}finally{await c.end();}
