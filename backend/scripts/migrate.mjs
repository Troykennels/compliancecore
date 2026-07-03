#!/usr/bin/env node
/**
 * Global-schema migration runner for ComplianceCore.
 *
 * Bootstrap order for a fresh database:
 *   1. Apply migration 001 (schemas, extensions, roles, schema_migrations).
 *   2. `prisma db push` — creates/syncs all Prisma-owned GLOBAL tables
 *      (users, tenants, tenant_memberships, sessions, refresh_tokens,
 *      mfa_credentials, api_keys, webhooks, …). The Prisma schema is the source
 *      of truth for these; hand-written SQL is NOT kept in sync for them.
 *   3. Apply remaining global migrations (002+) — idempotent deltas/indexes.
 *
 * Per-tenant tables are NOT handled here — they live in database/tenant-template/
 * and are applied per tenant by the provisioning service (src/lib/provisioning.ts)
 * when a tenant is created.
 *
 *   node scripts/migrate.mjs              # apply pending global migrations
 *   node scripts/migrate.mjs --seed       # also (re)apply seed files
 *
 * Requires DATABASE_URL. Depends on the `pg` package and the Prisma CLI.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

const migrationsDir = fileURLToPath(new URL('../../database/migrations', import.meta.url));
const seedsDir = fileURLToPath(new URL('../../database/seeds', import.meta.url));
const backendDir = fileURLToPath(new URL('..', import.meta.url));
const prismaSchema = fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[migrate] DATABASE_URL is required');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

// Version is the numeric filename prefix, e.g. "001_global_schema.sql" -> "001".
const versionOf = (file) => file.split('_')[0];

async function applyFile(file) {
  const full = path.join(migrationsDir, file);
  const sql = await readFile(full, 'utf8');
  if (sql.includes('{{SCHEMA}}')) {
    // Safety net: tenant templates must never run through the global runner.
    console.log(`[migrate] skip   ${file} (tenant template — not a global migration)`);
    return false;
  }
  console.log(`[migrate] apply  ${file}`);
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO global.schema_migrations (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
      [versionOf(file), file],
    );
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[migrate] FAILED ${file}: ${err.message}`);
    throw err;
  }
}

function prismaDbPush() {
  console.log('[migrate] prisma db push — syncing global Prisma tables');
  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'db', 'push', '--skip-generate', `--schema=${prismaSchema}`],
    { cwd: backendDir, stdio: 'inherit', env: process.env },
  );
}

async function main() {
  await client.connect();

  await client.query('CREATE SCHEMA IF NOT EXISTS global');
  await client.query(`
    CREATE TABLE IF NOT EXISTS global.schema_migrations (
      version     VARCHAR(50)  NOT NULL,
      description VARCHAR(255) NOT NULL,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT pk_schema_migrations PRIMARY KEY (version)
    )`);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await client.query('SELECT version FROM global.schema_migrations');
  const applied = new Set(rows.map((r) => r.version));

  const bootstrap = files.find((f) => versionOf(f) === '001');
  const rest = files.filter((f) => f !== bootstrap);

  let count = 0;

  // 1. Bootstrap (schemas/extensions/roles) must exist before Prisma push.
  if (bootstrap && !applied.has('001')) {
    if (await applyFile(bootstrap)) count++;
  } else if (bootstrap) {
    console.log(`[migrate] skip   ${bootstrap}`);
  }

  // 2. Prisma owns the global tables — create/sync them. Idempotent.
  prismaDbPush();

  // 3. Remaining global deltas (indexes, added columns) in filename order.
  for (const file of rest) {
    if (applied.has(versionOf(file))) {
      console.log(`[migrate] skip   ${file}`);
      continue;
    }
    if (await applyFile(file)) count++;
  }

  console.log(`[migrate] done — ${count} new migration(s) applied`);

  if (process.env.RUN_SEEDS === 'true' || process.argv.includes('--seed')) {
    let seeds = [];
    try {
      seeds = (await readdir(seedsDir)).filter((f) => f.endsWith('.sql')).sort();
    } catch {
      console.log('[seed]    no seeds directory — skipping');
    }
    for (const file of seeds) {
      const sql = await readFile(path.join(seedsDir, file), 'utf8');
      console.log(`[seed]    apply  ${file}`);
      await client.query(sql);
    }
    if (seeds.length) console.log(`[seed]    done — ${seeds.length} seed file(s) applied`);
  }
}

main()
  .then(() => client.end())
  .catch(async (err) => {
    console.error('[migrate] fatal:', err.message);
    try { await client.end(); } catch { /* ignore */ }
    process.exit(1);
  });
