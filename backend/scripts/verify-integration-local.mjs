import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import pg from 'pg';

// This database is separate from the presentation app. The existing integration
// tests recreate their schemas; they must never run against a customer database.
const databaseName = 'compliance_renewal_task_ux_utf8_20261031';
const port=process.env.COMPLIANCE_TEST_PG_PORT??'55443';
if(!['55443','55444'].includes(port))throw new Error('Only isolated local verification clusters are allowed.');
const role=port==='55444'?'compliance_restore':'compliance_test';
const database = `postgresql://${role}@127.0.0.1:${port}/${databaseName}`;
const admin = new pg.Client({ connectionString: `postgresql://${role}@127.0.0.1:${port}/postgres` });
await admin.connect();
try {
  if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount) {
    await admin.query(`CREATE DATABASE "${databaseName}" ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
  }
} finally { await admin.end(); }
const secrets = JSON.parse(await fs.readFile(path.join(os.tmpdir(), 'compliance-presentation-20261023/private-env.json'), 'utf8'));
const env = {
  ...process.env, ...secrets,
  NODE_ENV: 'test', DATABASE_URL: database, TEST_DATABASE_URL: database,
  PORT: '3018', FRONTEND_URL: 'http://127.0.0.1:5188', ENABLE_REDIS: 'false', REDIS_URL: 'redis://127.0.0.1:1',
  SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'fixture', SMTP_PASS: 'fixture',
  EMAIL_FROM: 'Fixture <fixture@example.invalid>', EMAIL_REPLY_TO: 'fixture@example.invalid',
  AWS_ACCESS_KEY_ID: 'fixture', AWS_SECRET_ACCESS_KEY: 'fixture', AWS_S3_BUCKET: 'fixture', AWS_REGION: 'eu-west-1',
  AWS_S3_ENDPOINT: 'http://127.0.0.1:1', AWS_S3_FORCE_PATH_STYLE: 'true', GROQ_API_KEY: 'fixture-disabled',
};
for (const key of ['PROVISIONING_DATABASE_URL', 'BREVO_API_KEY', 'PAYSTACK_SECRET_KEY', 'PAYSTACK_PUBLIC_KEY', 'SENDGRID_API_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'BILLING_NOTIFY_EMAIL', 'RENEWAL_DASHBOARD_API_KEY']) delete env[key];
console.log('Running unit and database integration tests against the dedicated local UX database. External fetch and email transports are disabled.');
const child = spawn(process.execPath, ['--import', new URL('./fixture-network-guard.mjs', import.meta.url).href, 'node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2), '--reporter=dot'], { env, stdio: 'inherit', windowsHide: true });
child.on('exit', code => { process.exitCode = code ?? 1; });
