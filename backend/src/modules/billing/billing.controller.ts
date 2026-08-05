import type { Request, Response } from 'express';
import * as service from './billing.service';
import { getEntitlement as resolveEntitlement } from '../../lib/entitlements';
import * as fxReview from './fx-review.service';
import { prisma } from '../../config/database';
import { logger } from '../../lib/logger';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors';
import { requestErasure, cancelErasure } from '../../lib/tenant-erasure';
import { revokeUserTokens } from '../../lib/token-revocation';

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

// ── Entitlement ────────────────────────────────────────────────────────────────
/**
 * What this organisation may currently do. Drives the trial/expiry banner and
 * lets the UI disable actions it knows will be refused.
 *
 * Resolves the entitlement itself rather than reading req.entitlement: the
 * billing router only calls authenticate(), with no resolveTenant or
 * enforceEntitlement, so the request-scoped value is never populated here. It
 * calls the same function the middleware does, so the client is shown exactly
 * the state the API enforces with.
 */
export async function getEntitlement(req: Request, res: Response) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    res.json({ success: true, data: null });
    return;
  }
  res.json({ success: true, data: await resolveEntitlement(tenantId) });
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

/**
 * Schedules a customer's organisation for erasure, from the operator console.
 *
 * Requires the organisation's exact name in the body — the same confirmation an
 * owner types to delete their own. An operator acting on a list of similarly
 * named tenants is if anything MORE likely to pick the wrong row than someone
 * deleting the single organisation they work in.
 */
export async function adminDeleteTenant(req: Request, res: Response) {
  const tenantId = req.params.id;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!tenant) throw new NotFoundError('Organization', tenantId);

  // Refuse to erase the tenant the operator is currently signed in to. Doing it
  // from this screen is almost certainly a misclick, and it would revoke their
  // own session mid-action — including their access to this console.
  if (req.user?.tenantId === tenantId) {
    throw new AppError(
      'This is the organisation you are signed in to. Delete it from its own Settings page if you really mean to.',
      400,
      'CANNOT_DELETE_OWN_TENANT',
    );
  }

  if (tenant.deletedAt) {
    throw new AppError('That organisation is already scheduled for deletion.', 409, 'ALREADY_SCHEDULED');
  }

  const typed = String(req.body?.confirmName ?? '').trim().toLowerCase();
  if (typed !== tenant.name.trim().toLowerCase()) {
    throw new ValidationError(
      'The name you typed does not match that organisation. Nothing has been deleted.',
    );
  }

  const { purgeAfter } = await requestErasure(tenantId);

  // End every member's session now, rather than leaving them with a token for
  // an organisation they can no longer reach.
  const members = await prisma.tenantMembership.findMany({
    where: { tenantId, deletedAt: null },
    select: { userId: true },
  });
  await Promise.all(members.map((m) => revokeUserTokens(m.userId, 'organisation deleted by operator')));

  logger.warn(
    { tenantId, tenant: tenant.name, actor: req.user?.email, purgeAfter },
    'Operator scheduled tenant erasure',
  );

  res.json({ success: true, data: { message: `${tenant.name} scheduled for deletion.`, purgeAfter } });
}

export async function adminRestoreTenant(req: Request, res: Response) {
  const restored = await cancelErasure(req.params.id);
  if (!restored) {
    throw new AppError(
      'That organisation is not scheduled for deletion, or its data has already been erased.',
      409,
      'NOT_RESTORABLE',
    );
  }
  logger.warn({ tenantId: req.params.id, actor: req.user?.email }, 'Operator restored tenant');
  res.json({ success: true, data: { message: 'Organisation restored.' } });
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

// ── FX price review (superadmin) ──────────────────────────────────────────────
export async function adminFxReview(req: Request, res: Response) {
  const currency = String(req.query.currency ?? 'NGN');
  res.json({ success: true, data: await fxReview.reviewFxPricing(currency) });
}

export async function adminApplyFxSuggestions(req: Request, res: Response) {
  const { planIds, currency } = req.body as { planIds?: string[]; currency?: string };
  const data = await fxReview.applyFxSuggestions(planIds ?? [], currency ?? 'NGN');
  res.json({ success: true, data });
}

// ── Per-currency plan prices (superadmin) ─────────────────────────────────────
export async function adminGetPlanPrices(req: Request, res: Response) {
  const { findPlanPricesByPlan } = await import('./billing.repository');
  res.json({ success: true, data: await findPlanPricesByPlan(req.params.id) });
}

export async function adminSetPlanPrice(req: Request, res: Response) {
  const { currency, priceMonthly, priceYearly } = req.body as {
    currency: string; priceMonthly: number; priceYearly: number;
  };
  const { upsertPlanPrice, findPlanPricesByPlan } = await import('./billing.repository');
  await upsertPlanPrice(req.params.id, currency, priceMonthly, priceYearly);
  res.json({ success: true, data: await findPlanPricesByPlan(req.params.id) });
}

export async function adminUpdateSubscription(req: Request, res: Response) {
  const data = await service.adminUpdateSubscription(req.params.id, req.body);
  res.json({ success: true, data });
}

export async function adminUpdateInvoice(req: Request, res: Response) {
  const data = await service.adminUpdateInvoice(req.params.id, req.body);
  res.json({ success: true, data });
}
