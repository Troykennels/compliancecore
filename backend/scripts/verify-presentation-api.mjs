import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const API=process.env.API_URL||'http://127.0.0.1:3008';
assert.ok(['http://127.0.0.1:3008','https://compliancecore-api-production.up.railway.app'].includes(API));
const live=API.startsWith('https:');
const access=JSON.parse(await fs.readFile(live?path.join(process.env.LOCALAPPDATA,'OrionSoft','ComplianceCore-Demo-Access.private.json'):path.join(os.tmpdir(),'compliance-presentation-20261023','demo-access-local.json'),'utf8'));
let token;const results=[];
async function call(method,p,body){const r=await fetch(API+'/api'+p,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const j=await r.json();results.push({method,path:p,status:r.status});assert.ok(r.ok,`${method} ${p}: ${r.status} ${j.error?.code||''}`);return j.data??j;}
const first=data=>{if(Array.isArray(data))return data[0];for(const value of Object.values(data||{}))if(Array.isArray(value)&&value[0]?.id)return value[0];throw Error('Demo list is empty');};
try{
 const login=await call('POST','/auth/login',{email:access.email,password:access.password});token=login.accessToken;
 assert.equal(login.activeTenant.slug,'orionsoftlimited-demo');assert.equal(login.activeTenant.id,access.tenantId);
 const coverage=(await call('GET','/reports/dashboard')).frameworkCoverage;assert.ok(coverage.length>=3);assert.ok(coverage.every(f=>f.totalControls>0));
 for(const type of ['audit','training']){
  const record=first(await call('GET',type==='audit'?'/audits':'/training'));
  const existing=await call('GET',`/signatures/document/${type}/${record.id}`);
  const signature=existing[0]||await call('POST','/signatures',{documentType:type,documentId:record.id});
  const verify=await call('POST',`/signatures/${signature.id}/verify`,{});assert.equal(verify.valid,true);
 }
 const evidence=first(await call('GET','/evidence'));
 const versions=await call('GET',`/evidence/${evidence.id}/versions`);const version=first(versions);
 const link=await call('GET',`/evidence/${evidence.id}/download`);
 const file=await fetch(link.downloadUrl);assert.equal(file.status,200);const bytes=Buffer.from(await file.arrayBuffer());assert.equal(bytes.subarray(0,4).toString(),'%PDF');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),version.checksumSha256);
 for(const format of ['pdf','excel']){const r=await fetch(API+'/api/reports/export/'+format,{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.ok(bytes.length>1000);assert.equal(bytes.subarray(0,format==='pdf'?4:2).toString(),format==='pdf'?'%PDF':'PK');results.push({method:'GET',path:'/reports/export/'+format,status:200});}
 const key=(await call('GET','/notifications/push'))?.publicKey;assert.ok(key?.length>70);
 console.log(JSON.stringify({passed:true,checks:results.length,realEvidenceChecksumVerified:true,frameworkCoverage:coverage.length,results}));
}catch(e){console.error(JSON.stringify({passed:false,message:e.message,results}));process.exitCode=1;}
