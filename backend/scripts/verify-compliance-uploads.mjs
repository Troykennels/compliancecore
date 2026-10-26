import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
const live=process.env.COMPLIANCE_LIVE==='1';const base=live?'https://compliancecore-api-production.up.railway.app':'http://127.0.0.1:3008';
const fixture=live?null:JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA,'OrionSoft/compliance-workflow-20261026/compliance-access.private.json'),'utf8'));
const access=live?JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA,'OrionSoft/ComplianceCore-Demo-Access.private.json'),'utf8')):fixture.owner;
const checks=[];let token;let evidenceId;const stamp=crypto.randomUUID();
async function call(method,endpoint,body){const r=await fetch(base+'/api'+endpoint,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});let json;try{json=await r.json();}catch{}return {status:r.status,json};}
function check(name,value){assert.ok(value,name);checks.push(name);}
const pdf=new PDFDocument();const parts=[];pdf.on('data',x=>parts.push(x));const finished=new Promise(r=>pdf.on('end',r));pdf.text('ComplianceCore synthetic upload verification.');pdf.text('No organisational or personal information.');pdf.end();await finished;const content=Buffer.concat(parts);
try{
 const login=await call('POST','/auth/login',{email:access.email,password:access.password});assert.equal(login.status,200);token=login.json.data.accessToken;
 // A production write test must be explicitly confined to the supplied demo.
 if(live){const org=await call('GET','/organizations/profile');check('Live upload target is visibly a demonstration organisation',org.status===200&&/demo|demonstration/i.test(JSON.stringify(org.json.data)));}
 const init=await call('POST','/evidence/upload',{title:'Synthetic verification — '+stamp,description:'Temporary synthetic upload and download check; no organisation data.',fileName:'synthetic-verification.pdf',fileSize:content.length,mimeType:'application/pdf'});check('Upload initiation succeeds',init.status>=200&&init.status<300);const upload=init.json.data;evidenceId=upload.evidenceId;
 const put=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:content});check('File bytes reach configured object storage',put.ok);
 const mismatch=await call('POST',`/evidence/${evidenceId}/versions/${upload.versionId}/confirm`,{fileSizeBytes:content.length+7});check('Incomplete or mismatched byte count is refused',mismatch.status===400||mismatch.status===422);
 const confirm=await call('POST',`/evidence/${evidenceId}/versions/${upload.versionId}/confirm`,{fileSizeBytes:content.length,checksumSha256:crypto.createHash('sha256').update(content).digest('hex')});check('Upload confirmation succeeds',confirm.status===200);const retry=await call('POST',`/evidence/${evidenceId}/versions/${upload.versionId}/confirm`,{fileSizeBytes:content.length});check('Repeated successful confirmation is idempotent',retry.status===200);
 const detail=await call('GET','/evidence/'+evidenceId);check('Saved evidence resolves to the uploaded file',detail.status===200&&detail.json.data.currentFileName==='synthetic-verification.pdf');
 const download=await call('GET',`/evidence/${evidenceId}/download`);check('Download URL can be obtained',download.status===200&&Boolean(download.json.data.downloadUrl));const stored=await fetch(download.json.data.downloadUrl);check('Downloaded bytes match exactly',stored.ok&&Buffer.from(await stored.arrayBuffer()).equals(content));
 const versions=await call('GET',`/evidence/${evidenceId}/versions`);check('Version history contains completed upload',versions.status===200&&versions.json.data.some(v=>v.id===upload.versionId&&v.uploadStatus==='completed'));
 if(fixture){
  const link=await call('POST',`/evidence/${evidenceId}/links`,{linkedType:'control',linkedId:fixture.controlId});check('Evidence links to a real control',link.status>=200&&link.status<300);
  const viewer=await call('POST','/auth/login',{email:fixture.viewer.email,password:fixture.viewer.password});token=viewer.json.data.accessToken;check('Read-only role cannot upload files',(await call('POST','/evidence/upload',{title:'Forbidden',fileName:'x.pdf',fileSize:10,mimeType:'application/pdf'})).status===403);
  check('Read-only role cannot save risk assessment',(await call('PUT',`/frameworks/${fixture.frameworkId}/assessment/risks`,{})).status===403);
  const owner=await call('POST','/auth/login',{email:access.email,password:access.password});token=owner.json.data.accessToken;
 }
 const wrong=await call('POST','/evidence/upload',{title:'Synthetic rejected format '+stamp,fileName:'not-an-image.png',fileSize:content.length,mimeType:'image/png'});assert.ok(wrong.status>=200&&wrong.status<300);const bad=wrong.json.data;
 await fetch(bad.uploadUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:content});
 try{const rejected=await call('POST',`/evidence/${bad.evidenceId}/versions/${bad.versionId}/confirm`,{fileSizeBytes:content.length});check('Mislabelled file contents cannot be confirmed as an image',rejected.status===400||rejected.status===422);}finally{await call('DELETE','/evidence/'+bad.evidenceId);}
 const remove=await call('DELETE','/evidence/'+evidenceId);check('Synthetic evidence can be removed',remove.status>=200&&remove.status<300);const missing=await call('GET','/evidence/'+evidenceId);check('Removed evidence is no longer accessible',missing.status===404);
 const out='../verification/compliance-product-20261026';await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,live?'live-upload-results.json':'local-upload-results.json'),JSON.stringify({passed:true,live,checks,syntheticEvidenceId:evidenceId,bytes:content.length,removed:true},null,2));console.log(JSON.stringify({passed:true,live,checks:checks.length,bytes:content.length,syntheticRecordRemoved:true}));
}finally{if(evidenceId&&token)await call('DELETE','/evidence/'+evidenceId).catch(()=>{});}
