#!/usr/bin/env node
/**
 * Tenant-schema migration runner for ComplianceCore.
 *
 * New tenants get every template applied at provisioning time
 * (src/lib/provisioning.ts). EXISTING tenants do not — so adding a file to
 * database/tenant-template/ silently leaves every current customer without the
 * new tables until this runs. That is exactly how you ship a feature that works
 * for new signups and 500s for everyone who was already paying.
 *
 * The templates are written to be idempotent (CREATE TABLE / CREATE INDEX IF NOT
 * EXISTS), so this is safe to run repeatedly and safe to run against tenants
 * that are already up to date.
 *
 *   node scripts/migrate-tenants.mjs            # apply to every active tenant
 *   node scripts/migrate-tenants.mjs --dry-run  # list what would be touched
 *
 * Requires DATABASE_URL.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

const templateDir = fileURLToPath(new URL('../../database/tenant-template', import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[tenants] DATABASE_URL is required');
  process.exit(1);
}

// Matches the guard in provisioning.ts — never interpolate an unvalidated name.
const SAFE_SCHEMA_RE = /^tenant_[a-f0-9]{32}$/;

const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();

  const files = (await readdir(templateDir)).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.error(`[tenants] no templates found in ${templateDir}`);
    process.exit(1);
  }
  console.log(`[tenants] ${files.length} template(s): ${files.join(', ')}`);

  const { rows: tenants } = await client.query(
    `SELECT id, name, schema_name FROM global.tenants
      WHERE deleted_at IS NULL AND schema_name IS NOT NULL
      ORDER BY created_at`,
  );
  console.log(`[tenants] ${tenants.length} tenant schema(s) to check\n`);

  const templates = await Promise.all(
    files.map(async (file) => ({ file, raw: await readFile(path.join(templateDir, file), 'utf8') })),
  );

  let migrated = 0;
  const failures = [];

  for (const tenant of tenants) {
    const schemaName = tenant.schema_name;

    if (!SAFE_SCHEMA_RE.test(schemaName)) {
      console.warn(`[tenants] SKIP ${tenant.name} — unsafe schema name "${schemaName}"`);
      failures.push({ tenant: tenant.name, error: 'unsafe schema name' });
      continue;
    }
    if (DRY_RUN) {
      console.log(`[tenants] would migrate ${schemaName} (${tenant.name})`);
      continue;
    }

    // One transaction per tenant: a failure isolates to that customer instead of
    // rolling back everyone migrated so far.
    try {
      const sql = templates.map(({ raw }) => raw.split('{{SCHEMA}}').join(schemaName)).join(';\n');
      await client.query(`BEGIN;\nSET LOCAL search_path TO "${schemaName}", public;\n${sql};\nCOMMIT`);
      console.log(`[tenants] ok   ${schemaName} (${tenant.name})`);
      migrated++;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`[tenants] FAIL ${schemaName} (${tenant.name}): ${err.message}`);
      failures.push({ tenant: tenant.name, error: err.message });
    }
  }

  console.log(`\n[tenants] done — ${migrated} migrated, ${failures.length} failed`);
  if (failures.length) process.exitCode = 1;
}

main()
  .then(() => client.end())
  .catch(async (err) => {
    console.error('[tenants] fatal:', err.message);
    try { await client.end(); } catch { /* ignore */ }
    process.exit(1);
  });
