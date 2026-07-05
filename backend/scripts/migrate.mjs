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
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

const migrationsDir = fileURLToPath(new URL('../../database/migrations', import.meta.url));
const seedsDir = fileURLToPath(new URL('../../database/seeds', import.meta.url));
// Prisma-generated baseline DDL for the global app tables. Applied through the
// same tracked runner as every other migration (NOT via `prisma db push` /
// `migrate deploy`), so Prisma's migration engine never reconciles or drops the
// raw-SQL global tables (billing, schema_migrations, framework_data).
const prismaBaseline = fileURLToPath(
  new URL('../prisma/migrations/00000000000000_init/migration.sql', import.meta.url),
);
const PRISMA_BASELINE_VERSION = '001b_prisma_global';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[migrate] DATABASE_URL is required');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

// Version is the numeric filename prefix, e.g. "001_global_schema.sql" -> "001".
const versionOf = (file) => file.split('_')[0];

// Apply an SQL string atomically and record it in the migration ledger. A
// migration and its ledger insert commit (or roll back) together.
async function applySql(version, description, sql) {
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO global.schema_migrations (version, description) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
      [version, description],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[migrate] FAILED ${description}: ${err.message}`);
    throw err;
  }
}

async function applyFile(file) {
  const full = path.join(migrationsDir, file);
  const sql = await readFile(full, 'utf8');
  if (sql.includes('{{SCHEMA}}')) {
    // Safety net: tenant templates must never run through the global runner.
    console.log(`[migrate] skip   ${file} (tenant template — not a global migration)`);
    return false;
  }
  console.log(`[migrate] apply  ${file}`);
  await applySql(versionOf(file), file, sql);
  return true;
}

async function applyPrismaBaseline() {
  console.log('[migrate] apply  prisma baseline (global app tables)');
  const sql = await readFile(prismaBaseline, 'utf8');
  await applySql(PRISMA_BASELINE_VERSION, 'Prisma global baseline (generated from schema.prisma)', sql);
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

  // 1. Bootstrap (schemas/extensions/roles) must exist before anything else.
  if (bootstrap && !applied.has('001')) {
    if (await applyFile(bootstrap)) count++;
  } else if (bootstrap) {
    console.log(`[migrate] skip   ${bootstrap}`);
  }

  // 2. Prisma-owned global app tables (users, tenants, sessions, …). Applied
  //    from the generated baseline through the tracked runner exactly once.
  if (!applied.has(PRISMA_BASELINE_VERSION)) {
    await applyPrismaBaseline();
    count++;
  } else {
    console.log('[migrate] skip   prisma baseline (global app tables)');
  }

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
