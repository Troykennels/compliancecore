// Applies proposed migrations only to the isolated restored copy, then compares
// every original column/row. Never connects to the live database.
import fs from 'node:fs/promises';import pg from 'pg';import path from 'node:path';import assert from 'node:assert/strict';
const receiptDir=process.argv.find(v=>v.startsWith('--receipt-dir='))?.slice(14)??'../verification/compliance-step2-20261026';
const receipt=JSON.parse(await fs.readFile(path.join(receiptDir,'cloud-backup-restore.json'),'utf8'));assert.equal(receipt.passed,true);const name=receipt.localRestoreDatabase;assert.match(name,/^compliance_cloud_restore_[a-f0-9]{10}$/);
const c=new pg.Client({connectionString:'postgresql://compliance_restore@127.0.0.1:55444/'+name});await c.connect();
const quote=v=>'"'+v.replaceAll('"','""')+'"';
try{
 await c.query("SET TIME ZONE 'UTC'");
 const tables=(await c.query("SELECT c.table_schema,c.table_name,array_agg(c.column_name::text ORDER BY c.ordinal_position) columns FROM information_schema.columns c JOIN information_schema.tables t USING(table_schema,table_name) WHERE t.table_type='BASE TABLE' AND (c.table_schema IN ('global','framework_data') OR c.table_schema~'^tenant_[a-f0-9]{32}$') GROUP BY c.table_schema,c.table_name ORDER BY 1,2")).rows;
 const statements=tables.map(t=>`SELECT '${t.table_schema}' s,'${t.table_name}' t,count(*)::int n,md5(COALESCE(jsonb_agg(to_jsonb(r) ORDER BY md5(to_jsonb(r)::text))::text,'[]')) h FROM (SELECT ${t.columns.map(quote).join(',')} FROM ${quote(t.table_schema)}.${quote(t.table_name)}) r`);
 const order=(a,b)=>(a.s+'.'+a.t).localeCompare(b.s+'.'+b.t);const before=(await c.query(statements.join(' UNION ALL '))).rows.sort(order);
 const schemas=(await c.query("SELECT schema_name FROM global.tenants WHERE deleted_at IS NULL AND schema_name~'^tenant_[a-f0-9]{32}$'")).rows.map(r=>r.schema_name);
 const templates=await fs.readdir('../database/tenant-template');const sql=await Promise.all(templates.filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFile(path.join('../database/tenant-template',f),'utf8')));
 const global=await fs.readFile('../database/migrations/014_global_compliance_history.sql','utf8');
 async function apply(){await c.query(global);for(const schema of schemas)await c.query(sql.map(raw=>raw.replaceAll('{{SCHEMA}}',schema)).join(';\n'));}
 await c.query('BEGIN');await apply();await c.query('ROLLBACK');
 const dry=(await c.query(statements.join(' UNION ALL '))).rows.sort(order);for(let i=0;i<before.length;i++)assert.ok(JSON.stringify(dry[i])===JSON.stringify(before[i]),'Dry-run preservation mismatch in '+before[i].s+'.'+before[i].t);
 await c.query('BEGIN');await apply();await c.query('COMMIT');
 const after=(await c.query(statements.join(' UNION ALL '))).rows.sort(order);for(let i=0;i<before.length;i++)assert.ok(JSON.stringify(after[i])===JSON.stringify(before[i]),'Migration preservation mismatch in '+before[i].s+'.'+before[i].t);
 const result={passed:true,scope:'Isolated PostgreSQL18 restored copy only; live database unchanged',originalTablesPreserved:tables.length,originalRowsPreserved:before.reduce((n,r)=>n+r.n,0),tenantsMigrated:schemas.length,globalMigration:'014_global_compliance_history.sql',tenantTemplates:sql.length,dryRunRolledBack:true,originalColumnsAndRowsUnchanged:true,newStructuresAndMetadataOnly:true};
 await fs.writeFile(path.join(receiptDir,'restored-cloud-migration-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){await c.query('ROLLBACK').catch(()=>{});console.error('Restored-copy migration check failed:',error.message);process.exitCode=1;}finally{await c.end();}
