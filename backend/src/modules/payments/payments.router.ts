import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './payments.controller';

// ─── Public / unauthenticated ────────────────────────────────────────────────
// The webhook is mounted separately in app.ts, BEFORE the JSON body parser, so
// the raw bytes survive for signature verification. It is deliberately not on
// this router.
export const paymentsPublicRouter = Router();

// Tells the frontend whether payments are available and which currencies to
// offer. No secrets: the Paystack *public* key is designed to be shipped.
paymentsPublicRouter.get('/config', asyncHandler(ctrl.getConfig));

// ─── Authenticated ───────────────────────────────────────────────────────────
export const paymentsRouter = Router();
paymentsRouter.use(authenticate(), resolveTenant, enforceEntitlement());

// Prices for a plan across every currency it is sold in.
paymentsRouter.get('/plans/:planId/prices', requirePermission('billing:read'), asyncHandler(ctrl.getPlanPrices));

// Starting a checkout commits the organisation to a charge, so it needs write
// permission — not merely the ability to view billing.
paymentsRouter.post('/checkout', requirePermission('billing:write'), asyncHandler(ctrl.createCheckout));

// Called when Paystack redirects the browser back. Safe to hit repeatedly: the
// underlying claim is idempotent, so a refresh cannot double-apply a payment.
paymentsRouter.get('/confirm', requirePermission('billing:read'), asyncHandler(ctrl.confirmPayment));

paymentsRouter.get('/', requirePermission('billing:read'), asyncHandler(ctrl.listPayments));

export default paymentsRouter;
