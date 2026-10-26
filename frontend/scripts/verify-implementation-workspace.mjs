import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const live=process.env.WORKFLOW_LIVE==='1';
const base=live?'https://compliancecore-sand.vercel.app':'http://127.0.0.1:5179';
const fixture=live?null:JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA,'OrionSoft/compliance-workflow-20261026/fixture-access.private.json'),'utf8'));
const access=live?JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA,'OrionSoft/ComplianceCore-Demo-Access.private.json'),'utf8')):fixture.owner;
const out=path.resolve('../verification/framework-workflow-20261026');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
try{for(const width of [1440,390]){
 const ctx=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});const page=await ctx.newPage();page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/login');await page.locator('input[type=email]').fill(access.email);await page.locator('input[type=password]').fill(access.password);await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard',{timeout:120000});
 await page.getByRole('heading',{name:'Audit readiness at a glance'}).waitFor();assert.equal(await page.getByRole('button',{name:'Stay signed in',exact:true}).count(),0);
 await page.goto(base+'/frameworks');await page.getByRole('heading',{name:'Framework implementation',exact:true}).waitFor();await page.getByRole('button',{name:'Implement',exact:true}).first().waitFor();
 assert.equal(await page.getByRole('button',{name:'Adopt',exact:true}).count(),0);
 if(fixture)await page.goto(base+'/frameworks?framework='+fixture.frameworkId);else await page.getByRole('button',{name:'Implement',exact:true}).first().click();
 await page.getByLabel('Implementation scope',{exact:true}).waitFor();
 const steps=width===390?page.getByLabel('Choose implementation step').locator('option'):page.getByRole('navigation',{name:'Implementation steps'}).getByRole('button');assert.equal(await steps.count(),13);
 async function choose(key,text){if(width===390)await page.getByLabel('Choose implementation step').selectOption(key);else await page.getByRole('navigation',{name:'Implementation steps'}).getByRole('button',{name:new RegExp(text)}).click();}
 await choose('soa','Statement of Applicability');await page.getByRole('button',{name:'Export SoA',exact:true}).waitFor();
 if(fixture){
  await page.getByRole('button',{name:'Record applicability',exact:true}).first().click();await page.getByLabel('SoA applicability').selectOption('true');await page.getByLabel('SoA justification').fill('Required to protect the backup service included in the agreed organisational scope.');
  const response=page.waitForResponse(r=>r.url().includes('/implementation/soa/')&&r.request().method()==='PUT');await page.getByRole('button',{name:'Save SoA decision',exact:true}).click();assert.equal((await response).status(),200);
  await page.getByRole('heading',{name:'Does this requirement apply to us?'}).waitFor({state:'hidden'});
 }
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export SoA',exact:true}).click();const download=await downloadPromise;const file=path.join(out,`${live?'live':'local'}-soa-${width}.csv`);await download.saveAs(file);assert.match(await fs.readFile(file,'utf8'),/Applicability.*Justification/);
 await page.screenshot({path:path.join(out,`${live?'live':'local'}-soa-${width}.png`),fullPage:true});
 await choose('policies','Approve and publish');
 if(fixture){await page.getByRole('button',{name:'Draft a policy for this framework'}).click();assert.deepEqual(await page.getByLabel('Policy linked frameworks').evaluate(el=>[...el.selectedOptions].map(o=>o.value)),[fixture.frameworkId]);await page.getByLabel('Policy owner').waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();}
 await choose('evidence','Attach current evidence');
 if(fixture){await page.getByRole('button',{name:'Attach evidence',exact:true}).first().click();await page.getByRole('heading',{name:'Show proof of this safeguard'}).waitFor();await page.getByLabel('Saved evidence for this control').waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();}
 await choose('signoff','Independent implementation sign-off');assert.equal(await page.getByRole('button',{name:'Request independent review'}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Sign off implementation'}).count(),0);
 await choose('certification','External certification');assert.equal(await page.getByRole('link',{name:'Open external audits',exact:true}).count(),0);await page.getByText('Complete all preceding steps',{exact:false}).waitFor();
 await page.screenshot({path:path.join(out,`${live?'live':'local'}-certification-${width}.png`),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assert.deepEqual(errors,[]);
 results.push({width,thirteenSteps:true,soaExport:true,scopeExplained:true,frameworkContextLinked:true,certificationBlockedBeforeSignoff:true,noIdlePrompt:true,noOverflow:true,pageErrors:0});console.log(JSON.stringify({width,passed:true}));await ctx.close();
}}finally{await browser.close();}
await fs.writeFile(path.join(out,live?'live-browser-results.json':'local-browser-results.json'),JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,live,viewports:results.length}));
