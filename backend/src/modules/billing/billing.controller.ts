import type { Request, Response } from 'express';
import * as service from './billing.service';

const tid = (req: Request): string => req.user!.tenantId!;

// ── Public ─────────────────────────────────────────────────────────────────────
export async function getPublicPlans(_req: Request, res: Response) {
  const plans = await service.getPublicPlans();
  res.json({ success: true, data: plans });
}

export async function validateCoupon(req: Request, res: Response) {
  const { code, planSlug, amount } = req.query as Record<string, string>;
  const result = await service.validateCoupon(code ?? '', planSlug ?? '', Number(amount ?? 0));
  res.json({ success: true, data: result });
}

// ── Tenant Billing ─────────────────────────────────────────────────────────────
export async function getBillingOverview(req: Request, res: Response) {
  const data = await service.getBillingOverview(tid(req));
  res.json({ success: true, data });
}

export async function getSubscription(req: Request, res: Response) {
  const data = await service.getSubscription(tid(req));
  res.json({ success: true, data });
}

export async function createSubscription(req: Request, res: Response) {
  const data = await service.createSubscription(tid(req), req.body);
  res.status(201).json({ success: true, data });
}

export async function updateSubscription(req: Request, res: Response) {
  const data = await service.updateSubscription(tid(req), req.body);
  res.json({ success: true, data });
}

export async function applyCoupon(req: Request, res: Response) {
  const { code } = req.body as { code: string };
  const data = await service.applyCouponToSubscription(tid(req), code);
  res.json({ success: true, data });
}

export async function removeCoupon(req: Request, res: Response) {
  const data = await service.removeCouponFromSubscription(tid(req));
  res.json({ success: true, data });
}

export async function getPaymentMethods(req: Request, res: Response) {
  const data = await service.getPaymentMethods(tid(req));
  res.json({ success: true, data });
}

export async function addPaymentMethod(req: Request, res: Response) {
  const data = await service.addPaymentMethod(tid(req), req.body);
  res.status(201).json({ success: true, data });
}

export async function setDefaultPaymentMethod(req: Request, res: Response) {
  await service.setDefaultPaymentMethod(tid(req), req.params.id);
  res.json({ success: true, data: null });
}

export async function removePaymentMethod(req: Request, res: Response) {
  await service.removePaymentMethod(tid(req), req.params.id);
  res.json({ success: true, data: null });
}

export async function getInvoices(req: Request, res: Response) {
  const { status, limit, offset } = req.query as Record<string, string>;
  const data = await service.getInvoices(tid(req), {
    status: status as never,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });
  res.json({ success: true, data });
}

export async function getInvoice(req: Request, res: Response) {
  const data = await service.getInvoice(tid(req), req.params.id);
  res.json({ success: true, data });
}

export async function downloadInvoicePdf(req: Request, res: Response) {
  const { id } = req.params;
  const inv = await service.getInvoice(tid(req), id);
  const buffer = await service.generateInvoicePdf(inv);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${inv.number}.pdf"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}

export async function getUsage(req: Request, res: Response) {
  const data = await service.getUsage(tid(req));
  res.json({ success: true, data });
}

// ── Admin ──────────────────────────────────────────────────────────────────────
export async function adminGetPlans(_req: Request, res: Response) {
  const data = await service.getAllPlans(true);
  res.json({ success: true, data });
}

export async function adminCreatePlan(req: Request, res: Response) {
  const data = await service.adminCreatePlan(req.body);
  res.status(201).json({ success: true, data });
}

export async function adminUpdatePlan(req: Request, res: Response) {
  const data = await service.adminUpdatePlan(req.params.id, req.body);
  res.json({ success: true, data });
}

export async function adminGetCoupons(req: Request, res: Response) {
  const includeInactive = req.query.includeInactive === 'true';
  const data = await service.adminGetCoupons(includeInactive);
  res.json({ success: true, data });
}

export async function adminCreateCoupon(req: Request, res: Response) {
  const data = await service.adminCreateCoupon(req.body, req.user!.id);
  res.status(201).json({ success: true, data });
}

export async function adminUpdateCoupon(req: Request, res: Response) {
  const data = await service.adminUpdateCoupon(req.params.id, req.body);
  res.json({ success: true, data });
}

export async function adminGetAllTenantBilling(_req: Request, res: Response) {
  const data = await service.adminGetAllTenantBilling();
  res.json({ success: true, data });
}

export async function adminGetInvoices(req: Request, res: Response) {
  const { tenantId, status, limit, offset } = req.query as Record<string, string>;
  const data = await service.adminGetInvoices({
    tenantId,
    status: status as never,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });
  res.json({ success: true, data });
}

export async function adminDownloadInvoicePdf(req: Request, res: Response) {
  const { id } = req.params;
  const { findInvoiceById } = await import('./billing.repository');
  const inv = await findInvoiceById(id);
  if (!inv) throw new (await import('../../lib/errors')).NotFoundError('Invoice', id);
  const buffer = await service.generateInvoicePdf(inv);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${inv.number}.pdf"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}

export async function adminUpdateSubscription(req: Request, res: Response) {
  const data = await service.adminUpdateSubscription(req.params.id, req.body);
  res.json({ success: true, data });
}

export async function adminUpdateInvoice(req: Request, res: Response) {
  const data = await service.adminUpdateInvoice(req.params.id, req.body);
  res.json({ success: true, data });
}
