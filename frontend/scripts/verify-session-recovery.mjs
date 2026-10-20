import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const html='.session-recovery-test.html',entry='.session-recovery-test.tsx';
const org={id:'22222222-2222-4222-8222-222222222222',name:'Fixture Organisation',slug:'fixture',role:'owner'};
const user={id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.invalid',firstName:'Fixture',lastName:'Owner',avatarUrl:null,emailVerifiedAt:new Date().toISOString(),isActive:true,onboardingCompletedAt:null};
await fs.writeFile(html,'<html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/'+entry+'"></script></html>');
await fs.writeFile(entry,`import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import{QueryClientProvider}from'@tanstack/react-query';import{queryClient}from'./src/lib/query-client';import{Toaster}from'sonner';import{useAuthStore}from'./src/stores/auth.store';import{OnboardingPage}from'./src/features/organizations/pages/onboarding.page';import'./src/styles/globals.css';useAuthStore.getState().setAuth(${JSON.stringify(user)},'pre-onboarding-token',null,[]);createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><MemoryRouter><OnboardingPage/><Toaster/></MemoryRouter></QueryClientProvider></React.StrictMode>);`);
process.env.VITE_API_URL='http://127.0.0.1:5188';
const server=await createServer({server:{host:'127.0.0.1',port:5188,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
try{
for(const scenario of ['new-organisation','legacy-retry','parallel-refresh','bounded-401-retry']){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('Runtime: '+e.message);});let refreshes=0,creates=0,switches=0,meCalls=0,protectedCalls=0;
 const ok=(route,data)=>route.fulfill({json:{data,error:null,meta:{}}});
 await context.route('**/api/**',async route=>{
  const u=new URL(route.request().url()),p=u.pathname;if(!p.startsWith('/api/'))return route.continue();
  if(p==='/api/auth/refresh'){refreshes++;if(scenario==='parallel-refresh'||scenario==='bounded-401-retry'){await new Promise(r=>setTimeout(r,150));return ok(route,{accessToken:'refreshed-token'});}return route.fulfill({status:401,json:{error:{code:'UNAUTHORIZED',message:'Refresh token is invalid or expired'},data:null,meta:{}}});}
  if(p==='/api/organizations'){creates++;if(scenario==='legacy-retry')return route.fulfill({status:409,json:{data:null,error:{code:'ALREADY_ONBOARDED',message:'Already onboarded'},meta:{}}});return ok(route,{organization:org});}
  if(p==='/api/auth/switch-tenant'){switches++;assert.equal(route.request().postDataJSON().tenantId,org.id);assert.equal(route.request().headers().authorization,'Bearer pre-onboarding-token');return ok(route,{accessToken:'tenant-token',activeTenant:org});}
  if(p==='/api/auth/me'){meCalls++;if(scenario!=='legacy-retry'||meCalls>1)assert.equal(route.request().headers().authorization,'Bearer tenant-token');return ok(route,{...user,onboardingCompletedAt:new Date().toISOString(),tenants:[org]});}
  if(p==='/api/protected-fixture'){protectedCalls++;return route.fulfill({status:401,json:{data:null,error:{code:'UNAUTHORIZED',message:'Expired access token'},meta:{}}});}
  if(p==='/api/organizations/scoping')return ok(route,{profile:null,recommendations:[]});
  return ok(route,{});
 });
 console.log('Starting '+scenario);await page.goto('http://127.0.0.1:5188/'+html);console.log('Loaded '+scenario);page.on('console',m=>{if(m.type()==='error')console.log('Browser error: '+m.text().slice(0,180));});
 await page.getByRole('button',{name:'Create organization',exact:true}).waitFor().catch(async e=>{console.log('Page body: '+(await page.locator('body').innerText()).slice(0,1200));throw e;});
 if(scenario==='parallel-refresh'){
  const tokens=await page.evaluate(async()=>{const {authApi}=await import('/src/features/auth/api/auth.api.ts');const {refreshSession,getAccessToken}=await import('/src/lib/api-client.ts');const r=await Promise.all([authApi.refresh(),authApi.refresh(),refreshSession()]);return {returned:r.map(x=>x.data.data.accessToken),current:getAccessToken()};});
  assert.equal(refreshes,1);assert.deepEqual(tokens,{returned:Array(3).fill('refreshed-token'),current:'refreshed-token'});
 }else if(scenario==='bounded-401-retry'){
  // Both queued callers retry once, even if the server rejects the new token.
  await page.evaluate(async()=>{const {apiClient}=await import('/src/lib/api-client.ts');await Promise.allSettled([apiClient.get('/protected-fixture'),apiClient.get('/protected-fixture')]);});
  assert.equal(refreshes,1);assert.equal(protectedCalls,4);
 }else{
  await page.getByPlaceholder('Acme Corporation').fill(org.name);await page.getByRole('button',{name:'Create organization',exact:true}).click();
  await page.getByText('Step 2 of 2',{exact:true}).waitFor();assert.equal(refreshes,0,'Successful onboarding must not depend on a refresh cookie');assert.equal(creates,1);assert.equal(switches,1);assert.equal(await page.locator('body').innerText().then(t=>t.includes('Refresh token is invalid or expired')),false);
  const state=await page.evaluate(async()=>{const {useAuthStore}=await import('/src/stores/auth.store.ts');const s=useAuthStore.getState();return {tenant:s.activeTenant?.id,authenticated:s.isAuthenticated,completed:!!s.user?.onboardingCompletedAt};});assert.deepEqual(state,{tenant:org.id,authenticated:true,completed:true});
 }
 assert.deepEqual(errors,[]);results.push({scenario,passed:true,refreshes,creates,switches});console.log(JSON.stringify(results.at(-1)));await context.close();
}
}finally{await browser.close();await server.close();await fs.unlink(html);await fs.unlink(entry);}
