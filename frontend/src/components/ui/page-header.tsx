import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Page header and page shell.
 *
 * Titles previously ranged from `text-xl` to `text-2xl` with different weights
 * and gutters per screen, so moving between pages felt like moving between
 * products. These two components fix the frame: same gutter, same title size,
 * same place for the primary action.
 */

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Primary and secondary actions, right-aligned on desktop. */
  actions?: React.ReactNode;
  /** The menu group or parent record, shown above the title. */
  eyebrow?: React.ReactNode;
  /** Short facts shown under the title, such as status, owner and dates. */
  meta?: React.ReactNode[];
  /** Anything that belongs inside the header card, such as summary chips. */
  children?: React.ReactNode;
  className?: string;
}

/** The one page header: eyebrow, title, facts, purpose and actions in one bordered card, the same on every page. */
export function PageHeader({ title, description, actions, eyebrow, meta, children, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        // Stacks on a phone so the action never squeezes the title; sits inline from `sm` upwards.
        'flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">{eyebrow}</p>}
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
        {meta && meta.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600">
            {meta.map((m, i) => <span key={i} className="inline-flex items-center">{m}</span>)}
          </p>
        )}
        {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}

/**
 * Standard page container. Consistent max width and gutter, with the vertical
 * rhythm handled by `space-y` rather than per-element margins so sections cannot
 * collapse or double up against each other.
 */
export function PageShell({
  children,
  className,
  width = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  /** `wide` for dashboards and reports that benefit from the extra columns. */
  width?: 'default' | 'wide' | 'full';
}) {
  return (
    <div className="min-h-full bg-slate-50">
      <div
        className={cn(
          'mx-auto space-y-6 p-4 sm:p-6',
          width === 'default' && 'max-w-7xl',
          width === 'wide' && 'max-w-[90rem]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A labelled band inside a page, for grouping panels under a heading without
 * nesting another card.
 */
export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
