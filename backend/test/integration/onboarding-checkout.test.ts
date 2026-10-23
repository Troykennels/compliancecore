import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import pg from 'pg';

const mocks=vi.hoisted(()=>({initialize:vi.fn(),verify:vi.fn(),email:vi.fn()}));
vi.mock('../../src/modules/payments/paystack.client',()=>({isPaystackConfigured:()=>true,initializeTransaction:(...args:unknown[])=>mocks.initialize(...args),verifyTransaction:(...args:unknown[])=>mocks.verify(...args),verifyWebhookSignature:()=>false,chargeAuthorization:vi.fn()}));
vi.mock('../../src/modules/payments/payment-emails',()=>({sendPaymentEmails:(...args:unknown[])=>mocks.email(...args)}));
vi.mock('bullmq',()=>({Queue:class{},Worker:class{}}));
vi.mock('../../src/config/redis',()=>({redisForQueues:{}}));

const DB=process.env.TEST_DATABASE_URL;
describe.skipIf(!DB)('commercial onboarding and recurring subscription settlement',()=>{
  let c:pg.Client,prisma:any,service:typeof import('../../src/modules/payments/payments.service'),quote:typeof import('../../src/modules/payments/checkout-quote').checkoutQuote;
  let plans:Record<string,string>;
  beforeAll(async()=>{
    const target=new URL(DB!);
    if(target.hostname!=='127.0.0.1'||!target.pathname.startsWith('/compliance_renewal_task_'))throw Error('Disposable database required');
    process.env.DATABASE_URL=DB;
    c=new pg.Client({connectionString:DB});await c.connect();
    await c.query('DROP SCHEMA IF EXISTS global CASCADE');await c.query('DROP SCHEMA IF EXISTS framework_data CASCADE');
    execFileSync(process.execPath,['scripts/migrate.mjs'],{cwd:path.resolve(__dirname,'../..'),env:{...process.env,DATABASE_URL:DB},stdio:'pipe'});
    const billing=await import('../../src/modules/billing/billing.repository');await billing.initBillingTables();
    ({prisma}=await import('../../src/config/database'));
    service=await import('../../src/modules/payments/payments.service');({checkoutQuote:quote}=await import('../../src/modules/payments/checkout-quote'));
    plans=Object.fromEntries((await c.query('SELECT slug,id FROM global.subscription_plans')).rows.map(r=>[r.slug,r.id]));
  },120000);
  afterAll(async()=>{await prisma?.$disconnect();await c?.end();});
  beforeEach(()=>{mocks.initialize.mockReset();mocks.verify.mockReset();mocks.email.mockReset();mocks.email.mockResolvedValue(undefined);mocks.initialize.mockImplementation(async(input:any)=>({authorization_url:`https://checkout.paystack.com/${input.reference}`}));});
  async function customer(){
    const id=crypto.randomUUID(),user=crypto.randomUUID();
    await c.query(`INSERT INTO global.users(id,email,password_hash,first_name,last_name,is_active,email_verified_at,updated_at) VALUES($1,$2,'test-only','Checkout','Fixture',true,now(),now())`,[user,`${user}@example.invalid`]);
    await c.query(`INSERT INTO global.tenants(id,name,slug,updated_at) VALUES($1,'Checkout fixture',$2,now())`,[id,`fixture-${id}`]);
    return {tenantId:id,userId:user,email:`${user}@example.invalid`,planId:plans.starter,currency:'NGN',billingCycle:'monthly' as const};
  }
  function verified(reference:string,amount:number,email:string){return {reference,status:'success',amount:Math.round(amount*100),currency:'NGN',paid_at:new Date().toISOString(),customer:{email},authorization:{authorization_code:'test-reusable-card',reusable:true,channel:'card',last4:'1234',brand:'visa'}};}

  it('prices all five tiers independently and gives exactly two subscription months free',async()=>{
    const rows=(await c.query(`SELECT slug,price_monthly,price_yearly,onboarding_fee FROM global.subscription_plans ORDER BY sort_order`)).rows;
    expect(rows.map(r=>[r.slug,Number(r.price_monthly),Number(r.price_yearly),Number(r.onboarding_fee)])).toEqual([
      ['starter',40000,400000,1500000],['professional',85000,850000,2000000],['business',180000,1800000,3500000],['enterprise',480000,4800000,5000000],['msp',800000,8000000,8000000],
    ]);
  });
  it('quotes onboarding plus the first month/year and blocks an unpriced currency bypass',async()=>{
    const input=await customer();
    expect(await quote(input)).toMatchObject({subscriptionAmount:40000,onboardingFee:1500000,total:1540000});
    expect(await quote({...input,billingCycle:'yearly'})).toMatchObject({subscriptionAmount:400000,onboardingFee:1500000,total:1900000});
    await expect(quote({...input,currency:'USD'})).rejects.toThrow();
  });
  it('does not discount onboarding when the subscription has a discount',async()=>{
    const input=await customer();
    await c.query(`INSERT INTO global.subscriptions(tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end,discount_percent,next_invoice_amount,currency) VALUES($1,$2,'trial','monthly',now(),now()+interval '14 days',10,36000,'NGN')`,[input.tenantId,input.planId]);
    expect(await quote(input)).toMatchObject({subscriptionAmount:36000,onboardingFee:1500000,total:1536000});
  });
  it('rejects a stale payment summary before contacting the provider',async()=>{
    const input=await customer();await expect(service.createCheckout({...input,expectedTotal:40000})).rejects.toThrow('summary changed');expect(mocks.initialize).not.toHaveBeenCalled();
  });
  it('reuses a pending first checkout instead of creating another onboarding charge',async()=>{
    const input=await customer();const first=await service.createCheckout(input),second=await service.createCheckout(input);
    expect(second.reference).toBe(first.reference);expect(mocks.initialize).toHaveBeenCalledTimes(1);
    await expect(service.createCheckout({...input,planId:plans.professional})).rejects.toThrow('already open');
  });
  it('underpayment grants neither onboarding nor subscription access',async()=>{
    const input=await customer(),checkout=await service.createCheckout(input);mocks.verify.mockResolvedValue(verified(checkout.reference,1500000,input.email));
    await expect(service.confirmByReference(input.tenantId,checkout.reference)).rejects.toThrow('amount did not match');
    expect((await c.query('SELECT * FROM global.tenant_onboarding WHERE tenant_id=$1',[input.tenantId])).rowCount).toBe(0);
    expect((await c.query('SELECT * FROM global.subscriptions WHERE tenant_id=$1',[input.tenantId])).rowCount).toBe(0);
  });
  it('settles once under concurrent replay, keeps onboarding out of renewal consent and invoices it separately',async()=>{
    const input=await customer(),checkout=await service.createCheckout({...input,recurringConsent:true});mocks.verify.mockResolvedValue(verified(checkout.reference,checkout.amount,input.email));
    await Promise.all([1,2,3].map(()=>service.confirmByReference(input.tenantId,checkout.reference)));
    const sub=(await c.query('SELECT * FROM global.subscriptions WHERE tenant_id=$1',[input.tenantId])).rows[0];
    expect(sub.status).toBe('active');expect(Number(sub.next_invoice_amount)).toBe(40000);
    const onboarding=(await c.query('SELECT * FROM global.tenant_onboarding WHERE tenant_id=$1',[input.tenantId])).rows;
    expect(onboarding).toHaveLength(1);expect(Number(onboarding[0].amount)).toBe(1500000);
    const invoices=(await c.query('SELECT * FROM global.invoices WHERE tenant_id=$1',[input.tenantId])).rows;
    expect(invoices).toHaveLength(1);expect(invoices[0].status).toBe('paid');expect(invoices[0].line_items.map((x:any)=>Number(x.amount))).toEqual([1500000,40000]);
    const consent=(await c.query('SELECT * FROM global.recurring_consents WHERE tenant_id=$1',[input.tenantId])).rows[0];expect(Number(consent.amount)).toBe(40000);
    expect(await quote(input)).toMatchObject({onboardingFee:0,total:40000});
    expect(await quote({...input,planId:plans.professional})).toMatchObject({onboardingFee:0,total:85000});
  });
  it('a ledger error rolls back the claim and entitlement, then the same verified reference can recover',async()=>{
    const input=await customer(),checkout=await service.createCheckout(input);mocks.verify.mockResolvedValue(verified(checkout.reference,checkout.amount,input.email));
    await c.query(`CREATE OR REPLACE FUNCTION global.fail_fixture_invoice() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.tenant_id='${input.tenantId}'::uuid THEN RAISE EXCEPTION 'fixture ledger failure'; END IF; RETURN NEW; END$$`);
    await c.query('CREATE TRIGGER fail_fixture_invoice BEFORE INSERT ON global.invoices FOR EACH ROW EXECUTE FUNCTION global.fail_fixture_invoice()');
    try {await expect(service.confirmByReference(input.tenantId,checkout.reference)).rejects.toThrow();} finally {await c.query('DROP TRIGGER fail_fixture_invoice ON global.invoices');}
    expect((await c.query('SELECT status FROM global.payment_transactions WHERE reference=$1',[checkout.reference])).rows[0].status).toBe('pending');
    expect((await c.query('SELECT * FROM global.subscriptions WHERE tenant_id=$1',[input.tenantId])).rowCount).toBe(0);
    expect((await c.query('SELECT * FROM global.tenant_onboarding WHERE tenant_id=$1',[input.tenantId])).rowCount).toBe(0);
    await expect(service.confirmByReference(input.tenantId,checkout.reference)).resolves.toMatchObject({status:'success'});
  });
  it('preserves an existing paid customer’s contracted price and remaining prepaid days',async()=>{
    const input=await customer(),end=new Date(Date.now()+20*86400000);
    await c.query(`INSERT INTO global.subscriptions(tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end,next_invoice_amount,currency) VALUES($1,$2,'active','monthly',now(),$3,25000,'NGN')`,[input.tenantId,input.planId,end]);
    await c.query(`INSERT INTO global.tenant_onboarding(tenant_id,status) VALUES($1,'grandfathered')`,[input.tenantId]);
    expect(await quote(input)).toMatchObject({onboardingFee:0,total:25000});
    const checkout=await service.createCheckout(input);mocks.verify.mockResolvedValue(verified(checkout.reference,25000,input.email));await service.confirmByReference(input.tenantId,checkout.reference);
    const sub=(await c.query('SELECT * FROM global.subscriptions WHERE tenant_id=$1',[input.tenantId])).rows[0];expect(Number(sub.next_invoice_amount)).toBe(25000);expect(+new Date(sub.current_period_start)).toBe(+end);expect(+new Date(sub.current_period_end)).toBeGreaterThan(+end);
  });
  it('prevents buying plans from the demonstration workspace',async()=>{
    const input=await customer();await c.query(`INSERT INTO global.tenant_onboarding(tenant_id,status) VALUES($1,'demo')`,[input.tenantId]);expect(await quote(input)).toMatchObject({previewOnly:true,total:1540000,onboardingFee:1500000});await expect(service.createCheckout(input)).rejects.toThrow('demonstration workspace');
  });
  it('clamps month-end and leap-day renewals without dropping prepaid time',async()=>{
    const {advancePeriod}=await import('../../src/modules/billing/billing.service');
    expect(advancePeriod(new Date('2027-01-31T12:00:00Z'),'monthly').toISOString()).toBe('2027-02-28T12:00:00.000Z');
    expect(advancePeriod(new Date('2028-02-29T12:00:00Z'),'yearly').toISOString()).toBe('2029-02-28T12:00:00.000Z');
  });
});
