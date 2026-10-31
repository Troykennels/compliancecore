import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=path.resolve('../verification/ai-connectors-20261031');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();const checks=[],errors=[];
const tenant='11111111-1111-4111-8111-111111111111';
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(30000);const saved={};const deliveries={};
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname.replace('/api','');let data={},status=200;
   if(p==='/auth/refresh')data={accessToken:'fixture-token'};
   else if(p==='/auth/me')data={id:'22222222-2222-4222-8222-222222222222',email:'fixture@example.invalid',firstName:'Fixture',lastName:'Administrator',emailVerifiedAt:'2026-01-01',isActive:true,onboardingCompletedAt:'2026-01-01',tenants:[{id:tenant,name:'Connector verification',slug:'connector-verification',role:'owner'}]};
   else if(p==='/integrations')data=Object.values(saved);
   else if(p.startsWith('/integrations/')){
    const provider=p.split('/')[2];
    if(p.endsWith('/deliveries'))data=deliveries[provider]??[];
    else if(req.method()==='PUT'){
     const body=req.postDataJSON();if(provider==='slack'&&body.secrets.webhookUrl==='invalid'){status=422;await route.fulfill({status,contentType:'application/json',body:JSON.stringify({error:{message:'Use the Slack incoming webhook HTTPS URL supplied by your provider.'}})});return;}
     saved[provider]={provider,config:body.config,enabled:false,verifiedAt:null,updatedAt:new Date().toISOString(),configuredSecrets:Object.keys(body.secrets)};data=saved[provider];
    }else if(p.endsWith('/test')){saved[provider].verifiedAt=new Date().toISOString();deliveries[provider]=[{id:'fixture-delivery',isTest:true,status:'delivered',message:'Provider accepted delivery.',createdAt:new Date().toISOString()}];data={message:'Provider accepted test.'};}
    else if(req.method()==='PATCH'){saved[provider].enabled=req.postDataJSON().enabled;data=saved[provider];}
    else if(req.method()==='DELETE'){delete saved[provider];deliveries[provider]=[];data={message:'Disconnected'};}
   }else if(p==='/ai/summarize-contract')data={summary:'Fictional contract draft summary',keyTerms:['Thirty days notice'],obligations:[],risks:[],expiryDates:[],wordCount:40};
   else if(p==='/ai/document-qa')data={answer:'Thirty days written notice is required.',confidence:'high',citations:['Thirty days written notice is required.']};
   else if(p.includes('entitlement'))data={canWrite:true,state:'active',limits:{},usage:{},warnings:[]};
   else if(p.includes('notifications'))data={notifications:[],unreadCount:0,total:0};
   else if(p.includes('organizations'))data={id:tenant,name:'Connector verification',slug:'connector-verification',onboardingCompletedAt:'2026-01-01'};
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify({data,error:null})});
  });
  await page.goto('http://127.0.0.1:5178/integrations');await page.getByRole('heading',{name:'Notification connections',exact:true}).waitFor();
  assert.equal(await page.getByText('Coming soon',{exact:true}).count(),3);checks.push({width,check:'Only Jira, Drive and Okta remain planned'});
  for(const [index,provider]of ['slack','teams','email'].entries()){
   await page.getByRole('button',{name:'Set up connection',exact:true}).nth(index).click();
   const editor=page.getByRole('region',{name:(provider==='slack'?'Slack':provider==='teams'?'Microsoft Teams':'Email / SMTP')+' connection settings'});await editor.waitFor();
   await editor.scrollIntoViewIfNeeded();
   const enable=editor.getByRole('button',{name:'Enable notifications',exact:true});assert(await enable.isDisabled());
   if(provider==='email'){
    await editor.getByLabel('Sender email (required)').fill('sender@example.invalid');
    await editor.getByLabel('SMTP hostname (required)').fill('smtp.example.com');
    await editor.getByLabel(/SMTP username/).fill('fixture-user');await editor.getByLabel(/SMTP password/).fill('fixture-password');
   }else{
    await editor.getByLabel(/Webhook URL/).fill(provider==='slack'?'https://hooks.slack.com/services/fixture':'https://fixture.environment.api.powerplatform.com/workflows/test');
   }
   await editor.getByRole('button',{name:'Save settings',exact:true}).click();await editor.getByRole('status').waitFor();
   assert(await enable.isDisabled());
   assert.equal(await editor.locator('input[type=password]').first().inputValue(),'');
   await editor.getByRole('button',{name:'Send connection test',exact:true}).click();await editor.getByText('Provider accepted the test. Check your destination before enabling.',{exact:true}).waitFor();
   await enable.click();await editor.getByRole('button',{name:'Pause notifications',exact:true}).waitFor();
   await page.screenshot({path:path.join(out,`${provider}-setup-${width}.png`),fullPage:false});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await editor.getByRole('button',{name:'Pause notifications',exact:true}).click();await editor.getByRole('button',{name:'Enable notifications',exact:true}).waitFor();
   await editor.getByRole('button',{name:'Disconnect',exact:true}).click();await editor.getByRole('button',{name:'Confirm disconnect',exact:true}).click();await editor.waitFor({state:'hidden'});
   checks.push({width,check:provider+' configure, save, clear secrets, test, enable, pause and disconnect'});
  }
  // Explicit server validation must remain visible and must not enable delivery.
  await page.getByRole('button',{name:'Set up connection',exact:true}).first().click();const editor=page.getByRole('region',{name:'Slack connection settings'});
  await editor.getByLabel(/Webhook URL/).fill('invalid');await editor.getByRole('button',{name:'Save settings',exact:true}).click();await editor.getByRole('alert').waitFor();assert(await editor.getByRole('button',{name:'Enable notifications',exact:true}).isDisabled());checks.push({width,check:'Invalid settings show an inline error'});
  await page.goto('http://127.0.0.1:5178/ai-tools');await page.getByRole('button',{name:'Paste text',exact:true}).click();
  const documentText='Thirty days written notice is required. This is a fictional training contract with no real client facts or approvals.';
  await page.getByLabel(/Document text \(required\)/).fill(documentText);await page.getByRole('button',{name:'Summarise Contract',exact:true}).click();await page.getByText('Fictional contract draft summary',{exact:true}).waitFor();checks.push({width,check:'Contract summary accepts pasted text and renders a result'});
  await page.getByRole('button',{name:'Document Q&A',exact:true}).click();await page.getByRole('button',{name:'Paste text',exact:true}).click();await page.getByLabel(/Document text \(required\)/).fill(documentText);await page.getByLabel(/Your Question/).fill('What notice is required?');
  const questionForm=page.locator('form').filter({has:page.getByLabel(/Your Question/)});await questionForm.locator('button[type=submit]').click();await page.getByText('Thirty days written notice is required.',{exact:true}).first().waitFor();
  await page.screenshot({path:path.join(out,`document-qa-${width}.png`)});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks.push({width,check:'Document Q&A accepts pasted text and renders its answer'});
  await context.close();
 }
 const offline=await browser.newContext({viewport:{width:390,height:1000},serviceWorkers:'block'});await offline.route('**/api/auth/refresh',r=>r.abort('namenotresolved'));const offlinePage=await offline.newPage();await offlinePage.goto('http://127.0.0.1:5178/dashboard');await offlinePage.getByRole('heading',{name:'Connection interrupted',exact:true}).waitFor();assert(await offlinePage.getByRole('button',{name:'Try again',exact:true}).isVisible());checks.push({check:'DNS failure offers session restoration retry'});await offline.close();
 const loggedOut=await browser.newContext({serviceWorkers:'block'});await loggedOut.route('**/api/auth/refresh',r=>r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{code:'UNAUTHORIZED'}})}));const loggedOutPage=await loggedOut.newPage();await loggedOutPage.goto('http://127.0.0.1:5178/dashboard');await loggedOutPage.locator('input[type=email]').waitFor();checks.push({check:'Authentication rejection still requires sign-in'});await loggedOut.close();
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'browser.json'),JSON.stringify({passed:true,checks,errors,providerTraffic:'All connector and auth requests were isolated fixture responses; no messages sent'},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}finally{await browser.close();}
