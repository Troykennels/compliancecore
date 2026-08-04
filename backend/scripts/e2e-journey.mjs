#!/usr/bin/env node
/**
 * End-to-end journey check.
 *
 *   node scripts/e2e-journey.mjs            # expects the API on :3002
 *   API_URL=http://host:port node scripts/e2e-journey.mjs
 *
 * Drives the real customer path over HTTP — register, verify, onboard, scope,
 * adopt a framework, then exercise every module's list, detail, create, update
 * and delete route — and fails the build on any 5xx.
 *
 * This exists because page-level checks miss the bugs that matter. An earlier
 * sweep loaded 29 routes and reported everything green while POST /tasks,
 * POST /approvals/workflows, POST /escalations/rules, POST /signatures and
 * POST /reports/scheduled were all returning 500: every one of them lives on a
 * detail or write path that simply loading a page never touches.
 *
 * Exit code 0 when no unexpected server error occurred, 1 otherwise.
 */
import pg from 'pg';

const API = process.env.API_URL ?? 'http://127.0.0.1:3002';
const DB  = process.env.DATABASE_URL;
if (!DB) {
  console.error('[e2e] DATABASE_URL is required (used to confirm the signup email)');
  process.exit(1);
}

const stamp = Date.now();
const EMAIL = `e2e${stamp}@example.com`;
const PASSWORD = 'E2ePass123!';

let token = null;
let cookie = null;
const results = [];

/**
 * Endpoints that legitimately fail without third-party credentials. CI has no
 * Groq key and no Paystack account, so a 503 from these is the system correctly
 * reporting an unconfigured integration — not a regression.
 */
const EXTERNAL = [/\/api\/ai\//, /\/api\/payments\/checkout/];
const isExternal = (path) => EXTERNAL.some((re) => re.test(path));

async function call(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token && !opts.noAuth) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;

  let res, text;
  try {
    res = await fetch(`${API}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    text = await res.text();
  } catch (err) {
    results.push({ method, path, status: 0, note: `NETWORK: ${err.message}` });
    return { status: 0, json: null };
  }

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];

  let json = null;
  try { json = JSON.parse(text); } catch { /* binary or empty */ }

  results.push({
    method, path, status: res.status,
    note: json?.error ? `${json.error.code}: ${json.error.message}` : '',
  });
  return { status: res.status, json };
}

const data = (r) => r.json?.data;

async function main() {
  const client = new pg.Client({ connectionString: DB });
  await client.connect();

  // ── Signup ───────────────────────────────────────────────────────────────
  await call('POST', '/api/auth/register',
    { email: EMAIL, password: PASSWORD, firstName: 'E2E', lastName: 'Journey' }, { noAuth: true });
  // The raw verification token is never stored, only its hash — so the click is
  // simulated directly rather than fished out of the database.
  await client.query('UPDATE global.users SET email_verified_at = now() WHERE email = $1', [EMAIL]);

  let r = await call('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD }, { noAuth: true });
  token = data(r)?.accessToken;
  if (!token) { console.error('[e2e] login produced no access token'); report(); process.exit(1); }

  r = await call('GET', '/api/auth/me');
  const userId = data(r)?.id;

  // ── Onboarding ───────────────────────────────────────────────────────────
  await call('POST', '/api/organizations', { name: `E2E Org ${stamp}`, industry: 'Technology', size: '11-50' });
  r = await call('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD }, { noAuth: true });
  token = data(r)?.accessToken; // now carries tenantId
  await call('POST', '/api/organizations/onboarding/complete', {});
  await call('PATCH', '/api/organizations/profile', { country: 'Nigeria', timezone: 'Africa/Lagos' });

  // ── Scoping ──────────────────────────────────────────────────────────────
  await call('GET', '/api/organizations/scoping');
  r = await call('POST', '/api/organizations/scoping', {
    operatingRegions: ['nigeria'], customerDataRegions: ['nigeria', 'eu'],
    handlesPersonalData: true, handlesCardPayments: true, hostingModel: 'cloud',
    buildsSoftware: true, sellsToEnterprise: true, primaryDriver: 'customer_requirement',
  });
  assert('scoping returns recommendations', (data(r)?.recommendations ?? []).length > 0);

  // ── Framework adoption must actually create controls ──────────────────────
  const frameworks = data(await call('GET', '/api/frameworks')) ?? [];
  const iso = frameworks.find((f) => f.code === 'ISO27001');
  assert('framework catalogue is seeded', frameworks.length > 0);

  if (iso) {
    const detail = data(await call('GET', `/api/frameworks/${iso.id}`));
    assert('ISO 27001 library is populated', (detail?.controls ?? []).length > 0);

    const adopt = data(await call('POST', `/api/frameworks/${iso.id}/adopt`, {}));
    assert('adoption creates controls', (adopt?.created ?? 0) > 0);

    const again = data(await call('POST', `/api/frameworks/${iso.id}/adopt`, {}));
    assert('re-adoption is idempotent', (again?.created ?? 0) === 0 && (again?.skipped ?? 0) > 0);

    const controls = data(await call('GET', '/api/controls'));
    assert('controls reflect the adoption', (controls?.total ?? 0) > 0);
  }

  // ── Read every list endpoint ─────────────────────────────────────────────
  for (const path of [
    '/api/dashboard', '/api/compliance-score/current', '/api/compliance-score/trend',
    '/api/controls/stats', '/api/controls/overdue', '/api/policies', '/api/risks',
    '/api/risks/stats', '/api/vendors', '/api/audits', '/api/training', '/api/incidents',
    '/api/incidents/stats', '/api/analytics/overview', '/api/evidence',
    '/api/evidence/categories', '/api/evidence/tags', '/api/calendar', '/api/calendar/upcoming',
    '/api/expiry', '/api/expiry/stats', '/api/notifications', '/api/notifications/unread-count',
    '/api/approvals/workflows', '/api/approvals/requests', '/api/approvals/requests/my-pending',
    '/api/signatures', '/api/tasks', '/api/tasks/stats', '/api/tasks/overdue',
    '/api/escalations/rules', '/api/escalations/events', '/api/reports/dashboard',
    '/api/reports/scheduled', '/api/branches', '/api/departments',
    '/api/settings/team/members', '/api/settings/api-keys', '/api/settings/webhooks',
    '/api/settings/notifications', '/api/billing/overview', '/api/billing/subscription',
    '/api/billing/invoices', '/api/billing/usage', '/api/billing/entitlement',
    '/api/billing/plans/public', '/api/payments', '/api/payments/config',
  ]) {
    await call('GET', path);
  }

  // ── Write paths: create, read back, update, then remove ──────────────────
  const made = {};

  r = await call('POST', '/api/controls', {
    controlRef: `E2E-${stamp % 100000}`, title: 'E2E control',
    category: 'Access Control', criticality: 'high', implementationStatus: 'implemented',
  });
  made.control = data(r)?.id;
  if (made.control) {
    await call('GET', `/api/controls/${made.control}`);
    await call('PATCH', `/api/controls/${made.control}`, { title: 'E2E control v2' });
  }

  r = await call('POST', '/api/policies', { title: 'E2E policy', documentType: 'policy', content: '# E2E' });
  made.policy = data(r)?.id;
  if (made.policy) {
    await call('GET', `/api/policies/${made.policy}`);
    await call('POST', `/api/policies/${made.policy}/publish`, {});
  }

  r = await call('POST', '/api/risks', { title: 'E2E risk', category: 'security' });
  made.risk = data(r)?.id;
  if (made.risk) await call('GET', `/api/risks/${made.risk}`);

  r = await call('POST', '/api/vendors', { name: 'E2E vendor', riskLevel: 'medium' });
  made.vendor = data(r)?.id;
  if (made.vendor) {
    await call('GET', `/api/vendors/${made.vendor}/assessments`);
    await call('POST', `/api/vendors/${made.vendor}/assessments`, { name: 'Annual review', status: 'in_progress' });
  }

  r = await call('POST', '/api/audits', { title: 'E2E audit', auditType: 'internal' });
  made.audit = data(r)?.id;
  if (made.audit) {
    r = await call('POST', `/api/audits/${made.audit}/findings`, { title: 'E2E finding', severity: 'medium' });
    made.finding = data(r)?.id;
    if (made.finding) await call('PATCH', `/api/audits/findings/${made.finding}`, { severity: 'high' });
  }

  r = await call('POST', '/api/training', { title: 'E2E training' });
  made.training = data(r)?.id;
  if (made.training && userId) {
    await call('GET', `/api/training/${made.training}/records`);
    await call('POST', `/api/training/${made.training}/records`, { userIds: [userId], status: 'assigned' });
  }

  r = await call('POST', '/api/incidents', {
    title: 'E2E breach', category: 'privacy', severity: 'critical',
    isDataBreach: true, affectedDataSubjects: 10,
    detectedAt: new Date(Date.now() - 100 * 3600_000).toISOString(),
  });
  made.incident = data(r)?.id;
  if (made.incident) {
    const inc = data(await call('GET', `/api/incidents/${made.incident}`));
    assert('breach past its deadline is flagged overdue', inc?.notificationOverdue === true);
    await call('POST', `/api/incidents/${made.incident}/updates`, { body: 'Contained.', entryType: 'containment' });
    await call('PATCH', `/api/incidents/${made.incident}`, { regulatorNotifiedAt: new Date().toISOString() });
    const after = data(await call('GET', `/api/incidents/${made.incident}`));
    assert('notifying the regulator clears overdue', after?.notificationOverdue === false);
  }

  r = await call('POST', '/api/tasks', { title: 'E2E task', priority: 'high' });
  made.task = data(r)?.id;
  if (made.task) {
    await call('GET', `/api/tasks/${made.task}`);
    await call('PATCH', `/api/tasks/${made.task}`, { status: 'in_progress' });
    await call('GET', `/api/tasks/${made.task}/subtasks`);
    r = await call('POST', `/api/tasks/${made.task}/comments`, { body: 'E2E comment' });
    made.comment = data(r)?.id;
  }

  r = await call('POST', '/api/calendar', {
    title: 'E2E event', eventType: 'review', startDate: new Date(Date.now() + 864e5).toISOString(),
  });
  made.event = data(r)?.id;

  r = await call('POST', '/api/expiry', {
    name: 'E2E certificate', entityType: 'certificate',
    expiryDate: new Date(Date.now() + 30 * 864e5).toISOString(),
  });
  made.expiry = data(r)?.id;

  r = await call('POST', '/api/approvals/workflows', {
    name: 'E2E workflow', entityType: 'policy',
    steps: [{ stepOrder: 1, name: 'Review', approverType: 'role', approverRole: 'owner' }],
  });
  made.workflow = data(r)?.id;
  if (made.workflow) {
    await call('GET', `/api/approvals/workflows/${made.workflow}`);
    if (made.policy) {
      r = await call('POST', '/api/approvals/requests', {
        workflowId: made.workflow, entityType: 'policy', entityId: made.policy, title: 'Approve E2E policy',
      });
      made.request = data(r)?.id;
      if (made.request) await call('GET', `/api/approvals/requests/${made.request}`);
    }
  }

  await call('POST', '/api/escalations/rules', {
    name: 'E2E rule', triggerType: 'task_overdue', entityType: 'task',
    conditions: { daysOverdue: 2 },
    escalationChain: [{ delayHours: 1, action: 'notify', targetType: 'assignee', message: 'Overdue' }],
  }).then((res) => { made.rule = data(res)?.id; });

  // Signature digests are derived server-side; omitting the hash is the norm.
  if (made.policy) {
    r = await call('POST', '/api/signatures', { documentType: 'policy', documentId: made.policy });
    made.signature = data(r)?.id;
    if (made.signature) await call('POST', `/api/signatures/${made.signature}/verify`, {});
  }

  await call('POST', '/api/reports/scheduled', {
    name: 'E2E report', reportType: 'compliance_summary', frequency: 'weekly',
    format: 'pdf', recipients: [EMAIL],
  }).then((res) => { made.report = data(res)?.id; });

  await call('GET', '/api/reports/export/pdf');
  await call('GET', '/api/reports/export/excel');

  // ── Security guards ──────────────────────────────────────────────────────
  const badSwitch = await call('POST', '/api/auth/switch-tenant',
    { tenantId: '00000000-0000-0000-0000-000000000009' });
  assert('cross-tenant switch is refused', badSwitch.status === 403);

  // Must be an UPGRADE to be a meaningful test. Moving to a cheaper plan is
  // deliberately allowed — a customer may always choose to spend less — so
  // picking any paid plan would sometimes select a downgrade and pass for the
  // wrong reason. The trial sits on Professional, so take the dearest plan.
  const plans = data(await call('GET', '/api/billing/plans/public')) ?? [];
  const dearest = [...plans].sort((a, b) => Number(b.priceMonthly) - Number(a.priceMonthly))[0];
  if (dearest) {
    const freeUpgrade = await call('PATCH', '/api/billing/subscription',
      { planId: dearest.id, billingCycle: 'monthly' });
    assert(
      `upgrade to ${dearest.name} requires payment`,
      freeUpgrade.status >= 400,
    );
  }

  // ── Tear down what we made ───────────────────────────────────────────────
  if (made.comment && made.task) await call('DELETE', `/api/tasks/${made.task}/comments/${made.comment}`);
  for (const [path, id] of [
    ['/api/tasks', made.task], ['/api/audits/findings', made.finding], ['/api/audits', made.audit],
    ['/api/training', made.training], ['/api/vendors', made.vendor], ['/api/risks', made.risk],
    ['/api/incidents', made.incident], ['/api/calendar', made.event], ['/api/expiry', made.expiry],
    ['/api/escalations/rules', made.rule], ['/api/reports/scheduled', made.report],
    ['/api/approvals/workflows', made.workflow], ['/api/policies', made.policy],
    ['/api/controls', made.control],
  ]) {
    if (id) await call('DELETE', `${path}/${id}`);
  }

  await client.end();
}

// ── Assertions ─────────────────────────────────────────────────────────────
const assertions = [];
function assert(label, ok) { assertions.push({ label, ok: Boolean(ok) }); }

function report() {
  const serverErrors = results.filter(
    (r) => (r.status >= 500 || r.status === 0) && !isExternal(r.path),
  );
  const external = results.filter((r) => r.status >= 500 && isExternal(r.path));
  const clientErrors = results.filter((r) => r.status >= 400 && r.status < 500);
  const ok = results.filter((r) => r.status >= 200 && r.status < 400);
  const failedAssertions = assertions.filter((a) => !a.ok);

  console.log(`\n===== E2E: ${ok.length} ok · ${clientErrors.length} 4xx · ${serverErrors.length} server errors =====`);

  console.log('\nASSERTIONS');
  for (const a of assertions) console.log(`  ${a.ok ? 'pass' : 'FAIL'}  ${a.label}`);

  if (external.length) {
    console.log('\nUNCONFIGURED INTEGRATIONS (expected in CI)');
    for (const e of external) console.log(`  ${e.status} ${e.method} ${e.path}`);
  }
  if (clientErrors.length) {
    console.log('\n4xx (payload, authz or deliberate guard)');
    for (const c of clientErrors) console.log(`  ${c.status} ${c.method} ${c.path}  ${c.note}`);
  }
  if (serverErrors.length) {
    console.log('\nSERVER ERRORS');
    for (const s of serverErrors) console.log(`  ${s.status} ${s.method} ${s.path}\n      ${s.note}`);
  }

  return serverErrors.length === 0 && failedAssertions.length === 0;
}

main()
  .then(() => { process.exit(report() ? 0 : 1); })
  .catch((err) => { console.error('[e2e] fatal:', err); report(); process.exit(1); });
