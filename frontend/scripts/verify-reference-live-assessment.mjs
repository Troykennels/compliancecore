import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const privateRoot=path.join(process.env.LOCALAPPDATA,'OrionSoft');
const access=JSON.parse(await fs.readFile(path.join(privateRoot,'ComplianceCore-Demo-Access.private.json'),'utf8'));
const contextData=JSON.parse(await fs.readFile(path.join(privateRoot,'ComplianceCore-private-20261023/concept-release-20261031/live-demo-context.private.json'),'utf8'));
const base='https://compliancecore-sand.vercel.app',api='https://compliancecore-api-production.up.railway.app';
const out=path.resolve('../verification/reference-20261031');await fs.mkdir(out,{recursive:true});
const routes=['/frameworks','/risks','/policies','/evidence','/approvals'];
const browser=await chromium.launch({channel:"msedge"});const checks=[],pages=[],errors=[],serverErrors=[],blockedWrites=[],authTrace=[],failedRequests=[],cookieBlocks=[];let current='',page;
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  await context.route(api+'/**',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD','OPTIONS'].includes(request.method())&&!['/api/auth/login','/api/auth/refresh','/api/auth/logout'].includes(url.pathname)){blockedWrites.push({method:request.method(),route:url.pathname});return route.abort();}return route.continue();});
  page=await context.newPage();page.setDefaultTimeout(60000);
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  cdp.on('Network.responseReceivedExtraInfo',event=>{for(const cookie of event.blockedCookies||[])cookieBlocks.push({width,route:current,reasons:cookie.blockedReasons,source:'response'});});
  cdp.on('Network.requestWillBeSentExtraInfo',event=>{for(const item of event.associatedCookies||[])if(item.blockedReasons?.length)cookieBlocks.push({width,route:current,name:item.cookie?.name,reasons:item.blockedReasons,source:'request'});});
  page.on('pageerror',error=>errors.push({width,route:current,message:error.message}));
  page.on('response',response=>{if(response.url().startsWith(api)&&response.status()>=500)serverErrors.push({width,route:current,path:new URL(response.url()).pathname,status:response.status()});});
  page.on('response',async response=>{if(response.url().startsWith(api+'/api/auth/')){const item={width,route:current,path:new URL(response.url()).pathname,status:response.status(),at:new Date().toISOString()};if(response.status()>=400){try{item.code=(await response.json()).error?.code;}catch{}}authTrace.push(item);}});
  page.on('requestfailed',request=>{if(request.url().startsWith(api))failedRequests.push({width,route:current,path:new URL(request.url()).pathname,error:request.failure()?.errorText,at:new Date().toISOString()});});
  current='/login';await page.goto(base+'/login',{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(access.email);await page.locator('input[type=password]').fill(access.password);await page.locator('button[type=submit]').click();await page.waitForURL('**/dashboard');await page.locator('main h1').waitFor();await page.locator('.cc-app').waitFor();
  for(const route of routes){
   current=route;await page.goto(base+route,{waitUntil:'domcontentloaded'});await page.locator('main h1:visible').first().waitFor();await page.waitForLoadState('networkidle');
   const inventory=await page.locator('main').evaluate(main=>({title:main.querySelector('h1')?.textContent,headings:[...main.querySelectorAll('h1')].filter(el=>el.getBoundingClientRect().height).length,overflow:main.scrollWidth>main.clientWidth+2||document.documentElement.scrollWidth>innerWidth+2,unlabelled:[...main.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(el=>el.getBoundingClientRect().height&&!el.labels?.length&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')).map(el=>el.name||el.tagName)}));
   assert.equal(inventory.headings,1,route+' heading');assert.equal(inventory.overflow,false,route+' overflow');assert.deepEqual(inventory.unlabelled,[],route+' labels');
   const name=route===`/audits/${contextData.auditId}`?'audit-room':route===`/evidence/${contextData.evidenceId}`?'evidence-detail':route.slice(1).replaceAll('/','-');
   const screenshot=`live-${name}-${width}.png`;await page.screenshot({path:path.join(out,screenshot)});pages.push({route,width,...inventory,screenshot});console.log(width,route,'passed');
  }
  current='journey phases';await page.goto(base+`/journey?framework=${contextData.frameworkId}`);const phases=page.getByRole('navigation',{name:'Compliance journey phases'});await phases.waitFor();assert.equal(await phases.getByRole('button').count(),5);
  for(let index=0;index<5;index++){const button=phases.getByRole('button').nth(index);const title=await button.locator('strong').innerText();await button.click();const phase=new URL(page.url()).searchParams.get('phase');await page.getByRole('heading',{name:title,exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:title,exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('phase'),phase);checks.push({width,check:'Compliance phase selection survives reload',phase});}
  current='scope preview';await page.goto(base+`/frameworks?framework=${contextData.frameworkId}&step=scope`);await page.getByRole('heading',{name:'Scope preview',exact:true}).waitFor();const scope=page.getByRole('textbox',{name:'Compliance scope',exact:true}),original=await scope.inputValue();await scope.fill(original+' Preview check only.');assert.match(await page.locator('.cc-live-preview').first().innerText(),/Preview check only/);await scope.fill(original);await scope.blur();await page.locator('main').evaluate(main=>main.scrollTop=0);await page.screenshot({path:path.join(out,`live-assessment-scope-${width}.png`)});await page.reload();await scope.waitFor();assert.equal(await scope.inputValue(),original);checks.push({width,check:'Live scope preview and saved scope remain separate'});
  const cookies=await context.cookies(api+'/api/auth/refresh');assert(cookies.some(cookie=>cookie.httpOnly&&cookie.secure));checks.push({width,check:'Secure session survives repeated navigation and reload'});
  if(width===1440){assert.match(await page.locator('aside.cc-sidebar:visible').evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient/);assert(await page.getByRole('navigation',{name:'Breadcrumb'}).isVisible());}else{await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('dialog',{name:'Navigation',exact:true}).waitFor();await page.getByRole('button',{name:'Close navigation',exact:true}).click();await page.getByRole('dialog',{name:'Navigation',exact:true}).waitFor({state:'hidden'});}checks.push({width,check:'Reference design navigation is available'});
  await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(serverErrors,[]);assert.deepEqual(blockedWrites,[]);
 await fs.writeFile(path.join(out,'live-browser-checks.json'),JSON.stringify({passed:true,pages,checks,errors,serverErrors,blockedWrites,authTrace,failedRequests,cookieBlocks,managedDemoOnly:true,customerRecordWrites:false},null,2));
 const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 await fs.writeFile(path.join(out,'gallery.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ComplianceCore live release review</title><style>body{font:14px system-ui;color:#173651;background:#f2f7fb;margin:0}header{background:#0b263e;color:white;padding:28px 5vw}main{padding:24px 5vw;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,430px),1fr));gap:20px}article{border:1px solid #d5e1eb;border-radius:8px;background:white;overflow:hidden}h2{font-size:14px;padding:12px;margin:0}img{display:block;width:100%;height:400px;object-fit:contain;object-position:top;background:#f8fbfd}</style><header><h1>ComplianceCore · live release</h1><p>31 October 2026 · ${pages.length} page layouts and ${checks.length} interaction checks · managed demonstration data only</p></header><main>${pages.map(result=>`<article><h2>${escape(result.title)} · ${result.width}px</h2><a href="${result.screenshot}"><img loading="lazy" src="${result.screenshot}" alt="${escape(result.title)}"></a></article>`).join('')}</main></html>`);
 console.log(JSON.stringify({passed:true,pages:pages.length,interactionChecks:checks.length,errors:0}));
}catch(error){await page?.screenshot({path:path.join(out,'live-browser-failure.png')}).catch(()=>{});await fs.writeFile(path.join(out,'live-browser-failure.json'),JSON.stringify({current,url:page?.url(),message:error.message,pages:pages.length,errors,serverErrors,blockedWrites,authTrace,failedRequests,cookieBlocks},null,2));throw error;}
finally{await browser.close();}
