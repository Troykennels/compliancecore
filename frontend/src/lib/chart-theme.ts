/**
 * Chart palette.
 *
 * Recharts takes colours as literal values, so charts are the one place the
 * Tailwind palette cannot reach — every chart in the app had its own hard-coded
 * hex set, which is why the greens and ambers on the dashboard never quite
 * matched the badges beside them. These constants mirror the token layer in
 * `tailwind.config.js`; change a colour there and change it here.
 */

export const CHART = {
  brand: '#0F56C9',
  brandSoft: '#7FB2FF',
  brandWash: '#ECF4FF',

  success: '#0A7D58',
  successSoft: '#5FCDA4',
  warning: '#D9820A',
  warningSoft: '#F5B95A',
  danger: '#C8203A',
  dangerSoft: '#F49BA6',

  grid: '#E9EDF4',
  axis: '#97A1B4',
  track: '#DBE1EB',
  surface: '#FFFFFF',
  cursor: '#F4F6FA',
  ink: '#151C27',
} as const;

/**
 * Score bands, shared by the gauge, the trend chart and the coverage bars so a
 * 72% reads the same amber wherever it appears.
 */
export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return CHART.track;
  if (score >= 80) return CHART.success;
  if (score >= 60) return CHART.warning;
  if (score >= 40) return '#EE9E2E';
  return CHART.danger;
}

/** Matching label for a score, so colour is never the only signal. */
export function scoreBand(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'Not scored';
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Adequate';
  if (score >= 40) return 'At risk';
  return 'Critical';
}

/**
 * Categorical series colours, for charts where the slices are kinds rather than
 * grades. Ordered so neighbouring series stay distinguishable to someone with
 * red-green colour vision deficiency.
 */
export const CHART_SERIES = [
  '#0F56C9',
  '#0A7D58',
  '#D9820A',
  '#7FB2FF',
  '#C8203A',
  '#5FCDA4',
  '#4B5568',
  '#F5B95A',
] as const;
