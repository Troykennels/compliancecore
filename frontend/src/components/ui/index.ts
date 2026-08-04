/**
 * Shared presentation layer.
 *
 * Purely visual — no data fetching, no routing, no permission logic. Anything
 * here can be swapped without touching a workflow.
 */
export { Card, CardHeader } from './card';
export { Button, type ButtonProps } from './button';
export { EmptyState, ErrorState } from './empty-state';
export { StatusPill, SeverityMeter, type StatusTone } from './status-pill';
export { PageHeader, PageShell, SectionHeader } from './page-header';
export {
  Skeleton,
  SkeletonRegion,
  SkeletonCard,
  SkeletonChart,
  SkeletonMetricCard,
  SkeletonTable,
} from './skeleton';
