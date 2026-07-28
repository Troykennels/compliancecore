import { logger } from './logger';
// Optional chaining on every call below: the ENABLE_REDIS=false stub used in
// local development implements only setex/del/exists, so `get` may be absent.
// A missing cache simply means the rate is fetched again.
import { redis } from '../config/redis';

// USD → other-currency rates, used to tell the platform owner when a naira
// price has drifted from its dollar equivalent.
//
// This never sets a price by itself. A bad or stale rate can only ever produce
// a wrong *suggestion* that a human declines — it cannot reach a customer's
// card. That separation is the whole reason this is a monitor rather than live
// pricing.

const RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const TIMEOUT_MS = 10_000;
const CACHE_TTL_SECONDS = 6 * 60 * 60; // the upstream feed updates daily

// Sanity bounds. A rate outside these is far likelier to be a malformed
// response, a currency mix-up, or an API change than a real move, so it is
// rejected rather than acted on. Widen deliberately if the naira genuinely
// moves this far.
const PLAUSIBLE: Record<string, { min: number; max: number }> = {
  NGN: { min: 200, max: 20_000 },
};

export interface FxRate {
  currency: string;
  rate: number;
  fetchedAt: Date;
  stale: boolean;
}

export async function getUsdRate(currency: string): Promise<FxRate | null> {
  const code = currency.toUpperCase();
  const cacheKey = `fx:usd:${code}`;

  try {
    const cached = await redis.get?.(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { rate: number; at: string };
      return { currency: code, rate: parsed.rate, fetchedAt: new Date(parsed.at), stale: false };
    }
  } catch {
    /* cache is an optimisation only */
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RATE_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`FX provider returned ${res.status}`);

    const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (body.result !== 'success') throw new Error(`FX provider result=${body.result}`);

    const rate = body.rates?.[code];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(`No usable rate for ${code}`);
    }

    const bounds = PLAUSIBLE[code];
    if (bounds && (rate < bounds.min || rate > bounds.max)) {
      throw new Error(`Rate ${rate} for ${code} is outside the plausible range ${bounds.min}-${bounds.max}`);
    }

    try {
      await redis.setex?.(cacheKey, CACHE_TTL_SECONDS, JSON.stringify({ rate, at: new Date().toISOString() }));
    } catch {
      /* non-fatal */
    }

    return { currency: code, rate, fetchedAt: new Date(), stale: false };
  } catch (err) {
    // Returning null rather than throwing: a missing rate must degrade to "no
    // suggestion available", never to a suggestion built on a guess.
    logger.warn({ err, currency: code }, 'Could not fetch FX rate');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Rounds to a clean price point so suggestions read as prices, not conversions. */
export function roundPricePoint(amount: number): number {
  if (amount <= 0) return 0;
  if (amount < 1_000) return Math.ceil(amount / 50) * 50;
  if (amount < 100_000) return Math.ceil(amount / 500) * 500;
  return Math.ceil(amount / 5_000) * 5_000;
}
