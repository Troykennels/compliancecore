import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission, requireSuperadmin } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './billing.controller';

const router = Router();

// ── Public (no auth) ─────────────────────────────────────────────────────────
router.get('/plans/public', asyncHandler(ctrl.getPublicPlans));
router.get('/coupons/validate', asyncHandler(ctrl.validateCoupon));

// ── Authenticated tenant routes ───────────────────────────────────────────────
router.use(authenticate());

router.get('/overview', requirePermission('billing:read'), asyncHandler(ctrl.getBillingOverview));
router.get('/subscription', requirePermission('billing:read'), asyncHandler(ctrl.getSubscription));
router.post('/subscription', requirePermission('billing:write'), asyncHandler(ctrl.createSubscription));
router.patch('/subscription', requirePermission('billing:write'), asyncHandler(ctrl.updateSubscription));
router.post('/subscription/coupon', requirePermission('billing:write'), asyncHandler(ctrl.applyCoupon));
router.delete('/subscription/coupon', requirePermission('billing:write'), asyncHandler(ctrl.removeCoupon));

router.get('/payment-methods', requirePermission('billing:read'), asyncHandler(ctrl.getPaymentMethods));
router.post('/payment-methods', requirePermission('billing:write'), asyncHandler(ctrl.addPaymentMethod));
router.patch('/payment-methods/:id/default', requirePermission('billing:write'), asyncHandler(ctrl.setDefaultPaymentMethod));
router.delete('/payment-methods/:id', requirePermission('billing:write'), asyncHandler(ctrl.removePaymentMethod));

router.get('/invoices', requirePermission('billing:read'), asyncHandler(ctrl.getInvoices));
router.get('/invoices/:id', requirePermission('billing:read'), asyncHandler(ctrl.getInvoice));
router.get('/invoices/:id/download', requirePermission('billing:read'), asyncHandler(ctrl.downloadInvoicePdf));

router.get('/usage', requirePermission('billing:read'), asyncHandler(ctrl.getUsage));

// ── Superadmin routes ─────────────────────────────────────────────────────────
router.get('/admin/plans', requireSuperadmin, asyncHandler(ctrl.adminGetPlans));
router.post('/admin/plans', requireSuperadmin, asyncHandler(ctrl.adminCreatePlan));
router.patch('/admin/plans/:id', requireSuperadmin, asyncHandler(ctrl.adminUpdatePlan));

router.get('/admin/coupons', requireSuperadmin, asyncHandler(ctrl.adminGetCoupons));
router.post('/admin/coupons', requireSuperadmin, asyncHandler(ctrl.adminCreateCoupon));
router.patch('/admin/coupons/:id', requireSuperadmin, asyncHandler(ctrl.adminUpdateCoupon));

router.get('/admin/tenants', requireSuperadmin, asyncHandler(ctrl.adminGetAllTenantBilling));
router.get('/admin/invoices', requireSuperadmin, asyncHandler(ctrl.adminGetInvoices));
router.get('/admin/invoices/:id/download', requireSuperadmin, asyncHandler(ctrl.adminDownloadInvoicePdf));
router.patch('/admin/subscriptions/:id', requireSuperadmin, asyncHandler(ctrl.adminUpdateSubscription));
router.patch('/admin/invoices/:id', requireSuperadmin, asyncHandler(ctrl.adminUpdateInvoice));

export { router as billingRouter };
