#!/usr/bin/env node
/**
 * Local demo seed — creates a verified, onboarded owner + tenant + provisioned
 * tenant schema + a handful of controls so the dashboard/compliance score show
 * real data on a fresh local database.
 *
 *   DATABASE_URL=postgresql://... node scripts/seed-demo.mjs
 *
 * For LOCAL DEVELOPMENT ONLY. Login: admin@demo.com / Demo1234!
 * Requires the global schema + migrations to already be applied
 * (run `node scripts/migrate.mjs --seed` first).
 */
import pg from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DB = process.env.DATABASE_URL;
if (!DB) { console.error('DATABASE_URL is required'); process.exit(1); }

const EMAIL = process.env.DEMO_EMAIL ?? 'admin@demo.com';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo1234!';
const templateDir = fileURLToPath(new URL('../../database/tenant-template', import.meta.url));

const c = new pg.Client(DB);
await c.connect();

const hash = await bcrypt.hash(PASSWORD, 12);
const { rows: urows } = await c.query(
  `INSERT INTO global.users (email, password_hash, first_name, last_name, email_verified_at, is_active, onboarding_completed_at, created_at, updated_at)
   VALUES ($1,$2,'Demo','Admin', NOW(), TRUE, NOW(), NOW(), NOW())
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
     email_verified_at = NOW(), is_active = TRUE, onboarding_completed_at = NOW(), updated_at = NOW()
   RETURNING id`, [EMAIL, hash]);
const userId = urows[0].id;

let schemaName;
const { rows: mrows } = await c.query(
  `SELECT t.schema_name FROM global.tenant_memberships m
     JOIN global.tenants t ON t.id = m.tenant_id
    WHERE m.user_id = $1 AND m.deleted_at IS NULL LIMIT 1`, [userId]);
if (mrows.length) {
  schemaName = mrows[0].schema_name;
} else {
  schemaName = 'tenant_' + crypto.randomUUID().replace(/-/g, '');
  const { rows: trows } = await c.query(
    `INSERT INTO global.tenants (name, slug, schema_name, plan, is_active, onboarding_done_at, created_at, updated_at)
     VALUES ('Demo Organisation', $1, $2, 'professional', TRUE, NOW(), NOW(), NOW()) RETURNING id`,
    ['demo-org-' + schemaName.slice(7, 15), schemaName]);
  await c.query(
    `INSERT INTO global.tenant_memberships (tenant_id, user_id, role, is_active)
     VALUES ($1,$2,'owner',TRUE)`, [trows[0].id, userId]);
  const files = (await readdir(templateDir)).filter((f) => f.endsWith('.sql')).sort();
  const parts = await Promise.all(files.map((f) => readFile(path.join(templateDir, f), 'utf8')));
  const combined = parts.join('\n').split('{{SCHEMA}}').join(schemaName);
  await c.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"; BEGIN; ${combined}; COMMIT;`);
}

const controls = [
  ['AC-1', 'Access Control Policy', 'critical', 'implemented', 'Access Control'],
  ['AC-2', 'Account Management', 'high', 'implemented', 'Access Control'],
  ['AC-3', 'Least Privilege Enforcement', 'high', 'partially_implemented', 'Access Control'],
  ['CP-1', 'Contingency Planning Policy', 'medium', 'not_implemented', 'Contingency'],
  ['SC-7', 'Boundary Protection', 'critical', 'partially_implemented', 'System & Comms'],
  ['AU-2', 'Audit Events', 'medium', 'implemented', 'Audit & Accountability'],
  ['IR-4', 'Incident Handling', 'high', 'planned', 'Incident Response'],
  ['RA-5', 'Vulnerability Scanning', 'high', 'not_implemented', 'Risk Assessment'],
];
let seeded = 0;
for (const [ref, title, crit, status, cat] of controls) {
  const r = await c.query(
    `INSERT INTO "${schemaName}".controls (control_ref, title, criticality, implementation_status, category, owner_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$6) ON CONFLICT DO NOTHING`,
    [ref, title, crit, status, cat, userId]);
  seeded += r.rowCount;
}

await c.end();
console.log(`Demo seed complete → login ${EMAIL} / ${PASSWORD} | tenant ${schemaName} | +${seeded} controls`);
