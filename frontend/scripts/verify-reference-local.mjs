import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:5178';
const out = '../verification/reference-20261031';
const access = JSON.parse(await fs.readFile(path.join(os.tmpdir(), 'compliance-presentation-20261023/ux-access.private.json'), 'utf8'));
const pages = ['/journey', '/dashboard', '/guide', '/frameworks', '/risks', '/controls', '/policies', '/policy-templates', '/evidence', '/audits', '/approvals', '/signatures', '/training', '/tasks', '/incidents', '/vendors', '/escalations', '/privacy/ropa', '/privacy/dsar', '/privacy/dpia', '/reports', '/compliance-score', '/analytics', '/calendar', '/expiry', '/departments', '/branches', '/ai-tools', '/integrations', '/notifications', '/settings/organization', '/settings/team', '/settings/security', '/settings/sso', '/settings/api-keys', '/settings/webhooks', '/settings/notifications', '/settings/billing', '/billing', '/billing/plans', '/billing/invoices', '/billing/payment-methods', `/audits/${access.auditId}`, `/evidence/${access.evidenceId}`];
const results = [], errors = [], serverErrors = [];
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({channel:"msedge"});
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const hostname = new URL(route.request().url()).hostname;
      return ['127.0.0.1', 'localhost'].includes(hostname) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    let currentRoute = '/login';
    page.on('pageerror', error => errors.push({ width, route: currentRoute, message: error.message }));
    page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 500) serverErrors.push({ width, route: currentRoute, url: new URL(response.url()).pathname, status: response.status() }); });
    await page.goto(base + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.locator('input[type=email]').fill(access.roles.owner.email);
    await page.locator('input[type=password]').fill(access.roles.owner.password);
    await page.screenshot({ path: path.join(out, `login-${width}.png`) });
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/dashboard', { waitUntil: 'domcontentloaded' });
    for (const route of pages) {
      currentRoute = route;
      await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 120000 });
      try { await page.locator('#main-content h1:visible').first().waitFor(); }
      catch(error) { await page.screenshot({path:path.join(out,'failed-page-'+width+'.png')}); console.log('Failed route '+route+' at '+page.url()); throw error; }
      await page.waitForLoadState('networkidle', {timeout:15000});
      await page.waitForTimeout(250);
      const inventory = await page.locator('#main-content').evaluate(main => ({
        title: main.querySelector('h1')?.textContent,
        headings: [...main.querySelectorAll('h1')].filter(x => x.getBoundingClientRect().height > 0).length,
        overflow: main.scrollWidth > main.clientWidth + 2,
        documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        unlabelled: [...main.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(x => !x.labels?.length && !x.getAttribute('aria-label') && !x.getAttribute('aria-labelledby')).map(x => ({ tag: x.tagName, name: x.name, placeholder: x.getAttribute('placeholder') })),
        denied: main.textContent.includes('This page needs additional access'),
      }));
      const filename = route === `/audits/${access.auditId}` ? 'audit-room' : route === `/evidence/${access.evidenceId}` ? 'evidence-detail' : route.slice(1).replaceAll('/', '-');
      await page.screenshot({ path: path.join(out, `${filename}-${width}.png`) });
      results.push({ route, width, ...inventory, screenshot: `${filename}-${width}.png` });
      console.log(`${width} ${route}: ${inventory.overflow || inventory.documentOverflow ? 'OVERFLOW' : 'fits'}; ${inventory.headings} heading`);
    }
    await context.close();
  }
  for (const role of ['admin', 'compliance_manager', 'control_owner', 'auditor', 'viewer', 'msp_admin', 'msp_analyst']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(base + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.locator('input[type=email]').fill(access.roles[role].email);
    await page.locator('input[type=password]').fill(access.roles[role].password);
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(out, `dashboard-${role}.png`) });
    if (role.startsWith('msp_')) {
      await page.goto(base + '/msp/portfolio');
      await page.getByRole('heading', { name: 'Client portfolio' }).waitFor();
      await page.screenshot({ path: path.join(out, `portfolio-${role}.png`) });
    }
    for (const route of ['/analytics', '/settings/notifications']) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.locator('#main-content h1:visible').waitFor();
      assert.equal(await page.getByRole('heading', { name: 'This page needs additional access' }).count(), 0, `${role} ${route}`);
    }
    if (['auditor', 'viewer', 'msp_analyst'].includes(role)) {
      for (const route of ['/evidence', '/approvals', '/calendar', '/tasks']) {
        await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.locator('#main-content h1:visible').waitFor();
        const forbidden = await page.locator('#main-content').getByRole('button', { name: /^(Upload evidence|New workflow|New request|New event|New task|Track item)$/i }).count();
        assert.equal(forbidden, 0, `${role} forbidden action on ${route}`);
      }
    }
    await context.close();
  }
  const overflow = results.filter(r => r.overflow || r.documentOverflow);
  const unlabelled = results.filter(result => result.unlabelled.length);
  assert.deepEqual(unlabelled, []);
  const invalidHeadings = results.filter(r => r.headings !== 1);
  await fs.writeFile(path.join(out, 'browser-checks.json'), JSON.stringify({ passed: !errors.length && !serverErrors.length && !overflow.length && !invalidHeadings.length, results, errors, serverErrors, overflow, invalidHeadings, productionWrites: false }, null, 2));
  const cards = results.map(r => `<article><h2>${r.title} · ${r.width}px</h2><a href="${r.screenshot}"><img loading="lazy" src="${r.screenshot}" alt="${r.title} at ${r.width} pixels"></a><p>${r.route}</p></article>`).join('');
  await fs.writeFile(path.join(out, 'gallery.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>ComplianceCore design review</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px system-ui;background:#f1f6fa;color:#253640;margin:32px}h1{color:#0b263e}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:24px}article{background:white;border:1px solid #d9e3e4;border-radius:8px;padding:16px}img{max-width:100%;border:1px solid #e1e8e8}h2{font-size:16px}</style><h1>ComplianceCore · page design review</h1><p>Local verification · 30 October 2026 · desktop and phone layouts</p><div class="grid">${cards}</div></html>`);
  console.log(JSON.stringify({ pages: results.length, errors: errors.length, serverErrors: serverErrors.length, overflow: overflow.length, invalidHeadings: invalidHeadings.length }));
  assert.deepEqual(errors, []);
  assert.deepEqual(serverErrors, []);
  assert.deepEqual(overflow, []);
  assert.deepEqual(invalidHeadings, []);
} finally { await browser.close(); }
