import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5173';
const live=base.startsWith('https:');
const out=fileURLToPath(new URL('../../verification/dashboard-simplicity-20261026/',import.meta.url));
await fs.mkdir(out,{recursive:true});
const access=JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA,'OrionSoft/ComplianceCore-Demo-Access.private.json'),'utf8'));
const browser=await chromium.launch();const checks=[],errors=[],failures=[];
try {
 for(const width of [1440,390]) {
  const ctx=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});const page=await ctx.newPage();page.setDefaultTimeout(60000);
  // Only the local preview uses a test-harness CORS bridge. Production checks
  // use the real deployed origin and unmodified API responses.
  if(!live)await ctx.route('https://compliancecore-api-production.up.railway.app/api/**',async route=>{
   const headers={'access-control-allow-origin':base,'access-control-allow-credentials':'true','access-control-allow-headers':'Content-Type, Authorization, X-Request-ID','access-control-allow-methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   try {const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),...headers}});} catch {await route.abort().catch(()=>{});}
  });
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=500)failures.push({path:new URL(r.url()).pathname,status:r.status()});});
  try {
   await page.goto(base+'/login');await page.locator('input[type=email]').fill(access.email);await page.locator('input[type=password]').fill(access.password);const dashboardResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/dashboard'&&r.request().method()==='GET');await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard');const recorded=(await (await dashboardResponse).json()).data.controls;
   await page.getByRole('heading',{name:'Compliance overview',exact:true}).waitFor();await page.getByRole('list',{name:'Control status breakdown'}).waitFor();await page.getByText('Corrections to check',{exact:true}).waitFor();await page.getByRole('link',{name:'See all 5 assessments',exact:true}).waitFor();
   const totals=page.getByRole('region',{name:'Control status totals'});assert.equal(await totals.locator('a').count(),5);assert.equal(await page.locator('#overview-detail').count(),0);
   for(const [title,n]of [['Total controls',recorded.total],['Operating',recorded.implemented],['Partly operating',recorded.partiallyImplemented],['Needs work',recorded.planned+recorded.notImplemented],['Not applicable',recorded.notApplicable]])assert.equal(await totals.getByRole('link').filter({has:page.getByText(title,{exact:true})}).locator('p').first().textContent(),String(n));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
   await page.screenshot({path:path.join(out,`${live?'live':'local'}-dashboard-${width}.png`),fullPage:true});checks.push({width,check:'Colourful summary, real control totals and next assessment steps'});
   await page.getByRole('button',{name:'Dates, activity and score history'}).click();await page.getByRole('heading',{name:'Recorded score history',exact:true}).waitFor();await page.getByRole('button',{name:'Dates, activity and score history'}).click();assert.equal(await page.locator('#overview-detail').count(),0);checks.push({width,check:'Optional history expands and collapses'});
   if(width<1024)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
   const nav=page.getByRole('navigation',{name:'Main',exact:true}).filter({visible:true});
   const reports=nav.getByRole('button',{name:'Reports and dates',exact:true});assert.equal(await reports.getAttribute('aria-expanded'),'false');await reports.click();await nav.getByRole('link',{name:'Executive Dashboard',exact:true}).click();await page.waitForURL('**/reports');await page.locator('main h1:visible').first().waitFor();
   if(width<1024)assert.equal(await page.getByRole('button',{name:'Close navigation',exact:true}).count(),0);
   checks.push({width,check:'Grouped navigation opens report and dismisses phone drawer'});
   await page.goto(base+'/dashboard');await page.getByRole('heading',{name:'Compliance overview',exact:true}).waitFor();checks.push({width,check:'Reload retains sign-in'});
  } catch(e){await page.screenshot({path:path.join(out,`${live?'live':'local'}-failure-${width}.png`),fullPage:true});throw e;} finally {await ctx.unrouteAll({behavior:'ignoreErrors'});await ctx.close();}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);await fs.writeFile(path.join(out,`${live?'live':'local'}-browser-results.json`),JSON.stringify({passed:true,base,checks,pageErrors:errors,serverErrors:failures},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,viewports:[1440,390]}));
} catch(error){console.error('Dashboard check failed: '+String(error.message).split('\n')[0]);process.exitCode=1;} finally {await browser.close();}
