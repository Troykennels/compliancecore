import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/**
 * Empty and error states.
 *
 * Nearly every list page defined its own local `EmptyState` and `ErrorState`
 * with slightly different copy, icon size and button style. Consolidating them
 * makes the product feel like one system, and gives one place to hold the rule
 * that matters: an empty state should say what the thing is for and offer the
 * action, not just report an absence.
 */

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  /** One sentence on why this screen matters and what appears here. */
  description?: string;
  action?: React.ReactNode;
  /** Secondary hint, e.g. what to try when a filter returned nothing. */
  hint?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, hint, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      {/* Concentric rings rather than a flat disc — reads as a considered mark
          instead of a placeholder blob, and stays quiet in the layout. */}
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-brand-50" />
        <span className="absolute inset-2 rounded-full bg-brand-100/70" />
        <span className="relative text-brand-600 [&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
      {hint && <p className="mt-4 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "We couldn't load this",
  // Says what to do next. "Something went wrong" tells the reader nothing they
  // did not already know from the screen being empty.
  description = 'The request did not complete. This is usually temporary — try again, and if it keeps happening your connection or our service may be at fault.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}
    >
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-red-50" />
        <span className="absolute inset-2 rounded-full bg-red-100/70" />
        <AlertTriangle className="relative h-6 w-6 text-red-600" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}
