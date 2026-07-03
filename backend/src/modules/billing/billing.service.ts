import PDFDocument from 'pdfkit';
import { withTenantSchema } from '../../lib/prisma';
import { prisma } from '../../config/database';
import { NotFoundError, AppError } from '../../lib/errors';
import * as repo from './billing.repository';
import type {
  SubscriptionPlan, Subscription, BillingOverview, UsageSummary,
  CreateSubscriptionDto, UpdateSubscriptionDto,
  AddPaymentMethodDto, CreateCouponDto, UpdateCouponDto, CreatePlanDto, UpdatePlanDto,
  CouponValidation, UpdateInvoiceDto, InvoiceListFilter, Invoice,
  UsageMetric, BillingCycle,
} from './billing.types';

// ── Helpers ────────────────────────────────────────────────────────────────────
function calcBasePrice(plan: SubscriptionPlan, cycle: BillingCycle): number {
  return cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
}

function applyDiscount(base: number, pct: number, fixed: number): number {
  const afterPct = base * (1 - pct / 100);
  return Math.max(0, afterPct - fixed);
}

function advancePeriod(date: Date, cycle: BillingCycle): Date {
  const d = new Date(date);
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

function periodStart(cycle: BillingCycle): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function periodEnd(start: Date, cycle: BillingCycle): Date {
  return advancePeriod(start, cycle);
}

const USAGE_LABELS: Record<UsageMetric, string> = {
  users: 'Team Members',
  frameworks: 'Frameworks',
  evidence_gb: 'Evidence Storage (GB)',
  branches: 'Branches',
  departments: 'Departments',
};

// ── Plans ──────────────────────────────────────────────────────────────────────
export async function getPublicPlans(): Promise<SubscriptionPlan[]> {
  return repo.findAllPlans({ publicOnly: true });
}

export async function getAllPlans(includeInactive = false): Promise<SubscriptionPlan[]> {
  return repo.findAllPlans({ includeInactive });
}

export async function getPlanById(id: string): Promise<SubscriptionPlan> {
  const plan = await repo.findPlanById(id);
  if (!plan) throw new NotFoundError('Plan', id);
  return plan;
}

export async function adminCreatePlan(dto: CreatePlanDto): Promise<SubscriptionPlan> {
  return repo.createPlan(dto);
}

export async function adminUpdatePlan(id: string, dto: UpdatePlanDto): Promise<SubscriptionPlan> {
  const plan = await repo.updatePlan(id, dto);
  if (!plan) throw new NotFoundError('Plan', id);
  return plan;
}

// ── Coupon Validation ──────────────────────────────────────────────────────────
export async function validateCoupon(code: string, planSlug: string, amount: number): Promise<CouponValidation> {
  const coupon = await repo.findCouponByCode(code);

  if (!coupon) return { valid: false, coupon: null, discountedAmount: null, message: 'Coupon not found' };
  if (!coupon.isActive) return { valid: false, coupon, discountedAmount: null, message: 'Coupon is no longer active' };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { valid: false, coupon, discountedAmount: null, message: 'Coupon has expired' };
  }
  if (coupon.maxUses !== null && coupon.usesCount >= coupon.maxUses) {
    return { valid: false, coupon, discountedAmount: null, message: 'Coupon has reached its usage limit' };
  }
  if (coupon.applicablePlanSlugs.length > 0 && !coupon.applicablePlanSlugs.includes(planSlug)) {
    return { valid: false, coupon, discountedAmount: null, message: 'Coupon is not applicable to this plan' };
  }
  if (amount < coupon.minAmount) {
    return { valid: false, coupon, discountedAmount: null, message: `Minimum amount is ${coupon.currency} ${coupon.minAmount}` };
  }

  const discountedAmount = coupon.discountType === 'percentage'
    ? Math.max(0, amount * (1 - coupon.discountValue / 100))
    : Math.max(0, amount - coupon.discountValue);

  return { valid: true, coupon, discountedAmount, message: 'Coupon applied successfully' };
}

// ── Subscription ───────────────────────────────────────────────────────────────
export async function getSubscription(tenantId: string): Promise<Subscription | null> {
  return repo.findSubscriptionByTenant(tenantId);
}

export async function createSubscription(tenantId: string, dto: CreateSubscriptionDto): Promise<Subscription> {
  const plan = await repo.findPlanById(dto.planId);
  if (!plan) throw new NotFoundError('Plan', dto.planId);

  const cycle: BillingCycle = dto.billingCycle ?? 'monthly';
  const trialDays = dto.trialDays ?? (plan.priceMonthly === 0 ? 0 : 14);
  const now = new Date();
  const start = periodStart(cycle);
  const end = periodEnd(start, cycle);
  const trialEndsAt = trialDays > 0 ? new Date(now.getTime() + trialDays * 86400_000) : null;

  let discountPercent = 0;
  let discountFixed = 0;
  let couponId: string | null = null;

  if (dto.couponCode) {
    const basePrice = calcBasePrice(plan, cycle);
    const validation = await validateCoupon(dto.couponCode, plan.slug, basePrice);
    if (!validation.valid || !validation.coupon) {
      throw new AppError(validation.message, 422, 'COUPON_INVALID');
    }
    couponId = validation.coupon.id;
    if (validation.coupon.discountType === 'percentage') {
      discountPercent = validation.coupon.discountValue;
    } else {
      discountFixed = validation.coupon.discountValue;
    }
  }

  const basePrice = calcBasePrice(plan, cycle);
  const nextInvoiceAmount = applyDiscount(basePrice, discountPercent, discountFixed);

  const sub = await repo.createSubscription({
    ...dto,
    tenantId,
    status: trialEndsAt ? 'trial' : (plan.priceMonthly === 0 ? 'active' : 'active'),
    billingCycle: cycle,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    trialEndsAt,
    couponId,
    discountPercent,
    discountFixed,
    nextInvoiceAmount,
    currency: plan.currency,
  });

  if (couponId) {
    await repo.incrementCouponUses(couponId);
    await repo.recordCouponRedemption(couponId, tenantId, sub.id);
  }

  // Generate initial invoice if paid plan
  if (plan.priceMonthly > 0 && !trialEndsAt) {
    await repo.createInvoice({
      tenantId,
      subscriptionId: sub.id,
      amountDue: nextInvoiceAmount,
      currency: plan.currency,
      billingPeriodStart: start,
      billingPeriodEnd: end,
      dueDate: new Date(start.getTime() + 7 * 86400_000),
      lineItems: [{ description: `${plan.name} — ${cycle} subscription`, quantity: 1, unitAmount: nextInvoiceAmount, amount: nextInvoiceAmount }],
    });
  }

  return sub;
}

export async function updateSubscription(tenantId: string, dto: UpdateSubscriptionDto): Promise<Subscription> {
  const existing = await repo.findSubscriptionByTenant(tenantId);
  if (!existing) throw new NotFoundError('Subscription');

  const fields: Record<string, unknown> = {};

  if (dto.cancelAtPeriodEnd !== undefined) {
    fields.cancel_at_period_end = dto.cancelAtPeriodEnd;
    if (!dto.cancelAtPeriodEnd) fields.cancelled_at = null;
  }

  if (dto.status !== undefined) {
    fields.status = dto.status;
    if (dto.status === 'cancelled') fields.cancelled_at = new Date();
  }

  if (dto.planId !== undefined && dto.planId !== existing.planId) {
    const plan = await repo.findPlanById(dto.planId);
    if (!plan) throw new NotFoundError('Plan', dto.planId);
    const cycle = dto.billingCycle ?? existing.billingCycle;
    const basePrice = calcBasePrice(plan, cycle);
    const nextAmount = applyDiscount(basePrice, existing.discountPercent, existing.discountFixed);
    fields.plan_id = dto.planId;
    fields.billing_cycle = cycle;
    fields.next_invoice_amount = nextAmount;
  } else if (dto.billingCycle !== undefined) {
    const plan = await repo.findPlanById(existing.planId);
    if (plan) {
      const basePrice = calcBasePrice(plan, dto.billingCycle);
      fields.billing_cycle = dto.billingCycle;
      fields.next_invoice_amount = applyDiscount(basePrice, existing.discountPercent, existing.discountFixed);
    }
  }

  const updated = await repo.updateSubscription(existing.id, fields);
  if (!updated) throw new NotFoundError('Subscription');
  return updated;
}

export async function applyCouponToSubscription(tenantId: string, code: string): Promise<Subscription> {
  const sub = await repo.findSubscriptionByTenant(tenantId);
  if (!sub) throw new NotFoundError('Subscription');
  const plan = await repo.findPlanById(sub.planId);
  if (!plan) throw new NotFoundError('Plan');

  const basePrice = calcBasePrice(plan, sub.billingCycle);
  const validation = await validateCoupon(code, plan.slug, basePrice);
  if (!validation.valid || !validation.coupon) {
    throw new AppError(validation.message, 422, 'COUPON_INVALID');
  }

  const discountPercent = validation.coupon.discountType === 'percentage' ? validation.coupon.discountValue : 0;
  const discountFixed = validation.coupon.discountType === 'fixed' ? validation.coupon.discountValue : 0;
  const nextInvoiceAmount = applyDiscount(basePrice, discountPercent, discountFixed);

  await repo.incrementCouponUses(validation.coupon.id);
  await repo.recordCouponRedemption(validation.coupon.id, tenantId, sub.id);

  const updated = await repo.updateSubscription(sub.id, {
    coupon_id: validation.coupon.id,
    discount_percent: discountPercent,
    discount_fixed: discountFixed,
    next_invoice_amount: nextInvoiceAmount,
  });
  return updated!;
}

export async function removeCouponFromSubscription(tenantId: string): Promise<Subscription> {
  const sub = await repo.findSubscriptionByTenant(tenantId);
  if (!sub) throw new NotFoundError('Subscription');
  const plan = await repo.findPlanById(sub.planId);
  if (!plan) throw new NotFoundError('Plan');

  const basePrice = calcBasePrice(plan, sub.billingCycle);
  const updated = await repo.updateSubscription(sub.id, {
    coupon_id: null,
    discount_percent: 0,
    discount_fixed: 0,
    next_invoice_amount: basePrice,
  });
  return updated!;
}

// ── Payment Methods ────────────────────────────────────────────────────────────
export async function getPaymentMethods(tenantId: string) {
  return repo.findPaymentMethods(tenantId);
}

export async function addPaymentMethod(tenantId: string, dto: AddPaymentMethodDto) {
  return repo.addPaymentMethod(tenantId, dto);
}

export async function setDefaultPaymentMethod(tenantId: string, id: string): Promise<void> {
  const pm = await repo.findPaymentMethodById(id, tenantId);
  if (!pm) throw new NotFoundError('PaymentMethod', id);
  await repo.setDefaultPaymentMethod(id, tenantId);
}

export async function removePaymentMethod(tenantId: string, id: string): Promise<void> {
  const pm = await repo.findPaymentMethodById(id, tenantId);
  if (!pm) throw new NotFoundError('PaymentMethod', id);
  await repo.removePaymentMethod(id, tenantId);
}

// ── Invoices ───────────────────────────────────────────────────────────────────
export async function getInvoices(tenantId: string, filter: InvoiceListFilter = {}) {
  return repo.findInvoices({ ...filter, tenantId });
}

export async function getInvoice(tenantId: string, id: string): Promise<Invoice> {
  const inv = await repo.findInvoiceById(id, tenantId);
  if (!inv) throw new NotFoundError('Invoice', id);
  return inv;
}

export async function downloadInvoicePdf(tenantId: string, id: string): Promise<Buffer> {
  const inv = await getInvoice(tenantId, id);
  return generateInvoicePdf(inv);
}

// ── Usage ──────────────────────────────────────────────────────────────────────
export async function getUsage(tenantId: string): Promise<UsageSummary[]> {
  const sub = await repo.findSubscriptionByTenant(tenantId);
  const plan = sub ? await repo.findPlanById(sub.planId) : null;
  const ps = new Date(); ps.setDate(1); ps.setHours(0, 0, 0, 0);
  const records = await repo.findUsageByTenant(tenantId, ps);
  const recordMap = new Map(records.map((r) => [r.metric, r]));

  const metrics: UsageMetric[] = ['users', 'frameworks', 'evidence_gb', 'branches', 'departments'];
  const limits: Record<UsageMetric, number | null> = {
    users: plan?.maxUsers ?? null,
    frameworks: plan?.maxFrameworks ?? null,
    evidence_gb: plan?.maxEvidenceGb ?? null,
    branches: plan?.maxBranches ?? null,
    departments: plan?.maxDepartments ?? null,
  };

  return metrics.map((metric) => {
    const rec = recordMap.get(metric);
    const currentValue = rec ? rec.currentValue : 0;
    const limitValue = limits[metric];
    const usagePercent = limitValue !== null && limitValue > 0 ? Math.round((currentValue / limitValue) * 100) : null;
    return {
      metric,
      label: USAGE_LABELS[metric],
      currentValue,
      limitValue,
      usagePercent,
      isOverLimit: limitValue !== null ? currentValue > limitValue : false,
    };
  });
}

export async function syncUsage(tenantId: string, schemaName: string): Promise<void> {
  const ps = new Date(); ps.setDate(1); ps.setHours(0, 0, 0, 0);
  const pe = new Date(ps); pe.setMonth(pe.getMonth() + 1);

  const sub = await repo.findSubscriptionByTenant(tenantId);
  const plan = sub ? await repo.findPlanById(sub.planId) : null;

  // Users: global tenant_memberships
  const [userRows] = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt FROM global.tenant_memberships
    WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL AND is_active = true
  `;
  await repo.upsertUsageRecord(tenantId, 'users', ps, pe, Number(userRows.cnt), plan?.maxUsers ?? null);

  // Frameworks, branches, departments, evidence_gb — from tenant schema
  if (schemaName) {
    try {
      await withTenantSchema(schemaName, async () => {
        const [fwRows] = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
          `SELECT COUNT(*) AS cnt FROM controls WHERE deleted_at IS NULL`,
        );
        await repo.upsertUsageRecord(tenantId, 'frameworks', ps, pe, Number(fwRows.cnt), plan?.maxFrameworks ?? null);

        const [evRows] = await prisma.$queryRawUnsafe<Array<{ total: string }>>(
          `SELECT COALESCE(SUM(file_size), 0) AS total FROM evidence WHERE deleted_at IS NULL`,
        );
        const gbUsed = Number(evRows.total) / (1024 ** 3);
        await repo.upsertUsageRecord(tenantId, 'evidence_gb', ps, pe, Number(gbUsed.toFixed(4)), plan?.maxEvidenceGb ?? null);
      });
    } catch {
      // tenant schema may not have these tables yet — skip silently
    }
  }

  // Branches and departments — global-scoped queries
  try {
    const [brRows] = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt FROM global.tenant_memberships WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL
    `;
    await repo.upsertUsageRecord(tenantId, 'branches', ps, pe, 0, plan?.maxBranches ?? null);
    await repo.upsertUsageRecord(tenantId, 'departments', ps, pe, 0, plan?.maxDepartments ?? null);
    void brRows; // silence unused
  } catch { /* skip */ }
}

// ── Billing Overview ───────────────────────────────────────────────────────────
export async function getBillingOverview(tenantId: string): Promise<BillingOverview> {
  const [subscription, paymentMethods, recentInvoices, usage] = await Promise.all([
    repo.findSubscriptionByTenant(tenantId),
    repo.findPaymentMethods(tenantId),
    repo.findInvoices({ tenantId, limit: 5 }),
    getUsage(tenantId),
  ]);

  const plan = subscription ? await repo.findPlanById(subscription.planId) : null;

  return { subscription, plan, paymentMethods, recentInvoices, usage };
}

// ── Invoice PDF ────────────────────────────────────────────────────────────────
const C = { indigo: '#4F46E5', slate: '#1E293B', muted: '#64748B', border: '#E2E8F0', white: '#FFFFFF', green: '#10B981', red: '#EF4444' };

export function generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100;

    // Header bar
    doc.rect(50, 50, W, 4).fill(C.indigo);

    // Logo text + title
    doc.fillColor(C.indigo).fontSize(20).font('Helvetica-Bold').text('ComplianceCore', 50, 70);
    doc.fillColor(C.slate).fontSize(28).font('Helvetica-Bold').text('INVOICE', 50, 70, { align: 'right', width: W });

    doc.fillColor(C.muted).fontSize(9).font('Helvetica').text('Orion Soft Limited', 50, 97);
    doc.text('compliance@orionsoft.com', 50, 109);

    // Invoice meta box
    const metaX = doc.page.width - 220;
    doc.rect(metaX, 90, 170, 80).fill('#F8FAFC');
    doc.fillColor(C.muted).fontSize(8).text('Invoice Number', metaX + 10, 100);
    doc.fillColor(C.slate).fontSize(9).font('Helvetica-Bold').text(invoice.number, metaX + 10, 111);
    doc.fillColor(C.muted).fontSize(8).font('Helvetica').text('Date', metaX + 10, 128);
    doc.fillColor(C.slate).fontSize(9).font('Helvetica-Bold').text(new Date(invoice.createdAt).toLocaleDateString('en-GB'), metaX + 10, 139);
    doc.fillColor(C.muted).fontSize(8).font('Helvetica').text('Due Date', metaX + 10, 156);
    doc.fillColor(C.slate).fontSize(9).font('Helvetica-Bold').text(new Date(invoice.dueDate).toLocaleDateString('en-GB'), metaX + 10, 167);

    // Status badge
    const statusColor = invoice.status === 'paid' ? C.green : invoice.status === 'void' ? C.muted : C.indigo;
    doc.rect(metaX + 90, 100, 70, 18).fill(statusColor);
    doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold')
      .text(invoice.status.toUpperCase(), metaX + 90, 105, { width: 70, align: 'center' });

    // Billing period
    doc.fillColor(C.muted).fontSize(8).font('Helvetica').text(
      `Billing period: ${new Date(invoice.billingPeriodStart).toLocaleDateString('en-GB')} – ${new Date(invoice.billingPeriodEnd).toLocaleDateString('en-GB')}`,
      50, 185,
    );

    doc.moveTo(50, 200).lineTo(50 + W, 200).stroke(C.border);

    // Line items table header
    let y = 215;
    doc.rect(50, y, W, 20).fill('#F1F5F9');
    doc.fillColor(C.muted).fontSize(8).font('Helvetica-Bold');
    doc.text('Description', 60, y + 6);
    doc.text('Qty', 370, y + 6, { width: 40, align: 'right' });
    doc.text('Unit Price', 420, y + 6, { width: 60, align: 'right' });
    doc.text('Amount', 490, y + 6, { width: 60, align: 'right' });
    y += 25;

    doc.font('Helvetica').fillColor(C.slate).fontSize(9);
    for (const item of invoice.lineItems) {
      doc.text(item.description, 60, y, { width: 300 });
      doc.text(String(item.quantity), 370, y, { width: 40, align: 'right' });
      doc.text(`$${item.unitAmount.toFixed(2)}`, 420, y, { width: 60, align: 'right' });
      doc.text(`$${item.amount.toFixed(2)}`, 490, y, { width: 60, align: 'right' });
      y += 18;
      doc.moveTo(50, y).lineTo(50 + W, y).stroke(C.border);
      y += 5;
    }

    // Totals
    y += 10;
    doc.fillColor(C.muted).fontSize(9).text('Subtotal', 390, y, { width: 100, align: 'right' });
    doc.fillColor(C.slate).font('Helvetica-Bold').text(`$${invoice.amountDue.toFixed(2)}`, 490, y, { width: 60, align: 'right' });
    y += 16;
    doc.fillColor(C.muted).font('Helvetica').text('Amount Paid', 390, y, { width: 100, align: 'right' });
    doc.fillColor(invoice.amountPaid > 0 ? C.green : C.muted).font('Helvetica-Bold')
      .text(`$${invoice.amountPaid.toFixed(2)}`, 490, y, { width: 60, align: 'right' });
    y += 6;
    doc.rect(390, y, 160, 1).fill(C.border);
    y += 8;
    doc.fillColor(C.slate).font('Helvetica-Bold').fontSize(11).text('Balance Due', 390, y, { width: 100, align: 'right' });
    const balance = Math.max(0, invoice.amountDue - invoice.amountPaid);
    doc.fillColor(balance > 0 ? C.indigo : C.green).fontSize(11)
      .text(`$${balance.toFixed(2)}`, 490, y, { width: 60, align: 'right' });

    // Footer
    doc.rect(50, 790, W, 1).fill(C.border);
    doc.fillColor(C.muted).fontSize(8).font('Helvetica')
      .text('ComplianceCore — Confidential. Questions? billing@orionsoft.com', 50, 800, { width: W, align: 'center' });

    doc.end();
  });
}

// ── Admin ──────────────────────────────────────────────────────────────────────
export async function adminGetAllTenantBilling() {
  return repo.findAllTenantBilling();
}

export async function adminGetCoupons(includeInactive = false) {
  return repo.findAllCoupons(includeInactive);
}

export async function adminCreateCoupon(dto: CreateCouponDto, createdBy: string) {
  return repo.createCoupon(dto, createdBy);
}

export async function adminUpdateCoupon(id: string, dto: UpdateCouponDto) {
  const updated = await repo.updateCoupon(id, dto);
  if (!updated) throw new NotFoundError('Coupon', id);
  return updated;
}

export async function adminUpdateSubscription(id: string, fields: Record<string, unknown>) {
  const updated = await repo.updateSubscription(id, fields);
  if (!updated) throw new NotFoundError('Subscription', id);
  return updated;
}

export async function adminUpdateInvoice(id: string, dto: UpdateInvoiceDto) {
  const updated = await repo.updateInvoice(id, dto);
  if (!updated) throw new NotFoundError('Invoice', id);
  return updated;
}

export async function adminGetInvoices(filter: InvoiceListFilter = {}) {
  return repo.findInvoices(filter);
}

// ── Renewal helpers (used by BullMQ job) ──────────────────────────────────────
export { advancePeriod, calcBasePrice, applyDiscount };
