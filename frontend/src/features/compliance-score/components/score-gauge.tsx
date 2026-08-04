import { useId } from 'react';
import { CHART, scoreBand, scoreColor } from '@/lib/chart-theme';

interface ScoreGaugeProps {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

/**
 * Overall compliance score.
 *
 * This is the number an executive looks at first and often the only one they
 * remember, so it earns more care than a percentage in a box:
 *
 * - the arc sweeps on from zero when it mounts, which draws the eye to the
 *   figure and reads as a measurement being taken;
 * - the band ("Strong", "At risk") is stated in words, so the reading does not
 *   depend on distinguishing amber from green;
 * - it exposes a `meter` role, so a screen reader announces "72 out of 100"
 *   rather than silence — previously the SVG was invisible to assistive tech.
 */
export function ScoreGauge({ score, size = 160, strokeWidth = 14, label }: ScoreGaugeProps) {
  const gradientId = useId();
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // 270° arc (start at 225°, sweep 270°)
  const startAngle = 225;
  const sweepAngle = 270;
  const pct = score !== null ? Math.min(Math.max(score, 0), 100) / 100 : 0;
  const fill = sweepAngle * pct;

  function polarToCartesian(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function describeArc(start: number, sweep: number) {
    const end     = start + sweep;
    const s       = polarToCartesian(start);
    const e       = polarToCartesian(end);
    const large   = sweep > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const color = scoreColor(score);
  const band = scoreBand(score);
  // Arc length of the filled section, used as the dash offset so the stroke can
  // be animated on rather than appearing fully drawn.
  const arcLength = (Math.PI * 2 * radius * fill) / 360;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="meter"
        aria-valuenow={score ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={score !== null ? `${Math.round(score)} out of 100 — ${band}` : 'Not yet scored'}
        aria-label={label ?? 'Compliance score'}
      >
        <defs>
          {/* A slight lightening along the sweep gives the arc dimension
              without resorting to a drop shadow. */}
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.75" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d={describeArc(startAngle, sweepAngle)}
          fill="none"
          stroke={CHART.track}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Fill */}
        {pct > 0 && (
          <path
            d={describeArc(startAngle, fill)}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="animate-draw-in"
            // Consumed by the `draw-in` keyframes; reduced-motion collapses the
            // duration globally, so the arc simply appears for anyone who has
            // asked for less movement.
            style={{ '--dash': arcLength, strokeDasharray: arcLength } as React.CSSProperties}
          />
        )}

        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.24}
          fontWeight="600"
          letterSpacing="-0.02em"
          fill={score !== null ? CHART.ink : CHART.axis}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {score !== null ? Math.round(score) : '—'}
        </text>
        <text
          x={cx}
          y={cy + size * 0.15}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.085}
          fill={color}
          fontWeight="600"
          letterSpacing="0.06em"
        >
          {band.toUpperCase()}
        </text>
      </svg>
      {label && <p className="-mt-1 text-xs text-slate-500">{label}</p>}
    </div>
  );
}
