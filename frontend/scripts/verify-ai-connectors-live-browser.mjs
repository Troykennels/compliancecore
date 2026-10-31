// Live read-only UI acceptance: never save credentials or send connector tests.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=path.resolve('../verification/ai-connectors-20261031');await fs.mkdir(out,{recursive:true});
const access=JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA,'OrionSoft/ComplianceCore-Demo-Access.private.json'),'utf8'));
const base='https://compliancecore-sand.vercel.app';const browser=await chromium.launch();const checks=[],errors=[],blockedWrites=[];
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/api/**',route=>{const r=route.request();if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!new URL(r.url()).pathname.startsWith('/api/auth/')){blockedWrites.push(new URL(r.url()).pathname);return route.abort();}return route.continue();});
  await page.goto(base+'/login');await page.locator('input[type=email]').fill(access.email);await page.locator('input[type=password]').fill(access.password);await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard');await page.locator('.cc-app').waitFor();
  await page.goto(base+'/integrations');await page.getByRole('heading',{name:'Notification connections',exact:true}).waitFor();assert.equal(await page.getByText('Coming soon',{exact:true}).count(),3);
  for(const [provider,name]of [['slack','Slack'],['teams','Microsoft Teams'],['email','Email / SMTP']]){
   const card=page.locator('article').filter({has:page.getByRole('heading',{name,exact:true})});await card.getByRole('button').click();
   const editor=page.getByRole('region',{name:name+' connection settings'});await editor.waitFor();await editor.getByRole('heading',{name:name+' connection',exact:true}).scrollIntoViewIfNeeded();
   assert.equal(await editor.locator('input[type=password]').first().inputValue(),'');assert(await editor.getByRole('button',{name:'Send connection test',exact:true}).isDisabled());
   await page.screenshot({path:path.join(out,`live-${provider}-${width}.png`)});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await editor.getByRole('button',{name:'Close connection settings',exact:true}).click();checks.push({width,check:name+' setup loads with no stored credentials and no message sent'});
  }
  await page.goto(base+'/ai-tools');await page.getByRole('button',{name:'Paste text',exact:true}).click();await page.getByLabel(/Document text \(required\)/).fill('Fictional training contract text for a read-only interface check. No real client information or approval is included.');
  assert(await page.getByText('Draft assistance · Human review required',{exact:true}).isVisible());await page.screenshot({path:path.join(out,`live-ai-${width}.png`)});checks.push({width,check:'Live AI tools expose pasted-text mode and human review guidance'});
  for(let i=0;i<3;i++){await page.reload({waitUntil:'domcontentloaded'});await page.locator('.cc-app').waitFor();assert.equal(new URL(page.url()).pathname,'/ai-tools');}
  checks.push({width,check:'Session retained across three full page reloads'});await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blockedWrites,[]);await fs.writeFile(path.join(out,'live-browser.json'),JSON.stringify({passed:true,checks,errors,blockedWrites,managedDemoOnly:true,externalConnectorMessagesSent:false,customerBusinessRecordWrites:false},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,reloads:6}));
}finally{await browser.close();}
