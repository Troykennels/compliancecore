#!/usr/bin/env node
/**
 * Grant or revoke platform superadmin.
 *
 * Superadmin is a single boolean on global.users and gates every /api/billing/admin
 * route (see requireSuperadmin in src/middleware/rbac.middleware.ts). There is no
 * in-app way to grant it — deliberately, since it is the platform-owner role that
 * can see and edit every tenant's billing — so this script is the supported path.
 *
 *   node scripts/grant-superadmin.mjs you@company.com
 *   node scripts/grant-superadmin.mjs you@company.com --revoke
 *   node scripts/grant-superadmin.mjs --list
 *
 * Requires DATABASE_URL.
 */
import pg from 'pg';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[superadmin] DATABASE_URL is required');
  process.exit(1);
}

const args = process.argv.slice(2);
const list = args.includes('--list');
const revoke = args.includes('--revoke');
const email = args.find((a) => !a.startsWith('--'));

if (!list && !email) {
  console.error('[superadmin] usage: node scripts/grant-superadmin.mjs <email> [--revoke] | --list');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

try {
  await client.connect();

  if (list) {
    const { rows } = await client.query(
      `SELECT email, is_superadmin FROM global.users WHERE is_superadmin = true ORDER BY email`,
    );
    if (!rows.length) {
      console.log('[superadmin] none — no account can currently reach the owner console');
    } else {
      console.log(`[superadmin] ${rows.length} account(s):`);
      rows.forEach((r) => console.log(`  ${r.email}`));
    }
    process.exit(0);
  }

  // Match case-insensitively: emails are stored as entered at registration, and
  // an owner typing their own address in a different case should still resolve.
  const { rows } = await client.query(
    `UPDATE global.users SET is_superadmin = $1, updated_at = NOW()
     WHERE lower(email) = lower($2)
     RETURNING email, is_superadmin`,
    [!revoke, email],
  );

  if (!rows.length) {
    console.error(`[superadmin] no user found with email "${email}"`);
    console.error('[superadmin] the account must have registered first');
    process.exit(1);
  }

  const verb = revoke ? 'revoked from' : 'granted to';
  console.log(`[superadmin] ${verb} ${rows[0].email} (is_superadmin=${rows[0].is_superadmin})`);
  if (!revoke) {
    console.log('[superadmin] sign out and back in — the flag is read per request, but a');
    console.log('[superadmin] fresh login avoids any cached client-side role state.');
  }
} catch (err) {
  console.error('[superadmin] failed:', err.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
