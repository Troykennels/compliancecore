import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

// These tests exercise the real migration + provisioning path against a live
// Postgres. They run only when TEST_DATABASE_URL is set (CI provides a service
// container; locally: TEST_DATABASE_URL=... npm test). They are the regression
// net for the deploy blockers: framework seeding (B2), tenant provisioning
// (B1 + the 007 immutable-index fix), and the migrate-safe-no-drop guarantee (B4).

const TEST_DB = process.env.TEST_DATABASE_URL;
const backendDir = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(backendDir, '..');
const templateDir = path.join(repoRoot, 'database', 'tenant-template');

const SCHEMA_A = 'tenant_' + 'a'.repeat(32);
const SCHEMA_B = 'tenant_' + 'b'.repeat(32);

async function applyTemplates(client: pg.Client, schema: string) {
  const files = (await readdir(templateDir)).filter((f) => f.endsWith('.sql')).sort();
  // Concatenate all templates into ONE statement so provisioning is a single
  // round-trip (Docker-on-Windows round-trip latency can be seconds per query).
  const parts = await Promise.all(
    files.map((f) => readFile(path.join(templateDir, f), 'utf8')),
  );
  const combined = parts.join('\n').split('{{SCHEMA}}').join(schema);
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"; BEGIN; ${combined}; COMMIT;`);
}

describe.skipIf(!TEST_DB)('database migrations & multi-tenant isolation', () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: TEST_DB });
    await client.connect();
    // Clean slate.
    await client.query(`DROP SCHEMA IF EXISTS global CASCADE`);
    await client.query(`DROP SCHEMA IF EXISTS framework_data CASCADE`);
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA_A}" CASCADE`);
    await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA_B}" CASCADE`);
    // Run the real migration runner (applies bootstrap + Prisma baseline + deltas + seeds).
    execFileSync('node', ['scripts/migrate.mjs', '--seed'], {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: TEST_DB },
      stdio: 'pipe',
      timeout: 60_000, // fail fast rather than block vitest forever
    });
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  it('creates the global app tables', async () => {
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='global'`,
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(expect.arrayContaining(['users', 'tenants', 'sessions', 'refresh_tokens', 'schema_migrations']));
  });

  it('seeds framework reference data (B2)', async () => {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM framework_data.frameworks');
    expect(rows[0].n).toBeGreaterThanOrEqual(18);
  });

  it('provisions a tenant schema with all tables + partial unique indexes (B1/007)', async () => {
    await applyTemplates(client, SCHEMA_A);
    const { rows: tbls } = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema=$1`, [SCHEMA_A],
    );
    expect(tbls[0].n).toBeGreaterThan(20);
    const { rows: idx } = await client.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND indexname IN
         ('uq_evidence_categories_name','uq_signatures_valid_per_signer')`, [SCHEMA_A],
    );
    expect(idx.map((r) => r.indexname).sort()).toEqual(['uq_evidence_categories_name', 'uq_signatures_valid_per_signer']);
  });

  it('isolates data between tenant schemas', async () => {
    await applyTemplates(client, SCHEMA_B);
    await client.query(`INSERT INTO "${SCHEMA_A}".evidence_categories(name) VALUES('MARKER_A')`);
    await client.query(`INSERT INTO "${SCHEMA_B}".evidence_categories(name) VALUES('MARKER_B')`);

    const a = await client.query(`SELECT name FROM "${SCHEMA_A}".evidence_categories WHERE name LIKE 'MARKER_%'`);
    const b = await client.query(`SELECT name FROM "${SCHEMA_B}".evidence_categories WHERE name LIKE 'MARKER_%'`);
    expect(a.rows.map((r) => r.name)).toEqual(['MARKER_A']);
    expect(b.rows.map((r) => r.name)).toEqual(['MARKER_B']);
  });

  it('does NOT drop unmanaged global tables on a migrate re-run (B4)', async () => {
    await client.query(`CREATE TABLE IF NOT EXISTS global.billing_probe(id serial primary key, note text)`);
    await client.query(`INSERT INTO global.billing_probe(note) VALUES('must-survive')`);
    execFileSync('node', ['scripts/migrate.mjs'], {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: TEST_DB },
      stdio: 'pipe',
      timeout: 60_000, // fail fast rather than block vitest forever
    });
    const { rows } = await client.query(`SELECT note FROM global.billing_probe`);
    expect(rows.map((r) => r.note)).toContain('must-survive');
  });
});
