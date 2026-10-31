import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:5178', out = '../verification/reference-20261031';
const access = JSON.parse(await fs.readFile(path.join(os.tmpdir(), 'compliance-presentation-20261023/ux-access.private.json'), 'utf8'));
const checks = [], errors = [];
const loginResponse = await fetch('http://127.0.0.1:3008/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(access.roles.owner) });
assert.equal(loginResponse.status, 200);
const token = (await loginResponse.json()).data.accessToken;
const controls = await fetch('http://127.0.0.1:3008/api/controls?limit=1', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
const control = controls.data.controls[0];
const browser = await chromium.launch({channel:"msedge"});
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => errors.push({ width, message: error.message }));
    await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type=email]').fill(access.roles.owner.email);
    await page.locator('input[type=password]').fill(access.roles.owner.password);
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/dashboard', {waitUntil:'domcontentloaded'});
    await page.goto(base + '/journey');
    const phases=page.getByRole('navigation',{name:'Compliance journey phases'});
    await phases.waitFor();
    assert.equal(await phases.getByRole('button').count(),5);
    for(let index=0;index<5;index++){
      const button=phases.getByRole('button').nth(index);
      const title=await button.locator('strong').innerText();
      await button.click();
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
      const phase=new URL(page.url()).searchParams.get('phase');
      await page.reload();
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('phase'),phase);
      checks.push({width,check:'Compliance phase opens its recorded steps and survives reload',phase});
    }
    await page.screenshot({path:path.join(out,`journey-phase-review-${width}.png`)});
    if(width===1440){
      assert.match(await page.locator('aside.cc-sidebar:visible').evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient/);
      assert.equal(await page.getByRole('navigation',{name:'Breadcrumb'}).isVisible(),true);
    }else{
      await page.getByRole('button',{name:'Open navigation',exact:true}).click();
      await page.getByRole('dialog',{name:'Navigation',exact:true}).waitFor();
      await page.getByRole('button',{name:'Close navigation',exact:true}).click();
      await page.getByRole('dialog',{name:'Navigation',exact:true}).waitFor({state:'hidden'});
    }
    checks.push({width,check:'Navy navigation and responsive access remain usable'});
    await page.getByRole('link', { name: /Your next action/ }).click();
    await page.waitForURL(url => url.searchParams.get('step') === 'scope');
    await page.getByRole('heading',{name:'Scope preview',exact:true}).waitFor();
    const scope=page.getByRole('textbox',{name:'Compliance scope',exact:true});
    const originalScope=await scope.inputValue();
    await scope.fill('Local visual review: the agreed services, records, systems and locations.');
    assert.match(await page.locator('.cc-live-preview').first().innerText(),/Local visual review:/);
    await scope.fill(originalScope);
    await page.screenshot({path:path.join(out,`assessment-scope-${width}.png`)});
    checks.push({width,check:'Scope preview reflects current inputs without changing the saved record'});
    await page.getByRole('button', { name: /^Next:/ }).click();
    await page.waitForURL(url => url.searchParams.get('step') === 'obligations');
    await page.reload();
    await page.locator('main h1').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('step'), 'obligations');
    checks.push({ width, check: 'Assessment step survives reload' });
    const outcomeUrl = new URL(page.url());
    outcomeUrl.searchParams.set('step', 'outcome');
    await page.goto(outcomeUrl.href);
    await page.waitForURL(url => url.searchParams.get('step') === 'outcome');
    await page.getByRole('heading', { name: 'Record the final outcome' }).waitFor();
    const outcomeDetails=page.getByRole('heading', { name: 'Record the final outcome' }).locator('..').locator('..').locator('details').first();
    if(!(await outcomeDetails.getAttribute('open') !== null)) await outcomeDetails.locator('summary').click();
    assert.equal(await page.getByRole('button', { name: 'Save for independent review' }).isDisabled(), true);
    checks.push({ width, check: 'Incomplete assessment cannot record its final outcome' });
    await page.screenshot({ path: path.join(out, `assessment-outcome-${width}.png`) });
    await page.goto(base + '/controls?recordId=' + control.id);
    await page.getByRole('heading', { name: 'Linked record: ' + control.title }).waitFor();
    checks.push({ width, check: 'Direct record link opens the saved source' });
    const modalPages = [
      ['/controls', /New control/i], ['/policies', /New policy/i], ['/audits', /New audit/i],
      ['/training', /New program/i], ['/vendors', /New vendor/i], ['/calendar', /New event/i],
      ['/expiry', /Track item/i], ['/tasks', /New task/i],
    ];
    for (const [route, name] of modalPages) {
      await page.goto(base + route);
      await page.locator('main h1').waitFor();
      await page.getByRole('button', { name }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      const info = await dialog.evaluate(element => ({ overflow: element.scrollWidth > element.clientWidth + 2, unlabelled: [...element.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(field => !field.labels?.length && !field.getAttribute('aria-label') && !field.getAttribute('aria-labelledby')).map(field => field.name || field.tagName) }));
      assert.equal(info.overflow, false, `${route} modal width ${width}`);
      assert.deepEqual(info.unlabelled, [], `${route} modal labels ${width}`);
      await page.screenshot({ path: path.join(out, `form-${route.slice(1)}-${width}.png`) });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      checks.push({ width, check: `${route} form fits, fields are labelled, Escape closes it` });
    }
    await page.goto(base + '/audits');
    await page.getByRole('button', { name: /New audit/i }).first().click();
    const auditDialog = page.getByRole('dialog');
    await auditDialog.locator('input[name="title"]').fill('Invalid reversed-date probe');
    await auditDialog.locator('input[name="startDate"]').fill('2026-11-02');
    await auditDialog.locator('input[name="endDate"]').fill('2026-11-01');
    let invalidWrites = 0;
    const recordWrite = request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/audits') invalidWrites++; };
    page.on('request', recordWrite);
    await auditDialog.locator('button[type=submit]').click();
    await auditDialog.getByText(/end date.*start date/i).waitFor();
    assert.equal(invalidWrites, 0);
    page.off('request', recordWrite);
    await page.keyboard.press('Escape');
    checks.push({ width, check: 'Audit form refuses reversed dates before sending a request' });
    await page.goto(base + '/training');
    await page.getByRole('button', { name: /New program/i }).first().click();
    const trainingDialog = page.getByRole('dialog');
    await trainingDialog.locator('input[name="title"]').fill(`UX browser training ${width} ${Date.now()}`);
    await trainingDialog.locator('input[name="frequencyDays"]').fill('');
    const saved = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/training');
    await trainingDialog.locator('button[type=submit]').click();
    const response = await saved;
    assert.equal(response.status(), 201, await response.text());
    await trainingDialog.waitFor({ state: 'hidden' });
    checks.push({ width, check: 'Training form saves with its optional frequency left blank' });
    await page.goto(base + `/evidence/${access.evidenceId}`);
    await page.getByRole('heading', { name: /Demo:/ }).waitFor();
    await page.getByRole('heading', { name: 'What this evidence supports' }).first().waitFor();
    await page.waitForTimeout(750);
    await page.screenshot({ path: path.join(out, `evidence-detail-${width}.png`) });
    if (width === 390) assert.equal(await page.getByRole('link', { name: 'Open PDF', exact: true }).isVisible(), true);
    checks.push({ width, check: 'Evidence title and document actions remain usable' });
    await context.close();
    const publicContext = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
    const publicPage = await publicContext.newPage();
    for (const route of ['/register', '/forgot-password', '/reset-password']) {
      await publicPage.goto(base + route);
      await publicPage.locator('h1').waitFor();
      const overflow = await publicPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      assert.equal(overflow, false);
      await publicPage.screenshot({ path: path.join(out, `${route.slice(1)}-${width}.png`) });
      checks.push({ width, check: `${route} public page fits` });
    }
    await publicContext.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(out, 'interaction-checks.json'), JSON.stringify({ passed: true, checks, errors, productionWrites: false }, null, 2));
  console.log(JSON.stringify({ passed: true, checks: checks.length, errors: errors.length }));
} finally { await browser.close(); }
