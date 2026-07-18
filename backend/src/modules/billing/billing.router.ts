import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission, requireSuperadmin } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { validateUuidParam } from '../../middleware/validate-params.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './billing.controller';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  applyCouponSchema,
  addPaymentMethodSchema,
} from './billing.schema';

const router = Router();

// ── Public (no auth) ─────────────────────────────────────────────────────────
router.get('/plans/public', asyncHandler(ctrl.getPublicPlans));
router.get('/coupons/validate', asyncHandler(ctrl.validateCoupon));

// ── Authenticated tenant routes ───────────────────────────────────────────────
router.use(authenticate());

router.get('/overview', requirePermission('billing:read'), asyncHandler(ctrl.getBillingOverview));
router.get('/subscription', requirePermission('billing:read'), asyncHandler(ctrl.getSubscription));
router.post('/subscription', requirePermission('billing:write'), validate(createSubscriptionSchema), asyncHandler(ctrl.createSubscription));
router.patch('/subscription', requirePermission('billing:write'), validate(updateSubscriptionSchema), asyncHandler(ctrl.updateSubscription));
router.post('/subscription/coupon', requirePermission('billing:write'), validate(applyCouponSchema), asyncHandler(ctrl.applyCoupon));
router.delete('/subscription/coupon', requirePermission('billing:write'), asyncHandler(ctrl.removeCoupon));

router.get('/payment-methods', requirePermission('billing:read'), asyncHandler(ctrl.getPaymentMethods));
router.post('/payment-methods', requirePermission('billing:write'), validate(addPaymentMethodSchema), asyncHandler(ctrl.addPaymentMethod));
router.patch('/payment-methods/:id/default', requirePermission('billing:write'), validateUuidParam('id'), asyncHandler(ctrl.setDefaultPaymentMethod));
router.delete('/payment-methods/:id', requirePermission('billing:write'), validateUuidParam('id'), asyncHandler(ctrl.removePaymentMethod));

router.get('/invoices', requirePermission('billing:read'), asyncHandler(ctrl.getInvoices));
router.get('/invoices/:id', requirePermission('billing:read'), validateUuidParam('id'), asyncHandler(ctrl.getInvoice));
router.get('/invoices/:id/download', requirePermission('billing:read'), validateUuidParam('id'), asyncHandler(ctrl.downloadInvoicePdf));

router.get('/usage', requirePermission('billing:read'), asyncHandler(ctrl.getUsage));

// ── Superadmin routes ─────────────────────────────────────────────────────────
router.get('/admin/plans', requireSuperadmin, asyncHandler(ctrl.adminGetPlans));
router.post('/admin/plans', requireSuperadmin, asyncHandler(ctrl.adminCreatePlan));
router.patch('/admin/plans/:id', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminUpdatePlan));

router.get('/admin/coupons', requireSuperadmin, asyncHandler(ctrl.adminGetCoupons));
router.post('/admin/coupons', requireSuperadmin, asyncHandler(ctrl.adminCreateCoupon));
router.patch('/admin/coupons/:id', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminUpdateCoupon));

router.get('/admin/tenants', requireSuperadmin, asyncHandler(ctrl.adminGetAllTenantBilling));
router.get('/admin/invoices', requireSuperadmin, asyncHandler(ctrl.adminGetInvoices));
router.get('/admin/invoices/:id/download', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminDownloadInvoicePdf));
router.patch('/admin/subscriptions/:id', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminUpdateSubscription));
router.patch('/admin/invoices/:id', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminUpdateInvoice));

export { router as billingRouter };
