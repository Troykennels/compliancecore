import { cn } from '@/lib/utils';

/**
 * Loading placeholders.
 *
 * The app showed either a centred spinner or the words "Loading dashboard…".
 * Both tell you that something is happening but not what is coming, so the page
 * appears to jump into existence when the data lands. A skeleton that matches
 * the shape of the real content keeps the layout stable and makes the wait feel
 * shorter than it is.
 *
 * All of these are marked aria-hidden and sit inside a container that announces
 * the load, so a screen reader hears "Loading" once rather than reading out a
 * tree of empty boxes.
 */

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} aria-hidden="true" />;
}

/** Wraps a skeleton view so assistive tech announces the wait exactly once. */
export function SkeletonRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Matches the metric card: eyebrow, big number, subtitle, icon tile. */
export function SkeletonMetricCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-2.5 w-28" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
    </div>
  );
}

/** Generic panel: header line plus a few rows of content. */
export function SkeletonCard({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-xs', className)}>
      <Skeleton className="h-3.5 w-40" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-2.5 w-full max-w-[16rem]" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Table placeholder. Column widths vary per row so the block reads as text
 * arriving rather than as a uniform grey grid.
 */
export function SkeletonTable({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
  const widths = ['w-16', 'w-full max-w-[14rem]', 'w-24', 'w-20', 'w-24', 'w-20', 'w-16', 'w-24'];
  return (
    <SkeletonRegion label="Loading results">
      <table className="w-full">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-6 py-3 text-left">
                <Skeleton className="h-2.5 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="px-6 py-4">
                  <Skeleton className={cn('h-2.5', widths[(r + c) % widths.length])} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </SkeletonRegion>
  );
}

/** Placeholder for a chart panel — a header and a plot area of the right height. */
export function SkeletonChart({ height = 160, className }: { height?: number; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-xs', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-44" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="mt-5 w-full rounded-lg" style={{ height }} />
    </div>
  );
}
