// Read-only managed-demo acceptance after the exact backend release is healthy.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.join(process.env.LOCALAPPDATA,'OrionSoft');
const access=JSON.parse(await fs.readFile(path.join(root,'ComplianceCore-Demo-Access.private.json'),'utf8'));
const privateFolder=path.join(root,'ComplianceCore-private-20261023/concept-release-20261031');
const out=path.resolve(process.env.COMPLIANCE_VERIFICATION_OUT??'../verification/live-20261031');
const base='https://compliancecore-api-production.up.railway.app/api';
const checks=[];let token,cookies;
async function call(route,{method='GET',body,status=200,anonymous=false,binary=false}={}){
 const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(!anonymous&&token?{Authorization:'Bearer '+token}:{}),...(!anonymous&&cookies?{Cookie:cookies}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 assert.equal(response.status,status,`${method} ${route} status ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());checks.push({method,route,status:response.status});
 if(route==='/auth/login')cookies=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 return binary?bytes:JSON.parse(bytes).data;
}
try{
 const health=await fetch(base.replace('/api','')+'/health',{signal:AbortSignal.timeout(45000)});assert(health.ok);checks.push({route:'/health',status:health.status});
 await call('/controls',{status:401,anonymous:true});
 const login=await call('/auth/login',{method:'POST',body:{email:access.email,password:access.password}});token=login.accessToken;assert.equal(login.activeTenant.id,access.tenantId);
 const results={};for(const route of ['/controls?limit=10','/risks?limit=10','/policies?limit=10','/evidence?limit=10','/audits?limit=10','/tasks?limit=10','/incidents?limit=10','/vendors?limit=10','/training','/approvals/requests','/approvals/workflows','/notifications','/notifications/preferences','/analytics/overview','/calendar','/privacy/summary','/privacy/activities','/privacy/requests','/privacy/assessments','/frameworks/implementation-overview','/frameworks/records/history','/billing/entitlement'])results[route]=await call(route);
 const overview=results['/frameworks/implementation-overview'];assert(Array.isArray(overview)&&overview.length>0);
 const current=overview.find(item=>item.framework.code==='ISO27001')??overview[0];
 const state=await call(`/frameworks/${current.framework.id}/implementation`);assert('outcome' in state&&'outcomeCurrent' in state,'Current assessment outcome contract missing.');
 const workbook=await call(`/frameworks/${current.framework.id}/assessment/workbook`,{binary:true});assert.equal(workbook.subarray(0,2).toString(),'PK');await fs.writeFile(path.join(out,'live-assessment-workbook.xlsx'),workbook);
 const audits=results['/audits?limit=10'].audits??results['/audits?limit=10'].items??results['/audits?limit=10'];assert(Array.isArray(audits)&&audits.length>0);
 const auditId=audits[0].id;await call(`/audits/${auditId}/room`);
 const files=results['/evidence?limit=10'].evidence??results['/evidence?limit=10'].items;assert(files?.length>0);
 const context={auditId,evidenceId:files[0].id,frameworkId:current.framework.id,tenantId:access.tenantId};await fs.writeFile(path.join(privateFolder,'live-demo-context.private.json'),JSON.stringify(context));
 await call('/auth/me');
 const receipt={passed:true,checks,managedDemoOnly:true,customerRecordWrites:false,realPayments:false,externalMessagesSent:false,readOnlyNewModules:['privacy','audit room','assessment outcome','notification preferences']};
 await fs.writeFile(path.join(out,'live-http-checks.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({passed:true,checks:checks.length,customerRecordWrites:false}));
}catch(error){console.error('Live HTTP acceptance failed:',error.message);await fs.writeFile(path.join(out,'live-http-failure.json'),JSON.stringify({message:error.message,checks},null,2));process.exitCode=1;}
