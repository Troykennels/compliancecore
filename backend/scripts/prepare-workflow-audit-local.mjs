import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import bcrypt from 'bcrypt';

const db = new URL(process.env.DATABASE_URL);
assert.equal(db.hostname, '127.0.0.1');
assert.equal(db.port, '55446');
assert.equal(db.pathname, '/compliance_renewal_task_presentation_20261023');
const demo = JSON.parse(await fs.readFile(path.join(os.tmpdir(), 'compliance-presentation-20261023/demo-access-local.json'), 'utf8'));
const c = new pg.Client({ connectionString: db.href });
await c.connect();
try {
  const { rows: [tenant] } = await c.query('SELECT d.*,t.schema_name FROM global.presentation_demos d JOIN global.tenants t ON t.id=d.tenant_id');
  const roles = { owner: { email: demo.email, password: demo.password } };
  for (const role of ['admin', 'compliance_manager', 'control_owner', 'auditor', 'viewer', 'msp_admin', 'msp_analyst']) {
    const email = `audit-${role}@example.invalid`, password = crypto.randomBytes(24).toString('base64url');
    const { rows: [user] } = await c.query("INSERT INTO global.users(email,password_hash,first_name,last_name,email_verified_at,is_active,onboarding_completed_at,updated_at) VALUES($1,$2,'Audit',$3,NOW(),true,NOW(),NOW()) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id", [email, await bcrypt.hash(password, 10), role]);
    await c.query('INSERT INTO global.tenant_memberships(tenant_id,user_id,role,is_active) VALUES($1,$2,$3::global."UserRole",true) ON CONFLICT(tenant_id,user_id) DO NOTHING', [tenant.tenant_id, user.id, role]);
    roles[role] = { email, password };
  }
  const { rows: [audit] } = await c.query(`SELECT id FROM ${tenant.schema_name}.audits LIMIT 1`);
  const { rows: [evidence] } = await c.query(`SELECT id FROM ${tenant.schema_name}.evidence LIMIT 1`);
  const { rows: [framework] } = await c.query("SELECT id FROM framework_data.frameworks WHERE code='ISO27001'");
  const login = await fetch('http://127.0.0.1:3010/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(roles.owner) }).then(r => r.json());
  const response = await fetch(`http://127.0.0.1:3010/api/frameworks/${framework.id}/implementation`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.accessToken }, body: JSON.stringify({ scope: 'Local acceptance assessment of payroll records, finance services and accountable staff.', objective: 'Verify applicable payroll safeguards with recorded evidence and independent review.', ownerId: tenant.owner_id, targetDate: '2027-01-01' }) });
  assert.equal(response.status, 200);
  const file = path.join(process.env.LOCALAPPDATA, 'OrionSoft/compliance-audit-20261103/access.private.json');
  await fs.writeFile(file, JSON.stringify({ roles, auditId: audit.id, evidenceId: evidence.id, frameworkId: framework.id }), { mode: 0o600 });
  const actor = async role => ({ ...(await c.query('SELECT id,email FROM global.users WHERE email=$1', [roles[role].email])).rows[0], role, tenantId: tenant.tenant_id });
  const privateRoot = path.join(process.env.LOCALAPPDATA, 'OrionSoft/compliance-audit-20261103');
  const fixtureDir = path.join(privateRoot, 'OrionSoft/compliance-workflow-20261026');
  await fs.mkdir(fixtureDir, { recursive: true });
  await fs.writeFile(path.join(fixtureDir, 'fixture-access.private.json'), JSON.stringify({ owner: await actor('owner'), reviewer: await actor('admin'), auditor: await actor('auditor'), viewer: await actor('viewer') }), { mode: 0o600 });
  console.log(JSON.stringify({ prepared: true, roles: Object.keys(roles).length, credentialFile: file }));
} finally { await c.end(); }
