/**
 * Operator-console tenant erasure.
 *
 * Most of these assert a REFUSAL — a non-superadmin, the wrong confirmation
 * name, the operator's own tenant, a second delete. Those are the cases that
 * matter: a test proving deletion works would pass just as happily if the
 * endpoint deleted whatever it was pointed at, and the thing being deleted here
 * is a customer's entire compliance archive.
 *
 * Usage: DATABASE_URL=... API_URL=... node scripts/admin-tenant-checks.mjs
 */
import pg from 'pg';

const API = process.env.API_URL ?? 'http://127.0.0.1:3002';
const DB = process.env.DATABASE_URL;
const stamp = Date.now();

const OWNER = `admin${stamp}@example.com`;
const VICTIM = `victim${stamp}@example.com`;
const PASSWORD = 'AdminDelete123!';

async function call(method, path, body, token) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => null);
  return { status: r.status, body: j?.data ?? j, error: j?.error };
}

const client = new pg.Client({ connectionString: DB });
await client.connect();

async function makeTenant(email, orgName) {
  await call('POST', '/api/auth/register', { email, password: PASSWORD, firstName: 'T', lastName: 'T' });
  await client.query('UPDATE global.users SET email_verified_at = now() WHERE email = $1', [email]);
  let token = (await call('POST', '/api/auth/login', { email, password: PASSWORD })).body.accessToken;
  await call('POST', '/api/organizations', { name: orgName, industry: 'Technology', size: '11-50' }, token);
  token = (await call('POST', '/api/auth/login', { email, password: PASSWORD })).body.accessToken;
  await call('POST', '/api/organizations/onboarding/complete', {}, token);
  const id = (await client.query('SELECT id FROM global.tenants WHERE name = $1', [orgName])).rows[0].id;
  return { token, tenantId: id };
}

const ownerOrg = `Operator Org ${stamp}`;
const victimOrg = `Victim Org ${stamp}`;
const owner = await makeTenant(OWNER, ownerOrg);
const victim = await makeTenant(VICTIM, victimOrg);

// Promote the operator to platform superadmin, then re-issue their token so the
// claim is actually present.
await client.query('UPDATE global.users SET is_superadmin = true WHERE email = $1', [OWNER]);
owner.token = (await call('POST', '/api/auth/login', { email: OWNER, password: PASSWORD })).body.accessToken;

const results = [];
const check = (name, pass, detail) => results.push({ name, verdict: pass ? 'PASS' : 'FAIL', detail });

// A non-superadmin must not reach the console at all.
const asVictim = await call('DELETE', `/api/billing/admin/tenants/${owner.tenantId}`,
  { confirmName: ownerOrg }, victim.token);
check('non-superadmin refused', asVictim.status === 403 || asVictim.status === 401, `${asVictim.status}`);

// Wrong confirmation name must not delete anything.
const wrongName = await call('DELETE', `/api/billing/admin/tenants/${victim.tenantId}`,
  { confirmName: 'not the right name' }, owner.token);
check('wrong confirmation refused', wrongName.status >= 400 && wrongName.status < 500,
  `${wrongName.status} ${wrongName.error?.code ?? ''}`);

// Deleting the tenant you are signed in to must be refused.
const ownTenant = await call('DELETE', `/api/billing/admin/tenants/${owner.tenantId}`,
  { confirmName: ownerOrg }, owner.token);
check('own tenant refused', ownTenant.error?.code === 'CANNOT_DELETE_OWN_TENANT',
  `${ownTenant.status} ${ownTenant.error?.code ?? ''}`);

// The real thing.
const del = await call('DELETE', `/api/billing/admin/tenants/${victim.tenantId}`,
  { confirmName: victimOrg }, owner.token);
check('delete succeeds with correct name', del.status === 200, `${del.status}`);

const row = (await client.query(
  'SELECT deleted_at, is_active, purge_after FROM global.tenants WHERE id = $1::uuid', [victim.tenantId])).rows[0];
check('tenant soft-deleted and deactivated', row.deleted_at !== null && row.is_active === false,
  `deleted_at=${row.deleted_at !== null} is_active=${row.is_active}`);
check('purge scheduled ~30 days out',
  Math.round((new Date(row.purge_after) - Date.now()) / 86400000) === 30,
  `${Math.round((new Date(row.purge_after) - Date.now()) / 86400000)} days`);

// Their data must NOT be gone yet.
const schemaStill = await client.query(
  `SELECT 1 FROM information_schema.schemata s
    JOIN global.tenants t ON t.schema_name = s.schema_name WHERE t.id = $1::uuid`, [victim.tenantId]);
check('data retained during grace window', schemaStill.rowCount === 1, `${schemaStill.rowCount} schema`);

// The victim's session must be dead.
const victimAfter = await call('GET', '/api/dashboard', null, victim.token);
check('member session revoked', victimAfter.status === 401, `${victimAfter.status}`);

// Deleting twice must be refused rather than re-scheduling.
const again = await call('DELETE', `/api/billing/admin/tenants/${victim.tenantId}`,
  { confirmName: victimOrg }, owner.token);
check('second delete refused', again.status === 409, `${again.status} ${again.error?.code ?? ''}`);

// It must still be listed, or there is no way to undo it.
const list = await call('GET', '/api/billing/admin/tenants', null, owner.token);
const listed = (Array.isArray(list.body) ? list.body : []).find((t) => t.tenantId === victim.tenantId);
check('still visible in console with state', Boolean(listed?.deletedAt),
  listed ? `deletedAt=${Boolean(listed.deletedAt)}` : 'not listed');

// Restore.
const restore = await call('POST', `/api/billing/admin/tenants/${victim.tenantId}/restore`, {}, owner.token);
const after = (await client.query(
  'SELECT deleted_at, is_active FROM global.tenants WHERE id = $1::uuid', [victim.tenantId])).rows[0];
check('restore brings it back', restore.status === 200 && after.deleted_at === null && after.is_active === true,
  `${restore.status} deleted_at=${after.deleted_at}`);

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => r.verdict === 'FAIL');
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await client.end();
process.exit(failed.length ? 1 : 0);
