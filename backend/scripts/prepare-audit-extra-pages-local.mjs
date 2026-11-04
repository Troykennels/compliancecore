import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import bcrypt from 'bcrypt';
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55446');
assert.equal(url.pathname, '/compliance_renewal_task_presentation_20261023');
const file = path.join(process.env.LOCALAPPDATA, 'OrionSoft/compliance-audit-20261103/access.private.json');
const access = JSON.parse(await fs.readFile(file, 'utf8'));
const c = new pg.Client({ connectionString: url.href }); await c.connect();
try {
  const { rows: [tenant] } = await c.query('SELECT d.*,t.schema_name FROM global.presentation_demos d JOIN global.tenants t ON t.id=d.tenant_id');
  await c.query('UPDATE global.users SET is_superadmin=true WHERE id=$1', [tenant.owner_id]);
  const { rows: [task] } = await c.query(`SELECT id FROM ${tenant.schema_name}.tasks LIMIT 1`);
  const { rows: [approval] } = await c.query(`SELECT id FROM ${tenant.schema_name}.approval_requests LIMIT 1`);
  const password = crypto.randomBytes(24).toString('base64url'), email = 'audit-onboarding@example.invalid';
  const { rows: [user] } = await c.query("INSERT INTO global.users(email,password_hash,first_name,last_name,email_verified_at,is_active,updated_at) VALUES($1,$2,'Audit','Onboarding',NOW(),true,NOW()) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id", [email, await bcrypt.hash(password, 10)]);
  await c.query('INSERT INTO global.tenant_memberships(tenant_id,user_id,role,is_active) VALUES($1,$2,\'owner\',true) ON CONFLICT(tenant_id,user_id) DO NOTHING', [tenant.tenant_id, user.id]);
  await fs.writeFile(file, JSON.stringify({ ...access, taskId: task.id, approvalId: approval.id, onboarding: { email, password } }), { mode: 0o600 });
  console.log('Extra local page fixtures prepared.');
} finally { await c.end(); }
