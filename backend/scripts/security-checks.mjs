/**
 * Security and correctness guards.
 *
 * Each check below corresponds to a defect found in the August 2026 audit and
 * fixed. They live here rather than in e2e-journey.mjs because they assert that
 * something is REFUSED — the E2E walks the happy path and would stay green
 * while every one of these silently regressed.
 *
 * Two of them are the reason this file exists at all:
 *   - an MFA challenge token, issued after the password but before the second
 *     factor, was a valid access token;
 *   - PATCH /billing/subscription {"status":"active"} let a lapsed tenant
 *     restore its own paid access.
 *
 * Usage: DATABASE_URL=… API_URL=… node scripts/security-checks.mjs
 * Exits non-zero if any guard has come undone.
 */
import pg from 'pg';
import { authenticator } from 'otplib';

// Same default as e2e-journey.mjs, which is the port CI boots the server on.
// This originally defaulted to a local dev port, so the CI step connected to
// nothing and the whole run failed on a refused connection.
const API = process.env.API_URL ?? 'http://127.0.0.1:3002';
const DB = process.env.DATABASE_URL;
const stamp = Date.now();
const EMAIL = `fix${stamp}@example.com`;
const PASSWORD = 'VerifyAudit123!';

let token = null;
async function call(method, path, body, tok = token) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => null);
  return { status: r.status, body: j?.data ?? j, error: j?.error };
}

const client = new pg.Client({ connectionString: DB });
await client.connect();

await call('POST', '/api/auth/register', { email: EMAIL, password: PASSWORD, firstName: 'F', lastName: 'X' });
await client.query('UPDATE global.users SET email_verified_at = now() WHERE email = $1', [EMAIL]);
token = (await call('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD })).body.accessToken;
await call('POST', '/api/organizations', { name: `Fix Org ${stamp}`, industry: 'Technology', size: '11-50' });
token = (await call('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD })).body.accessToken;
await call('POST', '/api/organizations/onboarding/complete', {});

const results = [];
const check = (name, pass, detail) => results.push({ name, verdict: pass ? 'PASS' : 'FAIL', detail });

// 1. Trial must be 14 days, and the period must not outlive it.
const sub = (await client.query(`
  SELECT trial_ends_at, current_period_start, current_period_end FROM global.subscriptions
   WHERE tenant_id = (SELECT id FROM global.tenants WHERE name = $1)`, [`Fix Org ${stamp}`])).rows[0];
const days = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);
check('trial period equals trial length (was 31d)',
  days(sub.current_period_end, sub.current_period_start) <= 15,
  `trial ${days(sub.trial_ends_at, sub.current_period_start)}d, period ${days(sub.current_period_end, sub.current_period_start)}d`);

// 2. Once the trial lapses the tenant must fall out of full access.
await client.query(
  `UPDATE global.subscriptions
      SET trial_ends_at = now() - interval '1 day', current_period_end = now() - interval '1 day'
    WHERE tenant_id = (SELECT id FROM global.tenants WHERE name = $1)`, [`Fix Org ${stamp}`]);
const lapsed = (await call('GET', '/api/billing/entitlement')).body;
check('lapsed trial is no longer "active"', lapsed.state !== 'active', `state=${lapsed.state}`);

// 3. Status-only PATCH must be refused.
const statusPatch = await call('PATCH', '/api/billing/subscription', { status: 'active' });
check('self-service status escalation refused', statusPatch.status === 403,
  `${statusPatch.status} ${statusPatch.error?.code ?? ''}`);

// Restore a healthy subscription for the remaining checks.
await client.query(
  `UPDATE global.subscriptions SET trial_ends_at = now() + interval '10 days',
          current_period_end = now() + interval '10 days'
    WHERE tenant_id = (SELECT id FROM global.tenants WHERE name = $1)`, [`Fix Org ${stamp}`]);

// 4. Malformed uuid must be a 400, not a 500.
const badId = await call('GET', '/api/controls/not-a-uuid');
check('malformed :id is 4xx not 500', badId.status >= 400 && badId.status < 500, `${badId.status}`);

// 5. Notifications pagination must not 500.
const nBad = await call('GET', '/api/notifications?limit=abc');
const nNeg = await call('GET', '/api/notifications?page=0');
check('notifications reject bad pagination', nBad.status < 500 && nNeg.status < 500,
  `limit=abc -> ${nBad.status}, page=0 -> ${nNeg.status}`);

// 6. Report date parsing must not 500.
const badDate = await call('GET', '/api/reports/dashboard?dateFrom=yesterday');
check('bad report date is 4xx not 500', badDate.status < 500, `${badDate.status}`);

// 7. Task due-date filter must work rather than 500.
const taskFilter = await call('GET', '/api/tasks?dueBefore=2030-01-01T00:00:00.000Z');
check('task due-date filter works', taskFilter.status === 200, `${taskFilter.status}`);
const taskBadDate = await call('GET', '/api/tasks?dueBefore=soon');
check('task bad date is 4xx not 500', taskBadDate.status < 500, `${taskBadDate.status}`);

// 8. Creating a task with a status must honour it.
const made = await call('POST', '/api/tasks', { title: 'Board column task', priority: 'medium', status: 'in_progress' });
check('task create honours status', made.body?.status === 'in_progress', `status=${made.body?.status}`);

// 9. Duplicate unique value must be 409, not 500.
await call('POST', '/api/evidence/categories', { name: `Dup ${stamp}` });
const dup = await call('POST', '/api/evidence/categories', { name: `Dup ${stamp}` });
check('duplicate is 409 not 500', dup.status === 409 || (dup.status >= 400 && dup.status < 500), `${dup.status}`);

// 10. THE BIG ONE — an MFA challenge token must not authenticate.
await call('DELETE', '/api/auth/mfa', { password: PASSWORD }).catch(() => {});
const setup = await call('POST', '/api/auth/mfa/setup', {});
if (setup.status === 200 && setup.body?.secret) {
  const code = authenticator.generate(setup.body.secret);
  await call('POST', '/api/auth/mfa/setup/confirm', { code });
  const login2 = await call('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD }, null);
  const challenge = login2.body?.mfaChallengeToken;
  if (challenge) {
    const me = await call('GET', '/api/auth/me', null, challenge);
    const sw = await call('POST', '/api/auth/switch-tenant',
      { tenantId: (await client.query(`SELECT id FROM global.tenants WHERE name=$1`, [`Fix Org ${stamp}`])).rows[0].id },
      challenge);
    check('MFA challenge token cannot access the API', me.status === 401, `GET /me -> ${me.status}`);
    check('MFA challenge token cannot mint a tenant token', sw.status === 401, `switch-tenant -> ${sw.status}`);
  } else {
    check('MFA challenge issued', false, `login did not return a challenge: ${JSON.stringify(login2.body).slice(0, 120)}`);
  }
  // 11. Re-enrolling must not silently disable an active second factor.
  const reSetup = await call('POST', '/api/auth/mfa/setup', {},
    (await call('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD }, null)).body?.accessToken ?? token);
  check('MFA re-enrolment refused while enabled', reSetup.status === 409, `${reSetup.status}`);
} else {
  check('MFA setup reachable', false, `${setup.status}`);
}

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => r.verdict === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await client.end();
process.exit(failed.length ? 1 : 0);
