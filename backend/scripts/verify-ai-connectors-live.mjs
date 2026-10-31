// Managed-demo only. AI prompts are fictional; connector checks do not send messages.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=path.resolve('../verification/ai-connectors-20261031');await fs.mkdir(out,{recursive:true});
const access=JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA,'OrionSoft/ComplianceCore-Demo-Access.private.json'),'utf8'));
const api='https://compliancecore-api-production.up.railway.app/api';let token;const checks=[];
async function call(route,{method='GET',body,expected=200,anonymous=false}={}){
 const start=Date.now();const r=await fetch(api+route,{method,headers:{'Content-Type':'application/json',...(!anonymous&&token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90000)});const result=await r.json();checks.push({route,method,status:r.status,ms:Date.now()-start,code:result.error?.code});assert.equal(r.status,expected,route+': '+JSON.stringify(result.error??{}));return result.data;
}
try{
 await call('/integrations',{expected:401,anonymous:true});
 const login=await call('/auth/login',{method:'POST',body:{email:access.email,password:access.password}});token=login.accessToken;assert.equal(login.activeTenant.id,access.tenantId);
 const integrations=await call('/integrations');assert(Array.isArray(integrations));assert(!JSON.stringify(integrations).includes('encrypted_secrets'));assert(integrations.every(c=>!('secrets'in c)));
 for(const provider of ['slack','teams','email'])assert(Array.isArray(await call('/integrations/'+provider+'/deliveries')));
 // Missing setup must not send anything or create a pretend connection.
 if(!integrations.some(c=>c.provider==='slack'))await call('/integrations/slack',{method:'PATCH',body:{enabled:true},expected:422});
 const risk=await call('/ai/analyze-risk',{method:'POST',body:{riskTitle:'Fictional training environment outage',riskDescription:'Training-only scenario: a fictional test service has no documented recovery process.',context:'Fictional data. Propose options, never claim decisions or completed controls.'}});assert(risk.summary?.length>20);const levels=['very_low','low','medium','high','very_high'];assert.equal(risk.riskScore,(levels.indexOf(risk.likelihood)+1)*(levels.indexOf(risk.impact)+1));
 const policy=await call('/ai/generate-policy',{method:'POST',body:{policyType:'Short access control',organizationName:'Fictional Training Company',scope:'Fictional training environment only',additionalContext:'Keep this draft concise, under 400 words. No approvals or decisions have been made.'}});assert(policy.title&&policy.policy?.length>100&&Array.isArray(policy.sections));
 const documentText='This is a fictional training contract between Training Company and Test Supplier. Either party may terminate by giving thirty days written notice. Test data is retained for ninety days, then deleted. No actual approval or signature exists.';
 const summary=await call('/ai/summarize-contract',{method:'POST',body:{documentText}});assert(summary.summary?.length>20&&Array.isArray(summary.obligations)&&summary.wordCount>20);
 const answer=await call('/ai/document-qa',{method:'POST',body:{documentText,question:'What notice is required for termination?'}});assert(answer.answer?.length>10&&Array.isArray(answer.citations));assert(answer.citations.every(q=>documentText.includes(q)));
 const checklist=await call('/ai/generate-checklist',{method:'POST',body:{framework:'Internal training controls',scope:'Fictional test-only service and five training staff',additionalContext:'Draft recommendations only. Keep each of the 25 items concise.'}});assert(checklist.items.length>=25&&checklist.totalItems===checklist.items.length);
 // Read-only nonmatching search must provide an honest empty result.
 const search=await call('/ai/search',{method:'POST',body:{query:'nonexistentfictionaldocument20261031'}});assert.deepEqual(search.relevantDocuments,[]);
 await call('/ai/generate-policy',{method:'POST',body:{policyType:''},expected:422});
 const result={passed:true,checks,source:'Managed demonstration workspace; fictional prompts only',externalConnectorMessagesSent:false,customerBusinessRecordsChanged:false,aiChecks:['risk ratings and calculated score','policy draft','pasted contract summary','pasted document Q&A and verified quotations','structured checklist','empty evidence search','input validation']};await fs.writeFile(path.join(out,'live-api.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,checks:checks.length,externalConnectorMessagesSent:false}));
}catch(e){await fs.writeFile(path.join(out,'live-api-failure.json'),JSON.stringify({message:e.message,checks},null,2));console.error(e.message);process.exitCode=1;}
