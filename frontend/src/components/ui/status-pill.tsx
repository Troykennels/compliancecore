import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Status pill.
 *
 * Status is the primary data type in a GRC tool — a control is implemented or
 * it is not, a risk is critical or it is low — so it earns a deliberate
 * treatment rather than a coloured rectangle.
 *
 * The dot matters. Roughly one in twelve men has some form of colour vision
 * deficiency, and these screens get printed in black and white for audit packs,
 * so tone alone cannot be the only carrier of meaning. Each tone pairs a
 * distinct fill with a distinct label, and the dot gives a second, non-colour
 * cue at a glance.
 */

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'progress';

const TONES: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: 'bg-green-50 text-green-700 ring-green-600/20', dot: 'bg-green-600' },
  warning: { pill: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' },
  danger: { pill: 'bg-red-50 text-red-700 ring-red-600/20', dot: 'bg-red-600' },
  info: { pill: 'bg-brand-50 text-brand-700 ring-brand-600/20', dot: 'bg-brand-600' },
  progress: { pill: 'bg-brand-50 text-brand-700 ring-brand-600/20', dot: 'bg-brand-400' },
  neutral: { pill: 'bg-slate-100 text-slate-600 ring-slate-500/20', dot: 'bg-slate-400' },
};

interface StatusPillProps {
  tone?: StatusTone;
  children: React.ReactNode;
  /** Hide the dot where the pill already sits beside an icon. */
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusPill({
  tone = 'neutral',
  children,
  dot = true,
  size = 'sm',
  className,
}: StatusPillProps) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        // A 1px inset ring instead of a border keeps the pill from changing
        // size and reads crisper than a flat fill on a white table row.
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
        t.pill,
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', t.dot)} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * Severity bar for risk and criticality — four steps, filled to the level.
 * Ranked data reads faster as a quantity than as a word, and unlike a pill it
 * survives greyscale printing entirely.
 */
export function SeverityMeter({
  level,
  max = 4,
  tone = 'danger',
  label,
}: {
  level: number;
  max?: number;
  tone?: StatusTone;
  label: string;
}) {
  const t = TONES[tone];
  return (
    <span className="inline-flex items-center gap-2" title={label}>
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'w-1 rounded-sm transition-colors',
              i < level ? t.dot : 'bg-slate-200',
            )}
            style={{ height: `${6 + i * 3}px` }}
          />
        ))}
      </span>
      <span className="text-xs font-medium text-slate-700">{label}</span>
    </span>
  );
}
