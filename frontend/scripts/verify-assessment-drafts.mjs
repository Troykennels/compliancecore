import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Local authenticated fixture only. Fault injection never writes customer records.
const access = JSON.parse(await fs.readFile(process.env.CC_AUDIT_ACCESS ?? path.join(os.tmpdir(), 'compliance-presentation-20261023/ux-access.private.json'), 'utf8'));
const browser = await chromium.launch({ channel: 'msedge' });
const results = [];
const baseline = process.argv.includes('--baseline');
const out = path.resolve('../verification/workflow-audit-20261104');
await fs.mkdir(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => console.log('Browser error:', error.message));
  page.setDefaultTimeout(30000);
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.route('**/api/**', async route => route.fulfill({ response: await route.fetch({ url: route.request().url().replace(':3008/', ':3010/') }) }));
  await page.goto('http://127.0.0.1:5178/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').fill(access.roles.owner.email);
  await page.locator('input[type=password]').fill(access.roles.owner.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/dashboard');
  // Open a real adopted framework; the fixture deliberately has no saved plan.
  await page.goto(`http://127.0.0.1:5178/frameworks?framework=${access.frameworkId}&step=scope`);
  const scope = page.getByRole('textbox', { name: 'Compliance scope', exact: true });
  await scope.waitFor().catch(async error => { console.log('Page state:', page.url(), (await page.locator('body').innerText()).slice(-2500)); throw error; });
  const text = 'Unsaved assessment scope: payroll records, finance services and accountable staff.';
  await scope.fill(text);
  // A background refetch returns a genuine changed saved record, as happens when
  // another user edits a plan or a consultation invalidates its readiness.
  await page.route('**/api/frameworks/*/implementation', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch({ url: route.request().url().replace(':3008/', ':3010/') });
    const payload = await response.json();
    if (payload.data.plan) payload.data.plan.objective += ' Background update.';
    await route.fulfill({ response, json: payload });
  });
  const refresh = page.waitForResponse(r => /\/implementation$/.test(new URL(r.url()).pathname) && r.request().method() === 'GET');
  await page.getByRole('button', { name: 'Add stakeholder interview' }).click();
  const interview = page.getByRole('dialog');
  await interview.locator('[name=stakeholder]').fill('Local regression stakeholder');
  await interview.locator('[name=department]').fill('Finance');
  await interview.getByRole('button', { name: 'Save consultation', exact: true }).click();
  await refresh;
  await page.waitForTimeout(400);
  const retained = await scope.inputValue() === text;
  results.push({ check: 'Unsaved scope survives a changed background response', passed: retained });
  if (baseline) {
    console.log(JSON.stringify({ baseline: true, results }));
  } else {
    assert.ok(retained, 'Background refresh discarded the scope draft');
    await page.getByRole('button', { name: /^Next:/ }).click();
    await page.waitForURL(url => url.searchParams.get('step') === 'obligations');
    const narrative = page.getByRole('textbox', { name: 'Applicable requirements, sources and deadlines', exact: true });
    const notes = 'Draft obligation notes remain intact while visiting other assessment steps.';
    await narrative.fill(notes);
    await page.getByRole('button', { name: /^Next:/ }).click();
    await page.waitForURL(url => url.searchParams.get('step') === 'risk_assessment');
    await page.getByRole('button', { name: /^Previous:/ }).click();
    await page.waitForURL(url => url.searchParams.get('step') === 'obligations');
    assert.equal(await narrative.inputValue(), notes);
    results.push({ check: 'Each assessment step retains its unsaved narrative when navigating', passed: true });
    const save = page.getByRole('button', { name: /Save/ }).first();
    await page.route('**/api/frameworks/*/implementation/preparation', route => route.fulfill({ status: 422, json: { error: { message: 'Request validation failed', details: { obligations: 'Record the source of this obligation.' } } } }));
    await save.click();
    await page.getByRole('alert').filter({ hasText: /could not be saved/i }).waitFor();
    await page.screenshot({ path: path.join(out, 'assessment-validation-1440.png'), fullPage: true });
    assert.equal(await narrative.inputValue(), notes);
    await page.getByRole('button', { name: /obligations: Record the source/ }).click();
    await narrative.evaluate(element => { if (document.activeElement !== element) throw Error('Error link did not focus the field'); });
    results.push({ check: 'Server validation explains failure and preserves current answers', passed: true });
    await page.unroute('**/api/frameworks/*/implementation/preparation');
    const confirmed = page.waitForResponse(response => /\/preparation$/.test(response.url()) && response.status() === 200);
    await save.click();
    await confirmed;
    await page.reload();
    assert.equal(await narrative.inputValue(), notes);
    results.push({ check: 'Successful save is confirmed by the server and survives reopening', passed: true });
    await page.getByRole('button', { name: /^Previous:/ }).click();
    await page.waitForURL(url => url.searchParams.get('step') === 'scope');
    await page.getByRole('button', { name: 'Add stakeholder interview' }).click();
    await interview.locator('[name=stakeholder]').fill('Permission and connection regression');
    await interview.locator('[name=department]').fill('Finance');
    let fault = 'permission';
    await page.route('**/api/frameworks/*/assessment/engagement', route => fault === 'permission'
      ? route.fulfill({ status: 403, json: { error: { message: 'Not authorised to save this record.' } } })
      : fault === 'connection' ? route.abort('failed') : route.fallback());
    await interview.getByRole('button', { name: 'Save consultation', exact: true }).click();
    await interview.getByRole('alert').filter({ hasText: /do not have permission/ }).waitFor();
    fault = 'connection';
    await interview.getByRole('button', { name: 'Retry saving current answers' }).click();
    await interview.getByRole('alert').filter({ hasText: /could not be reached/ }).waitFor();
    await page.screenshot({ path: path.join(out, 'consultation-retry-1440.png'), fullPage: true });
    assert.equal(await interview.locator('[name=stakeholder]').inputValue(), 'Permission and connection regression');
    fault = 'none';
    await interview.getByRole('button', { name: 'Retry saving current answers' }).click();
    await interview.waitFor({ state: 'hidden' });
    await page.getByText('Permission and connection regression', { exact: false }).first().waitFor();
    results.push({ check: 'Permission and connection failures preserve interview answers; Retry saves current values', passed: true });
    await page.screenshot({ path: path.join(out, 'assessment-scope-1440.png'), fullPage: true });
    const visited = [];
    for (let index = 0; index < 30; index++) {
      visited.push(new URL(page.url()).searchParams.get('step'));
      const next = page.getByRole('button', { name: /^Next:/ });
      if (!await next.count() || await next.isDisabled()) break;
      const title = (await next.innerText()).replace(/^Next:\s*/, '').trim();
      const previous = page.url();
      await next.click();
      await page.waitForURL(url => url.href !== previous);
      await page.getByRole('heading', { name: title, exact: true }).first().waitFor();
    }
    assert.ok(visited.includes('signoff') && visited.includes('outcome'));
    results.push({ check: 'Every assessment step remains accessible through review and final outcome', passed: true, visited });
    await page.screenshot({ path: path.join(out, 'assessment-outcome-1440.png'), fullPage: true });
    await fs.writeFile(path.join(out, 'draft-regression.json'), JSON.stringify({ passed: true, reproducedBeforeFix: ['Background refresh discarded unsaved scope', 'Step navigation remounted the page and discarded drafts'], results }, null, 2));
    console.log(JSON.stringify({ passed: true, results }));
  }
} finally { await browser.close(); }
