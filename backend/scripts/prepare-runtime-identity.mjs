// Explicit operator step. Dry-run is the default; never prints passwords or URLs.
import pg from 'pg';import crypto from 'node:crypto';import fs from 'node:fs/promises';import path from 'node:path';
import {runtimeTenantGrants} from '../dist/lib/runtime-privileges.js';
const source=new URL(process.env.DATABASE_URL??'');const role=process.env.RUNTIME_DATABASE_ROLE??'compliance_runtime';if(!/^[a-z_][a-z0-9_]{0,62}$/.test(role))throw Error('Invalid runtime role.');
const apply=process.argv.includes('--apply');const local=source.hostname==='127.0.0.1'&&source.port==='55443'&&/^\/compliance_renewal_task_workflow_/.test(source.pathname);
if(apply&&!local&&!process.argv.includes('--production-change-approved'))throw Error('Production role/grant changes require explicit operator approval. Dry-run remains available.');
const c=new pg.Client({connectionString:source.href});await c.connect();
try{
 const schemas=(await c.query("SELECT schema_name FROM global.tenants WHERE deleted_at IS NULL AND schema_name~'^tenant_[a-f0-9]{32}$'")).rows.map(r=>r.schema_name);
 const sql=['GRANT USAGE ON SCHEMA global,framework_data TO "'+role+'";', 'GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA global TO "'+role+'";', 'GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA global TO "'+role+'";', 'GRANT SELECT ON ALL TABLES IN SCHEMA framework_data TO "'+role+'";', 'REVOKE ALL ON global.global_audit_log FROM "'+role+'";', 'GRANT SELECT ON global.global_audit_log TO "'+role+'";', 'REVOKE INSERT,UPDATE,DELETE ON global.schema_migrations FROM "'+role+'";', ...schemas.map(s=>runtimeTenantGrants(s,role))].join('\n');
 if(!apply){console.log(JSON.stringify({dryRun:true,role,tenants:schemas.length,changes:['Non-superuser login','Scoped runtime grants','Append-only ledger and immutable decision versions','Separate provisioning URL required; keep operator credentials out of normal query pool']}));}
 else{
  const exists=(await c.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rows.length;if(exists)throw Error('Role already exists; this tool does not rotate a live password. Choose a new reviewed role or apply grants separately.');
  const password=crypto.randomBytes(36).toString('base64url');const create=(await c.query("SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',$1::text,$2::text) sql",[role,password])).rows[0].sql;
  await c.query('BEGIN');try{await c.query(create);await c.query(sql);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}
  const runtime=new URL(source);runtime.username=role;runtime.password=password;
  const dir=path.join(process.env.LOCALAPPDATA??process.cwd(),'OrionSoft/compliance-workflow-20261026');await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'runtime-identity.private.json'),JSON.stringify({DATABASE_URL:runtime.href,PROVISIONING_DATABASE_URL:source.href,RUNTIME_DATABASE_ROLE:role}));
  console.log(JSON.stringify({applied:true,role,tenants:schemas.length,credentialsSavedPrivately:true,production:!local}));
 }
}catch(e){console.error('Runtime identity preparation failed:',e.message);process.exitCode=1;}finally{await c.end();}
