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
    await client.query('BEGIN');
    // schemaName is validated against SAFE_SCHEMA_RE above, so interpolation is safe.
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    for (const file of files) {
      const raw = await readFile(path.join(templateDir, file), 'utf8');
      const sql = raw.split('{{SCHEMA}}').join(schemaName);
      await client.query(sql);
    }

    await client.query('COMMIT');
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
