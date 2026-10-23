import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.DEMO_BROWSER_URL||'http://127.0.0.1:5178';
const live=base.startsWith('https:');
const access=JSON.parse(await fs.readFile(live?path.join(process.env.LOCALAPPDATA,'OrionSoft','ComplianceCore-Demo-Access.private.json'):path.join(os.tmpdir(),'compliance-presentation-20261023','demo-access-local.json'),'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const pages=process.env.DEMO_BROWSER_ROUTES?.split(',')||['dashboard','compliance-score','calendar','expiry','frameworks','controls','policies','risks','incidents','vendors','evidence','branches','departments','audits','training','tasks','approvals','signatures','escalations','ai-tools','reports','analytics','integrations','notifications','billing','billing/plans','billing/invoices','billing/payment-methods','settings/organization','settings/team','settings/security','settings/sso','settings/api-keys','settings/webhooks','settings/notifications'];
const results=[],errors=[];
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:960},serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(60000);
  page.on('pageerror',e=>errors.push({width,type:'runtime',message:e.message}));
  page.on('response',r=>{if(r.status()>=500)errors.push({width,type:'http',status:r.status(),path:new URL(r.url()).pathname})});
  await page.goto(base+'/login');await page.locator('input[type=email]').fill(access.email);await page.locator('input[type=password]').fill(access.password);await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard',{timeout:90000});
  for(const route of pages){
   await page.goto(base+'/'+route);await page.locator('#main-content').waitFor();await page.waitForTimeout(live?1300:2000);
   const text=await page.locator('body').innerText();
   const failed=/Something went wrong|Failed to load|could not load|Application error|Unexpected Application Error/i.test(text);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
   results.push({width,route,passed:!failed&&!overflow});
   if(failed||overflow)errors.push({width,route,type:failed?'page-error':'overflow',snippet:failed?text.slice(-650):undefined});
   if(['dashboard','billing/plans','reports','settings/notifications'].includes(route)){await fs.mkdir('artifacts/presentation-20261023',{recursive:true});await page.screenshot({path:`artifacts/presentation-20261023/${width}-${route.replaceAll('/','-')}.png`,fullPage:false});}
   console.log(JSON.stringify(results.at(-1)));
   if(route==='billing/plans'){
    await page.getByRole('button',{name:'Review payment',exact:true}).first().click();await page.getByText('Illustrative first-payment quote.',{exact:false}).waitFor();
    assert.match(await page.locator('#payment-summary').innerText(),/1,540,000/);assert.equal(await page.getByRole('button',{name:'Demo quote — payment disabled',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:/Yearly/}).click();await page.getByRole('button',{name:'Review payment',exact:true}).first().click();await page.getByText('Illustrative first-payment quote.',{exact:false}).waitFor();assert.match(await page.locator('#payment-summary').innerText(),/1,900,000/);
    results.push({width,route:'demo-monthly-annual-quote-no-payment',passed:true});
   }
  }
  // The opt-in chime must be enabled directly from a user click and persist.
  if(pages.at(-1)!=='settings/notifications'){await page.goto(base+'/settings/notifications');await page.getByRole('button',{name:'Enable & test in-app sound',exact:true}).waitFor();}
  await page.getByRole('button',{name:'Enable & test in-app sound',exact:true}).click();await page.getByRole('button',{name:'Turn off in-app sound',exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'Turn off in-app sound',exact:true}).waitFor();
  await page.getByRole('button',{name:'Turn off in-app sound',exact:true}).click();
  results.push({width,route:'sound-opt-in-persistence',passed:true});
  await context.close();
 }
}catch(e){errors.push({type:'assertion',message:e.message});}
finally{await browser.close();await fs.mkdir('artifacts/presentation-20261023',{recursive:true});await fs.writeFile(`artifacts/presentation-20261023/${process.env.DEMO_BROWSER_ROUTES?'focused-':''}${live?'live-':''}browser-results.json`,JSON.stringify({results,errors},null,2));}
console.log(JSON.stringify({checks:results.length,errors}));assert.equal(errors.length,0);
