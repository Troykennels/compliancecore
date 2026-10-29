// Recovery drill only on the existing explicitly isolated local test database.
import pg from 'pg';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const source=new URL(process.env.DATABASE_URL??'');
assert.equal(source.hostname,'127.0.0.1');assert.equal(source.port,'55443');assert.match(source.pathname,/^\/compliance_renewal_task_workflow_/);
const bin='C:/Program Files/PostgreSQL/17/bin';
const dir=path.join(process.env.LOCALAPPDATA,'OrionSoft/compliance-workflow-20261026/recovery');await fs.mkdir(dir,{recursive:true});
const destination='compliance_step2_restore_'+crypto.randomBytes(5).toString('hex');
const dump=path.join(dir,destination+'.dump');
function run(name,args){return new Promise((resolve,reject)=>{const c=spawn(path.join(bin,name+'.exe'),args,{windowsHide:true,env:{...process.env,PGPASSWORD:decodeURIComponent(source.password)},stdio:['ignore','ignore','pipe']});let error='';c.stderr.on('data',d=>{error+=d});c.on('error',reject);c.on('exit',code=>code===0?resolve():reject(Error(name+' failed; output withheld to avoid credential exposure. '+error.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]').slice(0,400))));});}
const args=['-h',source.hostname,'-p',source.port,'-U',decodeURIComponent(source.username)];
const c=new pg.Client({connectionString:source.href});await c.connect();
const target=new URL(source);target.pathname='/'+destination;
let restore;
try{
 const version=(await c.query('SHOW server_version')).rows[0].server_version;assert.match(version,/^17\./);
 await run('pg_dump',[...args,'-d',source.pathname.slice(1),'-Fc','--no-owner','--no-acl','-f',dump]);
 assert.ok((await fs.stat(dump)).size>1024);
 const create=(await c.query("SELECT format('CREATE DATABASE %I WITH TEMPLATE template0 ENCODING %L LC_COLLATE %L LC_CTYPE %L',$1::text,pg_encoding_to_char(encoding),datcollate,datctype) sql FROM pg_database WHERE datname=current_database()",[destination])).rows[0].sql;
 await c.query(create);
 await run('pg_restore',[...args,'-d',destination,'--single-transaction','--no-owner','--no-acl',dump]);
 restore=new pg.Client({connectionString:target.href});await restore.connect();
 const tables=(await c.query("SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND (table_schema IN ('global','framework_data') OR table_schema~'^tenant_[a-f0-9]{32}$') ORDER BY 1,2")).rows;
 let total=0;
 for(const t of tables){const identifier='"'+t.table_schema+'"."'+t.table_name+'"';const sql=`SELECT count(*)::int n,md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY md5(to_jsonb(t)::text))::text,'[]')) hash FROM ${identifier} t`;const a=(await c.query(sql)).rows[0],b=(await restore.query(sql)).rows[0];assert.deepEqual(a,b,'Restored table differs: '+t.table_name);total+=a.n;}
 const receipt={passed:true,scope:'Local PostgreSQL17 test clone only; not a production restore or object-store recovery test',tables:tables.length,rows:total,sha256:crypto.createHash('sha256').update(await fs.readFile(dump)).digest('hex'),restoreDatabase:destination,backupStoredPrivately:true};
 await fs.mkdir('../verification/compliance-step2-20261026',{recursive:true});await fs.writeFile('../verification/compliance-step2-20261026/local-recovery.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await restore?.end();await c.end();}
