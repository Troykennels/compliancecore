// Billing schema creation belongs to the provisioning identity, never the API role.
// Existing installations are checked only; prices and contracts are not rewritten.
import pg from 'pg';
import fs from 'node:fs/promises';
const connectionString=process.env.PROVISIONING_DATABASE_URL??process.env.DATABASE_URL;
if(!connectionString)throw new Error('A provisioning database connection is required.');
const client=new pg.Client({connectionString});await client.connect();
try {
 const required=['subscription_plans','coupons','subscriptions','payment_methods','invoices','usage_records','coupon_redemptions','plan_prices','payment_transactions','subscription_reminders','tenant_onboarding','recurring_consents','renewal_attempts'];
 const result=await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='global' AND table_name=ANY($1::text[])",[required]);
 if(result.rowCount===required.length){console.log('[billing-bootstrap] Existing billing schema verified; commercial records unchanged.');}
 else if(result.rowCount){throw new Error('Billing schema is incomplete. Restore or repair the missing tables with an operator before starting the API.');}
 else {
  process.env.DATABASE_URL=connectionString;
  const {initBillingTables}=await import('../dist/modules/billing/billing.repository.js');
  const {prisma}=await import('../dist/lib/prisma.js');
  try{await initBillingTables();await client.query(await fs.readFile(new URL('../../database/migrations/014_global_compliance_history.sql',import.meta.url),'utf8'));console.log('[billing-bootstrap] Fresh billing schema prepared through provisioning connection.');}finally{await prisma.$disconnect();}
 }
}finally{await client.end();}
