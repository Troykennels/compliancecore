import React from 'react';
import { cn } from '@/lib/utils';

/**
 * The house card.
 *
 * Every screen was hand-rolling `rounded-2xl border border-slate-200 bg-white
 * px-5 py-4` with small variations, so radius, padding and elevation drifted
 * between pages. One component makes the surface consistent and gives hover and
 * focus a single definition.
 */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Renders the card as a button when it navigates somewhere. */
  onActivate?: () => void;
  /** Removes padding when the card holds a table or chart that bleeds edge to edge. */
  flush?: boolean;
}

export function Card({ className, children, onActivate, flush, ...props }: CardProps) {
  const base = cn(
    'rounded-xl border border-slate-200 bg-white shadow-xs',
    !flush && 'p-5',
    className,
  );

  // A clickable card must be a real button: the previous `<div onClick>` could
  // not be reached by keyboard and was invisible to screen readers.
  if (onActivate) {
    return (
      <button
        type="button"
        onClick={onActivate}
        className={cn(
          base,
          'w-full text-left transition duration-200 ease-out',
          'hover:border-slate-300 hover:shadow-md',
          'active:translate-y-px',
        )}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement> as object)}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={base} {...props}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  /** Supporting line under the title. */
  description?: React.ReactNode;
  /** Right-aligned slot: a "View all" link, a filter, an icon. */
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
