import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Credentials remain in the existing private operator file, never in fixtures or logs.
const access = JSON.parse(await fs.readFile(path.join(process.env.LOCALAPPDATA, 'OrionSoft', 'ComplianceCore-Demo-Access.private.json'), 'utf8'));
const base = process.env.SESSION_TEST_URL ?? 'https://compliancecore-sand.vercel.app';
const baseline = process.env.SESSION_TEST_BASELINE === '1';
const output = path.resolve('../verification/session-stability-20261025');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
try {
  for (const width of baseline ? [1440] : [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, serviceWorkers: 'block' });
    // Exercise an unpromoted frontend under the production origin so the unchanged
    // API's CORS/cookie rules are tested without changing its allowed origins.
    if (process.env.SESSION_TEST_FRONTEND_URL) {
      await context.route(base + '/**', async route => {
        const request = new URL(route.request().url());
        const candidate = new URL(request.pathname + request.search, process.env.SESSION_TEST_FRONTEND_URL);
        const response = await route.fetch({ url: candidate.href });
        await route.fulfill({ response });
      });
    }
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    let logoutRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/auth/logout') logoutRequests++; });
    await page.clock.install();
    await page.goto(base + '/login');
    await page.locator('input[type=email]').waitFor();
    // Reproduce a login page left open past the old 30-minute threshold.
    await page.clock.fastForward(31 * 60_000);
    await page.locator('input[type=email]').fill(access.email);
    await page.locator('input[type=password]').fill(access.password);
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/dashboard', { timeout: 90000 });
    console.log(JSON.stringify({ width, step: 'signed-in-after-stale-login-page' }));
    await page.clock.fastForward(5000);
    if (baseline) {
      await page.waitForURL('**/login');
      assert.ok(logoutRequests > 0, 'Expected the old idle component to log out the fresh session');
      results.push({ width, reproducedFreshLoginLogoutAfterStaleLoginPage: true });
      await context.close();
      continue;
    }
    await page.locator('#main-content').waitFor();
    assert.equal(new URL(page.url()).pathname, '/dashboard');
    assert.equal(logoutRequests, 0);
    assert.equal(await page.getByRole('button', { name: 'Stay signed in', exact: true }).count(), 0);
    // No forced sign-out or prompt when an authenticated tab is left idle either.
    await page.clock.fastForward(35 * 60_000);
    console.log(JSON.stringify({ width, step: 'advanced-authenticated-idle-time' }));
    assert.equal(new URL(page.url()).pathname, '/dashboard');
    assert.equal(logoutRequests, 0);
    assert.equal(await page.getByRole('button', { name: 'Stay signed in', exact: true }).count(), 0);
    // Reload exercises the real refresh cookie and /auth/me, then protected navigation.
    await page.reload();
    await page.locator('#main-content').waitFor();
    assert.equal(new URL(page.url()).pathname, '/dashboard');
    await page.goto(base + '/guide');
    await page.locator('#main-content').waitFor();
    assert.equal(new URL(page.url()).pathname, '/guide');
    await page.screenshot({ path: path.join(output, `session-${width}.png`) });
    // Mobile sidebar is deliberately closed until the menu button is pressed.
    if (width === 390) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await page.waitForURL('**/login');
    await page.goto(base + '/dashboard');
    await page.locator('input[type=email]').waitFor();
    assert.equal(new URL(page.url()).pathname, '/login');
    assert.equal(logoutRequests, 1);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, step: 'refresh-navigation-explicit-logout-passed' }));
    results.push({ width, staleLoginPageHandled: true, idle35MinutesNoPromptOrLogout: true, refreshCookieRestoresSession: true, protectedGuideAccessible: true, explicitLogoutWorks: true, protectedRouteBlockedAfterLogout: true, pageErrors: 0 });
    await context.close();
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(output, baseline ? 'baseline.json' : 'results.json'), JSON.stringify({ base, results }, null, 2));
console.log(JSON.stringify({ passed: true, baseline, viewports: results.length, results }));
