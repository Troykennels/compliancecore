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

// No billing permission required: every member needs to know their
// organisation is in read-only, not just whoever manages the invoices.
router.get('/entitlement', asyncHandler(ctrl.getEntitlement));
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

// Per-currency pricing. The plan record holds only one currency, so NGN prices
// are edited here rather than through the plan itself.
router.get('/admin/plans/:id/prices', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminGetPlanPrices));
router.put('/admin/plans/:id/prices', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminSetPlanPrice));

// FX drift review. Reports how far each currency's price has moved from its USD
// equivalent at the live rate; applying a suggestion is a separate, explicit call.
router.get('/admin/fx-review', requireSuperadmin, asyncHandler(ctrl.adminFxReview));
router.post('/admin/fx-review/apply', requireSuperadmin, asyncHandler(ctrl.adminApplyFxSuggestions));

router.get('/admin/coupons', requireSuperadmin, asyncHandler(ctrl.adminGetCoupons));
router.post('/admin/coupons', requireSuperadmin, asyncHandler(ctrl.adminCreateCoupon));
router.patch('/admin/coupons/:id', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminUpdateCoupon));

router.get('/admin/tenants', requireSuperadmin, asyncHandler(ctrl.adminGetAllTenantBilling));
router.get('/admin/invoices', requireSuperadmin, asyncHandler(ctrl.adminGetInvoices));
router.get('/admin/invoices/:id/download', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminDownloadInvoicePdf));
router.patch('/admin/subscriptions/:id', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminUpdateSubscription));
router.patch('/admin/invoices/:id', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminUpdateInvoice));

// Erasing a customer's organisation from the operator console.
//
// The owner of an organisation can already delete their own. This is the other
// half: closing an account on request, or clearing out an abandoned trial,
// without anyone touching the database by hand. Same two-step erasure — access
// stops now, data goes after the grace window — so an operator mis-click is
// recoverable for 30 days rather than instant and final.
router.delete('/admin/tenants/:id', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminDeleteTenant));
router.post('/admin/tenants/:id/restore', requireSuperadmin, validateUuidParam('id'), asyncHandler(ctrl.adminRestoreTenant));

export { router as billingRouter };
