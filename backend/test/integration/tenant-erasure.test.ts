import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

/**
 * Erasing an organisation, against a live Postgres.
 *
 * This is the most destructive operation in the product, so the cases that
 * matter most are the ones where it must NOT act: a tenant still inside its
 * grace window, and a tenant that was never scheduled at all. A test that only
 * proved deletion works would be worse than none — it would pass just as
 * happily if the job deleted everything on sight.
 */

const TEST_DB = process.env.TEST_DATABASE_URL;
const backendDir = path.resolve(__dirname, '../..');

describe.skipIf(!TEST_DB)('tenant erasure', () => {
  let client: pg.Client;
  let tenantId: string;
  let schemaName: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    client = new pg.Client({ connectionString: TEST_DB });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS global CASCADE`);
    await client.query(`DROP SCHEMA IF EXISTS framework_data CASCADE`);
    execFileSync('node', ['scripts/migrate.mjs'], { cwd: backendDir, env: { ...process.env, DATABASE_URL: TEST_DB } });
    const { initBillingTables } = await import('../../src/modules/billing/billing.repository');
    await initBillingTables();
  }, 120_000);

  afterAll(async () => { await client?.end(); });

  beforeEach(async () => {
    schemaName = 'tenant_' + 'e'.repeat(32);
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await client.query(`DELETE FROM global.tenants WHERE slug LIKE 'erase-%'`);

    tenantId = (await client.query(
      `INSERT INTO global.tenants (name, slug, schema_name, updated_at)
       VALUES ('Erase Co', 'erase-' || substr(md5(random()::text),1,8), $1, NOW())
       RETURNING id`, [schemaName])).rows[0].id;

    // A schema with something in it, so "was the data actually removed" is a
    // real question rather than a vacuous one.
    await client.query(`CREATE SCHEMA "${schemaName}"`);
    await client.query(`CREATE TABLE "${schemaName}".evidence (id int)`);
    await client.query(`INSERT INTO "${schemaName}".evidence VALUES (1)`);
  });

  async function schemaExists() {
    const r = await client.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`, [schemaName]);
    return r.rowCount === 1;
  }

  async function tenantRow() {
    const r = await client.query(
      `SELECT deleted_at, is_active, purge_after FROM global.tenants WHERE id = $1::uuid`, [tenantId]);
    return r.rows[0];
  }

  it('request stops access immediately but destroys nothing yet', async () => {
    const { requestErasure } = await import('../../src/lib/tenant-erasure');
    const { purgeAfter } = await requestErasure(tenantId);

    const row = await tenantRow();
    expect(row.deleted_at).not.toBeNull();
    expect(row.is_active).toBe(false);
    // Roughly 30 days out — the window the DPA promises for exporting data.
    const days = Math.round((new Date(purgeAfter).getTime() - Date.now()) / 86_400_000);
    expect(days).toBe(30);

    // The data is still there. That is the whole point of the grace period.
    expect(await schemaExists()).toBe(true);
  }, 60_000);

  it('does NOT purge a tenant still inside its grace window', async () => {
    const { requestErasure, purgeDueTenants } = await import('../../src/lib/tenant-erasure');
    await requestErasure(tenantId);

    const { purged } = await purgeDueTenants();
    expect(purged).toBe(0);
    expect(await schemaExists()).toBe(true);
    expect(await tenantRow()).toBeDefined();
  }, 60_000);

  it('does NOT purge a tenant that was never scheduled', async () => {
    const { purgeDueTenants } = await import('../../src/lib/tenant-erasure');
    const { purged } = await purgeDueTenants();
    expect(purged).toBe(0);
    expect(await schemaExists()).toBe(true);
  }, 60_000);

  it('purges once the window has passed, removing the schema and the row', async () => {
    const { requestErasure, purgeDueTenants } = await import('../../src/lib/tenant-erasure');
    await requestErasure(tenantId);
    await client.query(
      `UPDATE global.tenants SET purge_after = NOW() - interval '1 day' WHERE id = $1::uuid`, [tenantId]);

    const { purged, failed } = await purgeDueTenants();
    expect(failed).toBe(0);
    expect(purged).toBe(1);

    expect(await schemaExists()).toBe(false);
    const r = await client.query(`SELECT 1 FROM global.tenants WHERE id = $1::uuid`, [tenantId]);
    expect(r.rowCount).toBe(0);
  }, 60_000);

  it('can be cancelled inside the window, and not after', async () => {
    const { requestErasure, cancelErasure } = await import('../../src/lib/tenant-erasure');
    await requestErasure(tenantId);

    expect(await cancelErasure(tenantId)).toBe(true);
    const restored = await tenantRow();
    expect(restored.deleted_at).toBeNull();
    expect(restored.is_active).toBe(true);
    expect(restored.purge_after).toBeNull();

    // Past the window there is nothing left to restore, so it must refuse
    // rather than quietly reviving a tenant mid-purge.
    await requestErasure(tenantId);
    await client.query(
      `UPDATE global.tenants SET purge_after = NOW() - interval '1 day' WHERE id = $1::uuid`, [tenantId]);
    expect(await cancelErasure(tenantId)).toBe(false);
  }, 60_000);
});
