import React from 'react';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * The house button.
 *
 * Primary actions were previously written inline, and drifted: `bg-indigo-600`
 * on list pages, `bg-blue-600` in the shell, differing radii, and no disabled
 * or busy treatment on most of them. This centralises the states that are easy
 * to forget — hover, active, focus, disabled and pending.
 */

const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold',
    'transition duration-150 ease-out',
    'disabled:pointer-events-none disabled:opacity-50',
    // Icons should never stretch when the label wraps.
    '[&>svg]:shrink-0',
  ),
  {
    variants: {
      variant: {
        primary: cn(
          'bg-brand-600 text-white shadow-xs',
          'hover:bg-brand-700 active:bg-brand-800',
        ),
        secondary: cn(
          'border border-slate-300 bg-white text-slate-700 shadow-xs',
          'hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100',
        ),
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        danger: cn(
          'bg-red-600 text-white shadow-xs',
          'hover:bg-red-700 active:bg-red-800',
        ),
        // For destructive actions that are not the primary action on screen.
        'danger-quiet': 'text-red-600 hover:bg-red-50',
        link: 'text-brand-600 underline-offset-4 hover:text-brand-700 hover:underline',
      },
      size: {
        sm: 'h-8 px-2.5 text-xs [&>svg]:h-3.5 [&>svg]:w-3.5',
        md: 'h-9 px-3.5 text-sm [&>svg]:h-4 [&>svg]:w-4',
        lg: 'h-10 px-4 text-sm [&>svg]:h-4 [&>svg]:w-4',
        icon: 'h-9 w-9 [&>svg]:h-4 [&>svg]:w-4',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner and blocks input. Use for anything that hits the network. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      // Tells assistive tech the control is working rather than unresponsive.
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
