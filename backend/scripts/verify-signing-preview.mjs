// This mutating regression check is restricted to the disposable presentation DB.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import pg from 'pg';
import assert from 'node:assert/strict';
const target=new URL(process.env.DATABASE_URL||'');
assert.equal(target.hostname,'127.0.0.1');assert.ok(target.pathname.startsWith('/compliance_renewal_task_presentation_'));
const access=JSON.parse(await fs.readFile(path.join(os.tmpdir(),'compliance-presentation-20261023','demo-access-local.json'),'utf8'));
const api='http://127.0.0.1:3008/api',checks=[];
async function request(method,route,token,body,expected=200){const r=await fetch(api+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});assert.equal(r.status,expected,method+' '+route);checks.push({method,route,status:r.status});return(await r.json()).data;}
const owner=await request('POST','/auth/login',null,{email:access.email,password:access.password});assert.equal(owner.activeTenant.id,access.tenantId);
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();let policy,viewer;
try{
 policy=await request('POST','/policies',owner.accessToken,{title:'Signature preview regression fixture',content:'Reviewed version one',documentType:'policy'},201);
 const preview=await request('GET',`/signatures/document/policy/${policy.id}/preview`,owner.accessToken);assert.ok(preview.fields.some(f=>f.name==='content'&&f.value==='Reviewed version one'));assert.match(preview.documentHash,/^[a-f0-9]{64}$/);
 await request('PATCH',`/policies/${policy.id}`,owner.accessToken,{content:'Changed after preview'});
 await request('POST','/signatures',owner.accessToken,{documentType:'policy',documentId:policy.id,documentHash:preview.documentHash},409);
 assert.equal((await request('GET',`/signatures/document/policy/${policy.id}`,owner.accessToken)).length,0);
 for(const type of ['__proto__','constructor','invoice'])await request('GET',`/signatures/document/${type}/${policy.id}/preview`,owner.accessToken,undefined,400);
 await request('GET',`/signatures/document/policy/${crypto.randomUUID()}/preview`,owner.accessToken,undefined,400);
 viewer=crypto.randomUUID();const email=`guide-check-${viewer}@example.invalid`,password=crypto.randomBytes(18).toString('base64url')+'Aa1!';
 await client.query(`INSERT INTO global.users(id,email,password_hash,first_name,last_name,email_verified_at,is_active,onboarding_completed_at,updated_at) VALUES($1,$2,$3,'Guide','Fixture',now(),true,now(),now())`,[viewer,email,await bcrypt.hash(password,10)]);
 await client.query(`INSERT INTO global.tenant_memberships(tenant_id,user_id,role,is_active,joined_at) VALUES($1,$2,'viewer',true,now())`,[access.tenantId,viewer]);
 let login=await request('POST','/auth/login',null,{email,password});
 await request('GET',`/signatures/document/policy/${policy.id}/preview`,login.accessToken,undefined,403);
 await request('POST','/signatures',login.accessToken,{documentType:'policy',documentId:policy.id},403);
 await client.query(`UPDATE global.tenant_memberships SET role='control_owner' WHERE tenant_id=$1 AND user_id=$2`,[access.tenantId,viewer]);
 login=await request('POST','/auth/login',null,{email,password});
 await request('GET',`/signatures/document/policy/${policy.id}/preview`,login.accessToken);
 await request('GET',`/signatures/document/audit/${crypto.randomUUID()}/preview`,login.accessToken,undefined,403);
 console.log(JSON.stringify({passed:true,checks:checks.length,stalePreviewRejected:true,viewerAndModulePermissionsEnforced:true}));
 await fs.mkdir('../verification/guide-billing-20261024',{recursive:true});await fs.writeFile('../verification/guide-billing-20261024/signing-api-results.json',JSON.stringify(checks,null,2));
}finally{
 if(policy)await request('DELETE',`/policies/${policy.id}`,owner.accessToken,undefined,200).catch(()=>{});
 if(viewer){await client.query(`DELETE FROM global.users WHERE id=$1 AND email LIKE 'guide-check-%@example.invalid'`,[viewer]);}
 await client.end();
}
