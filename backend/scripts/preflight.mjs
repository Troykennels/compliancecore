#!/usr/bin/env node
/**
 * Go-live preflight for ComplianceCore.
 *
 *   node scripts/preflight.mjs
 *
 * Answers one question: if I deploy right now, what actually breaks?
 *
 * It does not just check that variables are *set* — a wrong key is far more
 * common than a missing one, and fails much later and more confusingly. So it
 * calls Groq and Paystack for real, checks the database is migrated, and
 * verifies the tenant schemas are up to date.
 *
 * Never prints a secret. Values are shown as a length and a short fingerprint
 * so two environments can be compared without exposing anything.
 */
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const results = [];
const add = (level, area, message, fix) => results.push({ level, area, message, fix });
const ok    = (area, message)      => add('ok',   area, message);
const warn  = (area, message, fix) => add('warn', area, message, fix);
const fail  = (area, message, fix) => add('fail', area, message, fix);

const fingerprint = (v) =>
  `len=${v.length} fp=${createHash('sha256').update(v).digest('hex').slice(0, 8)}`;

// ── Environment ──────────────────────────────────────────────────────────────
const REQUIRED = [
  'DATABASE_URL', 'REDIS_URL', 'JWT_PRIVATE_KEY_BASE64', 'JWT_PUBLIC_KEY_BASE64',
  'ENCRYPTION_KEY', 'COOKIE_SECRET', 'SIGNATURE_SECRET', 'FRONTEND_URL',
  'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET', 'GROQ_API_KEY',
];

for (const key of REQUIRED) {
  if (!process.env[key]) fail('env', `${key} is not set`, 'Set it in your host dashboard.');
}

if (process.env.NODE_ENV !== 'production') {
  warn('env', `NODE_ENV is "${process.env.NODE_ENV ?? 'unset'}", not "production"`,
    'Cookies are only marked Secure/SameSite=None in production.');
}
if (process.env.ENABLE_REDIS === 'false') {
  fail('env', 'ENABLE_REDIS=false — rate limits are per-process, cache is in-memory, background jobs are OFF',
    'Remove it in production. Reminders, escalations and renewals will not run.');
}
if (process.env.FRONTEND_URL?.endsWith('/')) {
  warn('env', 'FRONTEND_URL has a trailing slash — CORS origin matching is exact',
    'Drop the trailing slash or the browser blocks every request.');
}
if (process.env.FRONTEND_URL?.startsWith('http://') && process.env.NODE_ENV === 'production') {
  warn('env', 'FRONTEND_URL is http:// in production', 'SameSite=None cookies require HTTPS.');
}
if (!process.env.BILLING_NOTIFY_EMAIL) {
  warn('billing', 'BILLING_NOTIFY_EMAIL is not set',
    'Sale notifications go to whoever currently holds superadmin — a personal inbox.');
}
if (!process.env.BREVO_API_KEY && !process.env.SMTP_HOST) {
  fail('email', 'No BREVO_API_KEY and no SMTP_HOST — verification and receipt emails cannot send',
    'Railway blocks outbound SMTP; prefer BREVO_API_KEY (HTTPS).');
}

// ── Groq (AI hub) ────────────────────────────────────────────────────────────
if (process.env.GROQ_API_KEY) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) ok('ai', `GROQ_API_KEY accepted (${fingerprint(process.env.GROQ_API_KEY)})`);
    else fail('ai', `GROQ_API_KEY rejected with ${res.status} — all 6 AI tools will return 503`,
      'Generate a new key at console.groq.com and redeploy.');
  } catch (err) {
    warn('ai', `Could not reach Groq: ${err.message}`, 'Network issue, or the host blocks egress.');
  }
}

// ── Paystack ─────────────────────────────────────────────────────────────────
const sk = process.env.PAYSTACK_SECRET_KEY;
if (!sk) {
  warn('payments', 'PAYSTACK_SECRET_KEY not set — checkout returns 503 and nobody can pay',
    'Set the live secret key to start taking money.');
} else {
  if (sk.startsWith('sk_test_')) {
    warn('payments', 'Paystack is in TEST mode — real cards will not be charged',
      'Swap to the sk_live_ key when you are ready to sell.');
  }
  if (!process.env.PAYSTACK_PUBLIC_KEY) {
    warn('payments', 'PAYSTACK_PUBLIC_KEY not set — the checkout page cannot initialise');
  }
  try {
    // /transaction?perPage=1 is the cheapest authenticated call that proves the
    // key is live and the account is reachable.
    const res = await fetch('https://api.paystack.co/transaction?perPage=1', {
      headers: { Authorization: `Bearer ${sk}` },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) ok('payments', `Paystack key accepted (${sk.startsWith('sk_live_') ? 'LIVE' : 'test'} mode)`);
    else fail('payments', `Paystack rejected the key with ${res.status}`, 'Check you copied the whole key.');
  } catch (err) {
    warn('payments', `Could not reach Paystack: ${err.message}`);
  }

  const currencies = (process.env.PAYMENT_CURRENCIES ?? 'NGN,USD').split(',').map((c) => c.trim());
  if (currencies.includes('USD')) {
    warn('payments', 'USD is enabled in PAYMENT_CURRENCIES',
      'Paystack requires USD to be enabled per merchant. Until then a USD checkout fails with "Currency not supported by merchant". Confirm with Paystack support.');
  }
  warn('payments', 'Webhook must be registered manually',
    `Set it to <API_URL>/api/payments/webhook/paystack in the Paystack dashboard. Without it, a customer who closes the tab after paying never gets their plan.`);
}

// ── Database ─────────────────────────────────────────────────────────────────
if (process.env.DATABASE_URL) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    ok('database', 'Connected');

    const { rows: mig } = await client.query('SELECT version FROM global.schema_migrations');
    const applied = new Set(mig.map((r) => r.version));
    const dir = fileURLToPath(new URL('../../database/migrations', import.meta.url));
    const expected = (await readdir(dir)).filter((f) => f.endsWith('.sql')).map((f) => f.split('_')[0]);
    const missing = expected.filter((v) => !applied.has(v));
    if (missing.length) fail('database', `Global migrations not applied: ${missing.join(', ')}`, 'Run npm run db:migrate.');
    else ok('database', `All ${expected.length} global migrations applied`);

    // Framework library — the thing that makes adoption produce anything.
    const { rows: [lib] } = await client.query(
      'SELECT COUNT(*)::int AS n FROM framework_data.framework_controls');
    if (lib.n === 0) fail('content', 'Framework control library is EMPTY — adopting a framework will create nothing',
      'Run npm run db:seed.');
    else ok('content', `${lib.n} framework controls seeded`);

    // Per-tenant tables. Checks the newest template landed everywhere.
    const { rows: tenants } = await client.query(
      `SELECT schema_name FROM global.tenants WHERE deleted_at IS NULL AND schema_name IS NOT NULL`);
    if (tenants.length) {
      const { rows: [inc] } = await client.query(
        `SELECT COUNT(*)::int AS n FROM information_schema.tables
          WHERE table_name = 'incidents' AND table_schema = ANY($1::text[])`,
        [tenants.map((t) => t.schema_name)]);
      if (inc.n < tenants.length) {
        fail('database', `${tenants.length - inc.n} of ${tenants.length} tenants are missing the incidents table — /api/incidents will 500 for them`,
          'Run npm run db:migrate-tenants.');
      } else ok('database', `All ${tenants.length} tenant schemas are up to date`);
    } else ok('database', 'No tenants yet');
  } catch (err) {
    fail('database', `Database check failed: ${err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const icon = { ok: '  OK  ', warn: ' WARN ', fail: ' FAIL ' };
console.log('\nComplianceCore preflight\n' + '='.repeat(60));
for (const level of ['fail', 'warn', 'ok']) {
  for (const r of results.filter((x) => x.level === level)) {
    console.log(`[${icon[r.level]}] ${r.area.padEnd(9)} ${r.message}`);
    if (r.fix) console.log(`${' '.repeat(11)}-> ${r.fix}`);
  }
}
const fails = results.filter((r) => r.level === 'fail').length;
const warns = results.filter((r) => r.level === 'warn').length;
console.log('='.repeat(60));
console.log(`${fails} blocking, ${warns} to review, ${results.filter((r) => r.level === 'ok').length} good\n`);
process.exit(fails > 0 ? 1 : 0);
