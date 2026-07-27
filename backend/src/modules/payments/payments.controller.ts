import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './payments.service';
import { ValidationError } from '../../lib/errors';
import { ok, created } from '../../lib/response';

const checkoutSchema = z.object({
  planId: z.string().uuid('planId must be a valid UUID'),
  currency: z.string().length(3, 'currency must be a 3-letter ISO code'),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
});

export async function getConfig(_req: Request, res: Response): Promise<void> {
  ok(res, _req, service.getPublicConfig());
}

export async function createCheckout(req: Request, res: Response): Promise<void> {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }
  // tenant and email come from the authenticated session, never the request
  // body — otherwise a caller could buy a plan for another organisation, or
  // point the Paystack receipt at an address they do not control.
  const result = await service.createCheckout({
    tenantId: req.tenant!.id,
    userId: req.user.id,
    email: req.user.email,
    planId: parsed.data.planId,
    currency: parsed.data.currency,
    billingCycle: parsed.data.billingCycle,
  });
  created(res, req, result);
}

export async function confirmPayment(req: Request, res: Response): Promise<void> {
  const reference = String(req.query.reference ?? '').trim();
  if (!reference) throw new ValidationError('reference is required');
  ok(res, req, await service.confirmByReference(req.tenant!.id, reference));
}

export async function listPayments(req: Request, res: Response): Promise<void> {
  ok(res, req, await service.listTenantPayments(req.tenant!.id));
}

export async function getPlanPrices(req: Request, res: Response): Promise<void> {
  ok(res, req, await service.getPlanPrices(req.params.planId));
}

/**
 * Paystack webhook receiver.
 *
 * Always ACKs with 200 once the signature is valid, even for events we do not
 * act on. Paystack retries any non-2xx, so erroring on an event we simply
 * ignore would have it redelivered indefinitely. A bad or missing signature is
 * the one case that must not ACK — handleWebhook rejects that with 401.
 */
export async function paystackWebhook(req: Request, res: Response): Promise<void> {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!raw) throw new ValidationError('Missing raw request body for signature verification.');
  await service.handleWebhook(raw, req.header('x-paystack-signature'));
  res.status(200).json({ received: true });
}
