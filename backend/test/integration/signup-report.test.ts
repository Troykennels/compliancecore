import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Server } from 'node:http';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('platform signup and trial directory', () => {
  let client: pg.Client, server: Server, base: string;
  let owner: string, prospect: string, orphan: string;
  beforeAll(async () => {
    const target = new URL(url!);
    if (!['localhost','127.0.0.1'].includes(target.hostname) || !target.pathname.startsWith('/compliance_renewal_task_')) throw Error('Dedicated local disposable database required');
    process.env.DATABASE_URL = url;
    client = new pg.Client({ connectionString: url }); await client.connect();
    await client.query('DROP SCHEMA IF EXISTS global CASCADE');
    await client.query('DROP SCHEMA IF EXISTS framework_data CASCADE');
    execFileSync('node', ['scripts/migrate.mjs'], { cwd: path.resolve(__dirname, '../..'), env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
    const { initBillingTables } = await import('../../src/modules/billing/billing.repository'); await initBillingTables();
    async function person(email: string, verified: boolean, admin = false) {
      return (await client.query(`INSERT INTO global.users(email,password_hash,first_name,last_name,email_verified_at,is_superadmin,updated_at) VALUES ($1,'DO-NOT-RETURN','Fixture','Person',CASE WHEN $2 THEN NOW() END,$3,NOW()) RETURNING id`, [email,verified,admin])).rows[0].id as string;
    }
    owner = await person('owner@example.invalid', true, true);
    prospect = await person('prospect@example.invalid', true);
    orphan = await person('not-finished@example.invalid', false);
    await person('maildiag3@example.com', false);
    const tenant = (await client.query(`INSERT INTO global.tenants(name,slug,schema_name,updated_at) VALUES ('Signup Fixture','signup-fixture','tenant_'||repeat('f',32),NOW()) RETURNING id`)).rows[0].id;
    await client.query(`INSERT INTO global.tenant_memberships(user_id,tenant_id,role) VALUES ($1,$2,'owner')`, [prospect,tenant]);
    const plan = (await client.query(`SELECT id FROM global.subscription_plans WHERE slug='professional'`)).rows[0].id;
    await client.query(`INSERT INTO global.subscriptions(tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end,trial_ends_at,next_invoice_amount,currency) VALUES ($1,$2,'trial','monthly',NOW()-interval '20 days',NOW()-interval '6 days',NOW()-interval '6 days',85000,'NGN')`, [tenant,plan]);
    const granted = (await client.query(`INSERT INTO global.tenants(name,slug,schema_name,updated_at) VALUES ('Granted Access Fixture','granted-fixture','tenant_'||repeat('e',32),NOW()) RETURNING id`)).rows[0].id;
    await client.query(`INSERT INTO global.tenant_memberships(user_id,tenant_id,role) VALUES ($1,$2,'owner')`,[owner,granted]);
    await client.query(`INSERT INTO global.subscriptions(tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end,trial_ends_at,next_invoice_amount,currency) VALUES ($1,$2,'trial','monthly',NOW()-interval '20 days',NOW()+interval '30 days',NOW()-interval '6 days',85000,'NGN')`,[granted,plan]);
    const { requireSuperadmin } = await import('../../src/middleware/rbac.middleware');
    const { adminSignups, updateSignupFollowup } = await import('../../src/modules/billing/signup-report');
    const { asyncHandler } = await import('../../src/lib/asyncHandler');
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { const id = req.header('x-fixture-user'); if (id) req.user = { id } as Request['user']; next(); });
    app.get('/signups', requireSuperadmin, asyncHandler(adminSignups));
    app.patch('/signups/:id', requireSuperadmin, asyncHandler(updateSignupFollowup));
    app.use((err: { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => res.status(err.statusCode || 500).json({ error: 'Request rejected' }));
    server = await new Promise<Server>(resolve => { const s = app.listen(0,'127.0.0.1',()=>resolve(s)); });
    const address = server.address(); if (!address || typeof address === 'string') throw Error('Missing local address'); base = `http://127.0.0.1:${address.port}`;
  }, 120000);
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await client?.end(); const {prisma} = await import('../../src/config/database'); await prisma.$disconnect(); });
  const headers = () => ({ 'x-fixture-user': owner, 'Content-Type': 'application/json' });
  it('includes unverified users without organisations and never returns auth secrets', async () => {
    const response = await fetch(base+'/signups',{headers:headers()});expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');
    const result = (await response.json()).data;
    expect(result.total).toBe(4);expect(result.summary.unverified).toBe(2);expect(result.summary.activeTrials).toBe(0);expect(result.summary.expiredTrials).toBe(1);
    expect(result.records.find((r: {id:string})=>r.id===orphan).organisations).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/DO-NOT-RETURN|password_hash|token_hash|ip_address/);
    expect(result.records.find((r: {email:string})=>r.email==='maildiag3@example.com').evidence.category).toBe('test_pattern');
    expect(result.records.find((r: {id:string})=>r.id===prospect).evidence.category).toBe('unclassified');
  });
  it('filters across organisation, verification and expired trials with correct pagination', async () => {
    const report = async (q:string) => (await (await fetch(base+'/signups?'+q,{headers:headers()})).json()).data;
    expect((await report('search=Signup%20Fixture')).total).toBe(1);
    expect((await report('stage=unverified')).total).toBe(2);
    expect((await report('stage=expired_trial')).records[0].id).toBe(prospect);
    expect((await report('stage=trial')).total).toBe(0);
    const page = await report('pageSize=1&page=2');expect(page.records).toHaveLength(1);expect(page.total).toBe(4);
    expect((await report('search=%25')).total).toBe(0);
    expect((await fetch(base+'/signups?stage=__proto__',{headers:headers()})).status).toBe(422);
  });
  it('blocks other customer owners and an immediately demoted platform owner', async () => {
    expect((await fetch(base+'/signups',{headers:{'x-fixture-user':prospect}})).status).toBe(403);
    expect((await fetch(base+'/signups/'+orphan,{method:'PATCH',headers:{'x-fixture-user':prospect,'Content-Type':'application/json'},body:JSON.stringify({status:'test'})})).status).toBe(403);
    await client.query('UPDATE global.users SET is_superadmin=false WHERE id=$1',[owner]);
    expect((await fetch(base+'/signups',{headers:headers()})).status).toBe(403);
    await client.query('UPDATE global.users SET is_superadmin=true WHERE id=$1',[owner]);
  });
  it('saves owner notes without changing the registered user or contacting anyone', async () => {
    const body={status:'contacted',notes:'Owner spoke to this organisation.',followUpOn:'2026-12-01'};
    expect((await fetch(base+'/signups/'+prospect,{method:'PATCH',headers:headers(),body:JSON.stringify(body)})).status).toBe(200);
    const result=(await (await fetch(base+'/signups?followup=contacted',{headers:headers()})).json()).data;
    expect(result.total).toBe(1);expect(result.records[0].followup.notes).toBe(body.notes);
    expect((await client.query('SELECT is_active,deleted_at FROM global.users WHERE id=$1',[prospect])).rows[0]).toEqual({is_active:true,deleted_at:null});
    expect((await fetch(base+'/signups/'+prospect,{method:'PATCH',headers:headers(),body:JSON.stringify({...body,followUpOn:'2026-02-31'})})).status).toBe(422);
  });
});
