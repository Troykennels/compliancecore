import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
if(new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1' || !new URL(process.env.DATABASE_URL).pathname.startsWith('/compliance_renewal_task_'))throw Error('Disposable local database only');
const localFetch=globalThis.fetch;
globalThis.fetch=(target,...args)=>{
  const url=new URL(typeof target==='string'||target instanceof URL?target:target.url);
  if(!['127.0.0.1','localhost'].includes(url.hostname))return Promise.reject(Error('External transport disabled in the presentation fixture'));
  return localFetch(target,...args);
};
const dir=path.join(os.tmpdir(),'compliance-presentation-20261023','s3-fixture');await fs.mkdir(dir,{recursive:true});
const storage=http.createServer(async(req,res)=>{
  try {
    const key=new URL(req.url,'http://127.0.0.1').pathname;
    const file=path.join(dir,Buffer.from(key).toString('base64url'));
    res.setHeader('Access-Control-Allow-Origin','*');
    if(req.method==='PUT'){const parts=[];for await(const part of req)parts.push(part);await fs.writeFile(file,Buffer.concat(parts));res.end();}
    else if(req.method==='HEAD'||req.method==='GET'){const body=await fs.readFile(file);res.setHeader('Content-Length',body.length);res.setHeader('Content-Type','application/pdf');res.end(req.method==='HEAD'?undefined:body);}
    else res.statusCode=405,res.end();
  } catch(err) {console.error('Fixture storage failure',req.method,err.code);res.statusCode=404;res.end();}
});
await new Promise(r=>storage.listen(3019,'127.0.0.1',r));
const {initBillingTables}=await import('../dist/modules/billing/billing.repository.js');await initBillingTables();
const {createApp}=await import('../dist/app.js');
const server=createApp().listen(3008,'127.0.0.1',()=>console.log('Isolated API and fixture object storage ready'));
function close(){server.close();storage.close();}
process.on('SIGINT',close);process.on('SIGTERM',close);
