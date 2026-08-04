import React from 'react';
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tones are named rather than passed as raw utility strings.
 *
 * The card used to take a `colorClass` like `"bg-blue-100 text-blue-600"` from
 * each call site, which is how the palette drifted in the first place. It also
 * makes derived shades impossible: Tailwind compiles the classes it can find in
 * the source, so a class assembled at runtime produces no CSS at all and the
 * element silently renders unstyled.
 */
export type MetricTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

const TONES: Record<MetricTone, { tile: string; rule: string }> = {
  brand: { tile: 'bg-brand-50 text-brand-600', rule: 'bg-brand-500' },
  success: { tile: 'bg-green-50 text-green-600', rule: 'bg-green-500' },
  warning: { tile: 'bg-amber-50 text-amber-600', rule: 'bg-amber-500' },
  danger: { tile: 'bg-red-50 text-red-600', rule: 'bg-red-500' },
  neutral: { tile: 'bg-slate-100 text-slate-500', rule: 'bg-slate-400' },
};

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  tone?: MetricTone;
  onClick?: () => void;
}

/**
 * Headline metric.
 *
 * Two changes beyond the styling. It was a `<div onClick>`, so a keyboard user
 * could neither reach nor fire it and a screen reader never announced it as
 * interactive — it is now a real button whenever it navigates. And the figure
 * is set in tabular numerals so a row of cards keeps its digits on a common
 * grid instead of shifting as the numbers update.
 */
export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  tone = 'neutral',
  onClick,
}: MetricCardProps) {
  const t = TONES[tone];
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-left shadow-xs',
        'transition duration-200 ease-out',
        onClick &&
          'w-full hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0',
      )}
    >
      {/* A hairline of the metric's own tone along the top edge on hover. Ties
          the number to its status without tinting the whole card, which would
          make a row of four shout at once. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity duration-200',
          t.rule,
          onClick && 'group-hover:opacity-100',
        )}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{title}</p>
          <p data-numeric className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          {subtitle && <p className="mt-1 truncate text-xs text-slate-500">{subtitle}</p>}
          {trend && (
            <p
              className={cn(
                'mt-2 inline-flex items-center gap-1 text-xs font-medium',
                trend.value >= 0 ? 'text-green-700' : 'text-red-700',
              )}
            >
              {trend.value >= 0
                ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
              {trend.value >= 0 ? '+' : ''}{trend.value}%
              <span className="font-normal text-slate-500">{trend.label}</span>
            </p>
          )}
        </div>

        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200',
            onClick && 'group-hover:scale-105',
            t.tile,
          )}
        >
          {icon}
        </div>
      </div>

      {/* Only on hover, and only when the card actually goes somewhere, so the
          affordance stays honest. */}
      {onClick && (
        <ArrowUpRight
          aria-hidden="true"
          className="absolute bottom-4 right-4 h-4 w-4 text-slate-300 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
        />
      )}
    </Wrapper>
  );
}
