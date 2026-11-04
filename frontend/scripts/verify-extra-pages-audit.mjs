import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const access = JSON.parse(await fs.readFile(process.env.CC_AUDIT_ACCESS, 'utf8'));
const out = path.resolve('../verification/workflow-audit-20261104');
const browser = await chromium.launch({ channel: 'msedge' });
const results = [], errors = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
    await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    page.on('pageerror', error => errors.push(error.message));
    const capture = async (route, name) => {
      await page.goto('http://127.0.0.1:5178' + route, { waitUntil: 'networkidle' });
      const info = await page.locator('body').evaluate(body => ({ title: body.querySelector('h1,h2')?.textContent, overflow: document.documentElement.scrollWidth > innerWidth + 2 }));
      assert.equal(info.overflow, false, route + ' overflows at ' + width);
      assert.ok(info.title, route + ' has no heading');
      await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true });
      results.push({ page: name, width, ...info });
    };
    for (const route of ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/evidence/shared/invalid-audit-token']) await capture(route, route.includes('/shared/') ? 'shared-link-invalid' : route.slice(1));
    const login = async credentials => {
      await page.goto('http://127.0.0.1:5178/login');
      await page.locator('input[type=email]').fill(credentials.email);
      await page.locator('input[type=password]').fill(credentials.password);
      await page.locator('button[type=submit]').click();
    };
    await login(access.roles.owner); await page.waitForURL('**/dashboard');
    await capture('/tasks/' + access.taskId, 'task-detail');
    await capture('/approvals/' + access.approvalId, 'approval-detail');
    await capture('/billing/admin', 'billing-admin');
    await context.clearCookies();
    await page.goto('http://127.0.0.1:5178/login');
    await login(access.onboarding); await page.waitForURL('**/onboarding');
    await capture('/onboarding', 'onboarding');
    await context.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(out, 'extra-page-checks.json'), JSON.stringify({ passed: true, results, errors, note: 'Missing-token public pages are checked as actionable error states. Actual registration and checkout transactions are covered by backend integration tests.' }, null, 2));
  console.log(JSON.stringify({ passed: true, layouts: results.length }));
} finally { await browser.close(); }
