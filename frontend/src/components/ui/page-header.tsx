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
  /** Small contextual line above the title — a parent record, a framework name. */
  eyebrow?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        // Stacks on a phone so the action never squeezes the title to two
        // characters wide; sits inline from `sm` upwards.
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
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
          'mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8',
          width === 'default' && 'max-w-6xl',
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
