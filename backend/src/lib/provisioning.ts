import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { env } from '../config/env';
import { tenantSchemaName } from './prisma';
import { logger } from './logger';

// Tenant-table templates live at repo-root/database/tenant-template. __dirname
// resolves correctly both in dev (src/lib) and in the built CommonJS image
// (backend/dist/lib, with database copied to /app/database).
const templateDir = path.join(__dirname, '../../../database/tenant-template');

const SAFE_SCHEMA_RE = /^tenant_[a-f0-9]{32}$/;

/**
 * Provision a brand-new tenant schema: create the schema and apply every
 * per-tenant table template (branches, departments, evidence, controls,
 * calendar, expiry, notifications, approvals, tasks, escalations, signatures…)
 * with {{SCHEMA}} substituted for the tenant schema name.
 *
 * Runs on a dedicated pg connection inside a single transaction so partial
 * provisioning never leaves a half-built tenant schema. Idempotent: templates
 * use CREATE TABLE IF NOT EXISTS, so re-running is safe (e.g. backfill).
 */
export async function provisionTenantSchema(schemaName: string): Promise<void> {
  if (!SAFE_SCHEMA_RE.test(schemaName)) {
    throw new Error(`Refusing to provision unsafe schema name: "${schemaName}"`);
  }

  const files = (await readdir(templateDir)).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    throw new Error(`No tenant templates found in ${templateDir}`);
  }

  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    // Read every template up front, then send the whole thing as ONE statement
    // batch. Provisioning is on the critical path of the signup request, and on
    // a managed/remote Postgres the per-round-trip latency dominates: seven
    // sequential round-trips is what pushes onboarding past a PaaS gateway
    // timeout, at which point the browser gives up while the server commits
    // anyway. One round-trip keeps the request comfortably inside the budget.
    // Still a single transaction, so partial provisioning remains impossible.
    const templates = await Promise.all(
      files.map(async (file) => {
        const raw = await readFile(path.join(templateDir, file), 'utf8');
        return raw.split('{{SCHEMA}}').join(schemaName);
      }),
    );

    // schemaName is validated against SAFE_SCHEMA_RE above, so interpolation is safe.
    await client.query(
      ['BEGIN', `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`, ...templates, 'COMMIT'].join(';\n'),
    );
    logger.info({ schemaName, templates: files.length }, 'Provisioned tenant schema');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error({ err, schemaName }, 'Tenant schema provisioning failed');
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

/** Best-effort teardown used when tenant creation fails after provisioning. */
export async function dropTenantSchema(schemaName: string): Promise<void> {
  if (!SAFE_SCHEMA_RE.test(schemaName)) return;
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  try {
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } catch (err) {
    logger.error({ err, schemaName }, 'Failed to drop tenant schema during rollback');
  } finally {
    await client.end().catch(() => {});
  }
}

// Re-export for callers that create a tenant and need its schema name.
export { tenantSchemaName };
