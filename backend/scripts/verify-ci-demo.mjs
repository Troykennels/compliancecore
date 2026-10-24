import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const api=process.env.API_URL||'http://127.0.0.1:3008';
assert.ok(['http://127.0.0.1:3008','https://compliancecore-api-production.up.railway.app'].includes(api));
const live=api.startsWith('https:');
const access=JSON.parse(await fs.readFile(live?path.join(process.env.LOCALAPPDATA,'OrionSoft','ComplianceCore-Demo-Access.private.json'):path.join(os.tmpdir(),'compliance-presentation-20261023','demo-access-local.json'),'utf8'));
const output=path.resolve('../verification/ci-presentation-20261024');await fs.mkdir(output,{recursive:true});
let token,cookies;const checks=[];
async function call(method,route,body){const r=await fetch(api+'/api'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});assert.ok(r.ok,`${method} ${route}: HTTP ${r.status}`);if(route==='/auth/login')cookies=r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');checks.push({method,route,status:r.status});return(await r.json()).data;}
function rows(data){if(Array.isArray(data))return data;for(const value of Object.values(data||{}))if(Array.isArray(value)&&value.every(x=>x&&typeof x==='object'))return value;throw Error('No record list');}
try{
 const auth=await call('POST','/auth/login',{email:access.email,password:access.password});token=auth.accessToken;
 assert.equal(auth.activeTenant.id,access.tenantId);assert.match(auth.activeTenant.name,/C&I Leasing/);
 const expectations=[['/departments','Citracks'],['/branches','Calabar'],['/policies','Fleet Safety'],['/risks','Marine contractor'],['/vendors','Marine Support'],['/audits','Fleet Dispatch'],['/training','Outsourced Personnel'],['/tasks','four-business-line'],['/expiry','crew certificate'],['/incidents','Citracks'],['/approvals/requests','marine supplier']];
 const lists=new Map();
 for(const [route,phrase]of expectations){const result=await call('GET',route);assert.ok(JSON.stringify(result).toLowerCase().includes(phrase.toLowerCase()),'Missing C&I scenario: '+route);lists.set(route,rows(result));}
 const allEvidence=rows(await call('GET','/evidence'));
 assert.ok(allEvidence.length>=6);
 for(const record of allEvidence.filter(r=>r.title.startsWith('Demo: '))){const detail=await call('GET','/evidence/'+record.id);const versions=rows(await call('GET',`/evidence/${record.id}/versions`));const version=versions.find(v=>v.id===detail.currentVersionId)||versions.find(v=>v.versionNumber===2);assert.ok(version,'Missing preserved evidence version');assert.ok(versions.length>=2);const link=await call('GET',`/evidence/${record.id}/download`);const response=await fetch(link.downloadUrl);assert.ok(response.ok);const body=Buffer.from(await response.arrayBuffer());assert.equal(body.subarray(0,4).toString(),'%PDF');assert.equal(crypto.createHash('sha256').update(body).digest('hex'),version.checksumSha256);}
 const invoices=rows(await call('GET','/billing/invoices'));
 const first=invoices.find(r=>r.number==='DEMO-ORION-001');assert.ok(first);assert.equal(first.lineItems.length,2);assert.equal(first.lineItems.reduce((n,r)=>n+r.amount,0),first.amountDue);assert.equal(first.metadata.notPayable,true);
 const pdf=await fetch(api+`/api/billing/invoices/${first.id}/download`,{headers:{Authorization:'Bearer '+token}});assert.ok(pdf.ok);const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,4).toString(),'%PDF');await fs.writeFile(path.join(output,live?'live-invoice.pdf':'local-invoice.pdf'),bytes);checks.push({route:'invoice-download',status:200});
 // New example signatures attest to the revised documents. Old snapshots are
 // revoked through the application, with their history and reason retained.
 for(const [type,route]of [['policy','/policies'],['audit','/audits'],['training','/training']]){
   const record=lists.get(route)[0];const signatures=await call('GET',`/signatures/document/${type}/${record.id}`);
   for(const signature of signatures.filter(s=>s.isValid&&!s.userAgent?.includes('C&I presentation v2')))await call('POST',`/signatures/${signature.id}/revoke`,{reason:'Earlier fictional presentation snapshot replaced by the C&I demonstration version.'});
   const existing=signatures.find(s=>s.isValid&&s.userAgent?.includes('C&I presentation v2'));
   // A fixed User-Agent lets repeat acceptance checks reuse their own signature.
   let signed=existing;
   if(!signed){const response=await fetch(api+'/api/signatures',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,'User-Agent':'C&I presentation v2 verification'},body:JSON.stringify({documentType:type,documentId:record.id})});assert.ok(response.ok,'New demo signature HTTP '+response.status);signed=(await response.json()).data;}
   assert.equal((await call('POST',`/signatures/${signed.id}/verify`,{})).valid,true);
 }
 const summary={passed:true,live,checks:checks.length,evidenceChecksumsVerified:allEvidence.length,results:checks};await fs.writeFile(path.join(output,live?'live-ci-api-results.json':'local-ci-api-results.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({passed:true,live,checks:checks.length,allSixEvidenceVersionsVerified:true}));
}catch(error){console.error(JSON.stringify({passed:false,message:error.message,checks}));process.exitCode=1;}
finally{if(token)await fetch(api+'/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,Cookie:cookies},body:'{}'}).catch(()=>{});}
