
interface ScoreGaugeProps {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

function scoreColor(score: number | null): string {
  if (score === null) return '#94A3B8';
  if (score >= 80) return '#22C55E';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#F97316';
  return '#EF4444';
}

function scoreLabel(score: number | null): string {
  if (score === null) return 'N/A';
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Adequate';
  if (score >= 40) return 'Fair';
  return 'At Risk';
}

export function ScoreGauge({ score, size = 160, strokeWidth = 14, label }: ScoreGaugeProps) {
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

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <path
          d={describeArc(startAngle, sweepAngle)}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Fill */}
        {pct > 0 && (
          <path
            d={describeArc(startAngle, fill)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ transition: 'all 0.6s ease-out' }}
          />
        )}
        {/* Score text */}
        <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.22} fontWeight="700" fill={score !== null ? '#0F172A' : '#94A3B8'}>
          {score !== null ? Math.round(score) : '—'}
        </text>
        <text x={cx} y={cy + size * 0.14} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.09} fill={color} fontWeight="600">
          {scoreLabel(score)}
        </text>
      </svg>
      {label && <p className="text-xs text-slate-500 -mt-1">{label}</p>}
    </div>
  );
}
