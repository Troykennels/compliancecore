import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const access=JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA,'OrionSoft','ComplianceCore-Demo-Access.private.json'),'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
const output=path.resolve('../verification/ci-presentation-20261024');
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:960},serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(60000);
 await page.goto('https://compliancecore-sand.vercel.app/login');await page.locator('input[type=email]').fill(access.email);await page.locator('input[type=password]').fill(access.password);await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard',{timeout:90000});
 const guide=page.locator('details').filter({hasText:'C&I Leasing Plc presentation'});await guide.locator('summary').click();
 for(const [name,href]of [['Review sample renewals','/expiry'],['Explore contractor assurance','/vendors'],['Review sample learning','/training'],['Open the tabletop example','/incidents']])assert.equal(await guide.getByRole('link',{name,exact:true}).getAttribute('href'),href);
 assert.match(await guide.innerText(),/Fictional scenarios/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await guide.screenshot({path:path.join(output,`ci-guide-${width}.png`)});
 await guide.getByRole('link',{name:'Review sample renewals',exact:true}).click();await page.waitForURL('**/expiry');await page.locator('#main-content').waitFor();
 results.push({width,expandedGuide:true,fourModuleLinksCorrect:true,fictionalDataNotice:true,noHorizontalOverflow:true,fleetLinkNavigates:true});await context.close();
}}finally{await browser.close();}
await fs.writeFile(path.join(output,'ci-guide-browser-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({passed:true,viewports:results.length,interactiveGuideVerified:true}));
