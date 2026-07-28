import { getUsdRate, roundPricePoint } from '../../lib/fx';
import * as repo from './billing.repository';
import { logger } from '../../lib/logger';

// Compares each plan's price in a foreign currency against its USD price at the
// live rate, and reports how far it has drifted. Nothing here changes a price —
// applyFxSuggestions is a separate, explicit action taken by the platform
// owner. Suggestions are advisory precisely so a bad rate cannot reach a card.

export const DEFAULT_DRIFT_THRESHOLD_PERCENT = 10;

export interface FxSuggestion {
  planId: string;
  planSlug: string;
  planName: string;
  currency: string;
  usdMonthly: number;
  usdYearly: number;
  currentMonthly: number;
  currentYearly: number;
  suggestedMonthly: number;
  suggestedYearly: number;
  /** Percentage drift of the current monthly price from its USD equivalent. */
  driftPercent: number;
  /** True when drift exceeds the threshold and is worth acting on. */
  needsReview: boolean;
}

export interface FxReview {
  currency: string;
  rate: number | null;
  fetchedAt: string | null;
  thresholdPercent: number;
  suggestions: FxSuggestion[];
  /** Set when the rate could not be fetched — suggestions will be empty. */
  unavailableReason?: string;
}

export async function reviewFxPricing(
  currency = 'NGN',
  thresholdPercent = DEFAULT_DRIFT_THRESHOLD_PERCENT,
): Promise<FxReview> {
  const fx = await getUsdRate(currency);
  if (!fx) {
    return {
      currency,
      rate: null,
      fetchedAt: null,
      thresholdPercent,
      suggestions: [],
      unavailableReason: 'Live exchange rate is currently unavailable.',
    };
  }

  const plans = await repo.findAllPlans({ includeInactive: false });
  const suggestions: FxSuggestion[] = [];

  for (const plan of plans) {
    const prices = await repo.findPlanPricesByPlan(plan.id);
    const usd = prices.find((p) => p.currency === 'USD');
    const target = prices.find((p) => p.currency === currency.toUpperCase());
    if (!usd || !target) continue;

    // A free plan has nothing to drift from.
    if (usd.priceMonthly <= 0 && usd.priceYearly <= 0) continue;

    const suggestedMonthly = roundPricePoint(usd.priceMonthly * fx.rate);
    const suggestedYearly = roundPricePoint(usd.priceYearly * fx.rate);

    const expected = usd.priceMonthly * fx.rate;
    const driftPercent =
      expected > 0 ? ((target.priceMonthly - expected) / expected) * 100 : 0;

    suggestions.push({
      planId: plan.id,
      planSlug: plan.slug,
      planName: plan.name,
      currency: currency.toUpperCase(),
      usdMonthly: usd.priceMonthly,
      usdYearly: usd.priceYearly,
      currentMonthly: target.priceMonthly,
      currentYearly: target.priceYearly,
      suggestedMonthly,
      suggestedYearly,
      driftPercent: Number(driftPercent.toFixed(1)),
      needsReview: Math.abs(driftPercent) >= thresholdPercent,
    });
  }

  return {
    currency: currency.toUpperCase(),
    rate: fx.rate,
    fetchedAt: fx.fetchedAt.toISOString(),
    thresholdPercent,
    suggestions,
  };
}

/**
 * Applies the suggested prices for the named plans.
 *
 * Takes explicit plan ids rather than "apply everything": the owner may accept
 * a change for one tier and not another, and an endpoint that silently repriced
 * every plan would be a much sharper tool than intended.
 *
 * Existing subscribers are unaffected — their next_invoice_amount was fixed
 * when they subscribed. Only new checkouts see the new price.
 */
export async function applyFxSuggestions(
  planIds: string[],
  currency = 'NGN',
): Promise<{ applied: number }> {
  const review = await reviewFxPricing(currency);
  if (!review.rate) return { applied: 0 };

  let applied = 0;
  for (const s of review.suggestions) {
    if (!planIds.includes(s.planId)) continue;
    await repo.upsertPlanPrice(s.planId, s.currency, s.suggestedMonthly, s.suggestedYearly);
    applied += 1;
    logger.info(
      { planSlug: s.planSlug, currency: s.currency, from: s.currentMonthly, to: s.suggestedMonthly },
      'FX price suggestion applied',
    );
  }
  return { applied };
}
