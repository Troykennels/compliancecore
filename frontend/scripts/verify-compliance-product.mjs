import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const live=process.env.COMPLIANCE_LIVE==='1';const base=live?'https://compliancecore-sand.vercel.app':'http://127.0.0.1:5179';
const fixture=live?null:JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA,'OrionSoft/compliance-workflow-20261026/compliance-access.private.json'),'utf8'));
const access=live?JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA,'OrionSoft/ComplianceCore-Demo-Access.private.json'),'utf8')):fixture.owner;
const out=path.resolve('../verification/compliance-product-20261026');await fs.mkdir(out,{recursive:true});
const routes=['/dashboard','/frameworks','/risks','/policies','/policy-templates','/controls','/evidence','/tasks','/approvals','/signatures','/audits','/vendors','/incidents','/training','/expiry','/calendar','/reports','/analytics','/compliance-score','/notifications','/branches','/departments','/integrations','/escalations','/ai-tools','/settings/organization','/settings/team','/settings/security','/settings/sso','/settings/api-keys','/settings/webhooks','/settings/notifications','/billing','/billing/plans','/billing/invoices','/billing/payment-methods','/guide'];
const browser=await chromium.launch({channel:'msedge',headless:true});const checks=[];
try {for(const width of [1440,390]){
 const ctx=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});const page=await ctx.newPage();page.setDefaultTimeout(120000);const navigate=url=>page.goto(url,{waitUntil:'domcontentloaded',timeout:180000});const errors=[];const serverErrors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=500&&r.url().includes('/api/'))serverErrors.push({path:new URL(r.url()).pathname,status:r.status()});});
 await navigate(base+'/login');await page.locator('input[type=email]').fill(access.email);await page.locator('input[type=password]').fill(access.password);await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard',{timeout:120000});
 for(const route of routes){await navigate(base+route);await page.getByRole('heading',{level:1}).first().waitFor();await page.waitForTimeout(500);assert.equal(new URL(page.url()).pathname,route,`Unexpected redirect for ${route}`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`Horizontal page overflow ${route} at ${width}`);assert.equal(await page.getByRole('button',{name:'Stay signed in',exact:true}).count(),0);checks.push({width,route,loaded:true});}
 await navigate(base+'/frameworks');await page.getByRole('button',{name:'Assess compliance',exact:true}).first().waitFor();assert.equal(await page.getByRole('button',{name:'Adopt',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Implement',exact:true}).count(),0);
 if(fixture)await navigate(base+'/frameworks?framework='+fixture.frameworkId);else await page.getByRole('button',{name:'Assess compliance',exact:true}).first().click();
 await page.getByLabel('Compliance scope',{exact:true}).waitFor();
 async function step(key,text){if(width===390)await page.getByLabel('Choose compliance step').selectOption(key);else await page.getByRole('navigation',{name:'Compliance assessment steps'}).getByRole('button',{name:new RegExp(text)}).click();}
 const names=width===390?await page.getByLabel('Choose compliance step').locator('option').allTextContents():await page.getByRole('navigation',{name:'Compliance assessment steps'}).getByRole('button').allTextContents();assert.ok(!names.some(x=>/gap assessment|implement a framework/i.test(x)));assert.ok(names.findIndex(x=>/Risk assessment:/i.test(x))<names.findIndex(x=>/treatment and control/i.test(x)));
 await step('risk_assessment','Risk assessment:');await page.getByLabel('Risk assessment spreadsheet',{exact:true}).waitFor();
 const bookDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download Excel workbook',exact:true}).last().click();await (await bookDownload).saveAs(path.join(out,`${live?'live':'local'}-risk-${width}.xlsx`));
 await page.screenshot({path:path.join(out,`${live?'live':'local'}-risk-${width}.png`),fullPage:true});
 await step('soa','Applicability|applicability|Profile coverage');await page.getByRole('button',{name:'Export applicability record',exact:true}).waitFor();
 const csv=page.waitForEvent('download');await page.getByRole('button',{name:'Export applicability record',exact:true}).click();await (await csv).saveAs(path.join(out,`${live?'live':'local'}-applicability-${width}.csv`));
 await navigate(base+'/policy-templates');await page.getByRole('heading',{name:'Policy templates',exact:true}).waitFor();await page.getByRole('button',{name:'Word template',exact:true}).first().waitFor();
 const word=page.waitForEvent('download');await page.getByRole('button',{name:'Word template',exact:true}).first().click();await (await word).saveAs(path.join(out,`${live?'live':'local'}-policy-${width}.docx`));
 await page.getByRole('button',{name:'Create a draft from template',exact:true}).first().click();await page.getByLabel('Choose policy template').waitFor();assert.ok((await page.locator('textarea[name=content]').inputValue()).includes('[Organisation name]'));await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.screenshot({path:path.join(out,`${live?'live':'local'}-templates-${width}.png`),fullPage:true});
 await navigate(base+'/tasks');await page.getByRole('button',{name:'New Task',exact:true}).click();await page.getByLabel('Task responsible person').waitFor();assert.equal(await page.getByPlaceholder('User UUID',{exact:true}).count(),0);await page.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.deepEqual(errors,[],'JavaScript page errors');assert.deepEqual(serverErrors,[],'API server errors');console.log(JSON.stringify({width,routesChecked:routes.length,downloads:3,workflow:true,jsErrors:0,apiServerErrors:0}));await ctx.close();
 }}finally{await browser.close();}
await fs.writeFile(path.join(out,live?'live-product-browser.json':'local-product-browser.json'),JSON.stringify({passed:true,live,routeChecks:checks,downloads:['Risk workbook','Applicability CSV','Policy DOCX'],viewports:[1440,390]},null,2));
