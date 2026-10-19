import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const html = path.join(root, 'signup-verification.html'), entry = path.join(root, 'signup-verification.jsx');
await fs.writeFile(html, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/signup-verification.jsx"></script></body></html>');
await fs.writeFile(entry, "import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{Toaster}from'sonner';import{SignupDirectory}from'./src/features/billing/components/signup-directory.tsx';import'./src/styles/globals.css';const client=new QueryClient({defaultOptions:{queries:{retry:false}}});createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><main style={{padding:20,maxWidth:1200,margin:'auto'}}><SignupDirectory/></main><Toaster/></QueryClientProvider>);");
const server = await createServer({ root, server: { host:'127.0.0.1',port:5187,strictPort:true }, logLevel:'error' }); await server.listen();
const browser = await chromium.launch({channel:'msedge',headless:true});const results=[];
await fs.mkdir(path.join(root,'artifacts/signup-directory'),{recursive:true});
try {
 for (const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  let followup={status:'new',notes:'',followUpOn:null,updatedAt:null}, writes=0;
  const person={id:'11111111-1111-4111-8111-111111111111',name:'Fixture Prospect',email:'prospect@example.invalid',joinedAt:'2026-09-17T22:19:05Z',emailVerifiedAt:'2026-09-17T22:19:30Z',onboardingCompletedAt:'2026-09-17T22:20:00Z',isActive:true,lastSignInAt:null,lastActivityAt:null,evidence:{category:'unclassified',explanation:'No recorded test provenance.'},organisations:[{id:'22222222-2222-4222-8222-222222222222',name:'Fixture Company',role:'owner',createdAt:'2026-09-17T22:20:00Z',joinedAt:'2026-09-17T22:20:00Z',phone:null,country:null,industry:null,plan:'Professional',subscriptionStatus:'trial',trialEndsAt:'2026-10-01T22:20:00Z',paidThrough:'2026-10-01T22:20:00Z'}]};
  await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:5187'?route.continue():route.abort());
  await context.route('**/api/billing/admin/signups**',async route=>{
   const request=route.request();if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:5187','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type'}});
   if(request.method()==='PATCH'){writes++;await new Promise(resolve=>setTimeout(resolve,400));followup={...request.postDataJSON(),updatedAt:new Date().toISOString()};return route.fulfill({json:{success:true,data:{saved:true}},headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:5187','Access-Control-Allow-Credentials':'true'}});}
   const params=new URL(request.url()).searchParams;const empty=params.get('stage')==='unverified'||params.get('search')==='missing';
   return route.fulfill({json:{success:true,data:{records:empty?[]:[{...person,followup}],total:empty?0:1,page:1,pageSize:50,summary:{unverified:0,activeTrials:0,expiredTrials:empty?0:1,followupsDue:0}}},headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:5187','Access-Control-Allow-Credentials':'true'}});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:5187/signup-verification.html');
  await page.getByRole('heading',{name:'Fixture Prospect',exact:true}).waitFor();await page.getByText('Trial ended',{exact:true}).waitFor();
  await page.getByLabel('Registration stage').selectOption('unverified');await page.getByText('No registrations match these filters',{exact:true}).waitFor();await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.getByRole('heading',{name:'Fixture Prospect',exact:true}).waitFor();
  await page.getByRole('button',{name:'Manage follow-up',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByLabel('Follow-up status',{exact:true}).selectOption('contacted');await page.getByLabel('Private owner notes').fill('Fixture follow-up recorded.');await page.getByLabel('Follow-up date').fill('2026-12-01');await page.getByRole('button',{name:'Save follow-up',exact:true}).click();await page.getByRole('button',{name:/Saving/}).waitFor();await page.getByText('Fixture follow-up recorded.',{exact:true}).waitFor();assert.equal(writes,1);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export filtered CSV',exact:true}).click();const download=await downloadPromise;const file=await download.path();const csv=await fs.readFile(file,'utf8');assert(csv.includes('prospect@example.invalid'));assert(csv.includes('Fixture follow-up recorded.'));assert(!csv.includes('password'));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(root,`artifacts/signup-directory/owner-${width}.png`),fullPage:true});results.push({width,passed:true,followupSaved:true,exportVerified:true,noOverflow:true,noRuntimeErrors:true});await context.close();
 }
 console.log(JSON.stringify(results));
}finally{await fs.writeFile(path.join(root,'artifacts/signup-directory/results.json'),JSON.stringify(results,null,2));await browser.close();await server.close();await fs.unlink(html);await fs.unlink(entry);}
