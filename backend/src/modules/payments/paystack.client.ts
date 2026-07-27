import crypto from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { AppError } from '../../lib/errors';

// Thin Paystack HTTP client. Node 20 has global fetch, so no new dependency.
const BASE_URL = 'https://api.paystack.co';
const TIMEOUT_MS = 15_000;

export function isPaystackConfigured(): boolean {
  return Boolean(env.PAYSTACK_SECRET_KEY);
}

function secretKey(): string {
  const key = env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new AppError('Payments are not configured on this deployment.', 503, 'PAYMENTS_UNCONFIGURED');
  }
  return key;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };

    if (!res.ok || body.status === false) {
      // Surface Paystack's own message — it is specific and actionable
      // ("Currency not supported by merchant" is the one you hit before USD is
      // enabled on the account).
      const message = body.message ?? `Paystack request failed (${res.status})`;
      logger.error({ path, status: res.status, message }, 'Paystack API error');
      throw new AppError(message, 502, 'PAYSTACK_ERROR');
    }

    return body.data as T;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new AppError('Payment provider timed out. Please try again.', 504, 'PAYSTACK_TIMEOUT');
    }
    logger.error({ err, path }, 'Paystack request failed');
    throw new AppError('Could not reach the payment provider.', 502, 'PAYSTACK_UNREACHABLE');
  } finally {
    clearTimeout(timer);
  }
}

export interface InitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface VerifyResult {
  status: string;              // 'success' | 'failed' | 'abandoned' | ...
  reference: string;
  amount: number;              // smallest currency unit (kobo / cents)
  currency: string;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
  customer: { email: string } | null;
}

/**
 * Starts a hosted checkout. Paystack takes the amount in the currency's
 * *smallest unit* — kobo for NGN, cents for USD — so a ₦158,400 plan is sent as
 * 15840000. Passing naira directly would undercharge by 100x.
 */
export async function initializeTransaction(input: {
  email: string;
  amountMajor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitializeResult> {
  return call<InitializeResult>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountMajor * 100),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
}

/**
 * Server-side confirmation of a transaction. Always call this before granting
 * anything — a webhook body or a browser redirect alone is not proof of payment.
 */
export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  return call<VerifyResult>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Validates a Paystack webhook signature.
 *
 * Paystack signs the **raw** request body with HMAC-SHA512 keyed by the secret
 * key and sends it as x-paystack-signature. The body must be the exact bytes
 * received: re-serialising the parsed JSON reorders keys and changes whitespace,
 * which produces a different digest and rejects every legitimate webhook.
 *
 * Compared with timingSafeEqual to avoid leaking the expected digest byte by
 * byte through response timing.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !env.PAYSTACK_SECRET_KEY) return false;
  const expected = crypto
    .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
