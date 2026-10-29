import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const access=JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA,'OrionSoft/compliance-workflow-20261026/step2-access.private.json'),'utf8'));const base='http://127.0.0.1:5179';const browser=await chromium.launch();const checks=[];
async function loggedIn(){const ctx=await browser.newContext({serviceWorkers:'block'});const page=await ctx.newPage();page.setDefaultTimeout(60000);await page.goto(base+'/login');await page.locator('input[type=email]').fill(access.roles.owner.email);await page.locator('input[type=password]').fill(access.roles.owner.password);await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard');return {ctx,page};}
try{
 for(const kind of ['late401','lateSuccess','logout']){
  console.log('Checking '+kind);const {ctx,page}=await loggedIn();try{
   await page.reload();await page.locator('main h1:visible').first().waitFor();assert.equal(new URL(page.url()).pathname,'/dashboard');checks.push(kind+': normal cookie restore works');
   let release;const gate=new Promise(r=>release=r);let received;const arrived=new Promise(r=>received=r);
   await page.route('**/api/auth/refresh',async route=>{const response=kind==='late401'?null:await route.fetch();received();await gate;try{if(response)await route.fulfill({response});else await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({success:false,message:'Delayed synthetic expiry'})});}catch{}});
   await page.evaluate(async()=>{const m=await import('/src/lib/api-client.ts');window.__oldToken=m.getAccessToken();window.__oldRefresh=m.refreshSession().then(()=>true,()=>false);});await arrived;
   if(kind==='logout'){
    await page.evaluate(async()=>{const {authApi}=await import('/src/features/auth/api/auth.api.ts');const {useAuthStore}=await import('/src/stores/auth.store.ts');await authApi.logout();useAuthStore.getState().clearAuth();});release();await page.evaluate(()=>window.__oldRefresh);await page.waitForTimeout(500);assert.equal(await page.evaluate(async()=>{const m=await import('/src/lib/api-client.ts');return m.getAccessToken()===null;}),true);await page.waitForURL('**/login');checks.push('Late refresh cannot resurrect a signed-out session');
   }else{
    const credentials=access.roles.owner;await page.evaluate(async credentials=>{const {authApi}=await import('/src/features/auth/api/auth.api.ts');const m=await import('/src/lib/api-client.ts');const r=await authApi.login(credentials);m.setAccessToken(r.data.data.accessToken);window.__newToken=m.getAccessToken();},credentials);release();await page.evaluate(()=>window.__oldRefresh);assert.equal(await page.evaluate(async()=>{const m=await import('/src/lib/api-client.ts');return m.getAccessToken()===window.__newToken;}),true);await page.unrouteAll({behavior:'wait'});await page.reload();await page.locator('main h1:visible').first().waitFor();assert.equal(new URL(page.url()).pathname,'/dashboard');checks.push(kind+': explicit sign-in survives an older refresh');
   }
   assert.equal(await page.getByRole('button',{name:'Stay signed in',exact:true}).count(),0);checks.push(kind+': no stay-signed-in prompt');
  }finally{await ctx.close();}
 }
 await fs.writeFile('../verification/compliance-step2-20261026/auth-race-browser.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}finally{await browser.close();}
