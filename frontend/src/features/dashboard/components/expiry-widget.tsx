import { CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ExpiryUrgentItem } from '../api/dashboard.api';
import { useOrgFormat } from '@/lib/org-format';
import { StatusPill, type StatusTone } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ExpiryWidgetProps {
  items: ExpiryUrgentItem[];
  expiringSoon: number;
  expired: number;
}

/**
 * Urgency bands. The old version mapped "overdue" and "within 7 days" to the
 * identical red, so the most serious state on the widget — something that has
 * already lapsed — was indistinguishable from something merely due this week.
 */
function urgency(daysUntil: number): { tone: StatusTone; label: string; rail: string } {
  if (daysUntil < 0) {
    return {
      tone: 'danger',
      label: `${Math.abs(daysUntil)}d overdue`,
      rail: 'bg-red-600',
    };
  }
  if (daysUntil === 0) return { tone: 'danger', label: 'Due today', rail: 'bg-red-500' };
  if (daysUntil <= 7) return { tone: 'warning', label: `${daysUntil}d left`, rail: 'bg-amber-500' };
  if (daysUntil <= 30) return { tone: 'warning', label: `${daysUntil}d left`, rail: 'bg-amber-400' };
  return { tone: 'neutral', label: `${daysUntil}d left`, rail: 'bg-slate-300' };
}

export function ExpiryWidget({ items, expiringSoon, expired }: ExpiryWidgetProps) {
  const fmt = useOrgFormat();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        {/* Nothing expiring is good news, so it reads as a pass rather than as
            a warning icon dimmed to 30% opacity. */}
        <CheckCircle2 className="mb-2 h-7 w-7 text-green-500" aria-hidden="true" />
        <p className="text-xs font-medium text-slate-700">Nothing expiring soon</p>
        <p className="mt-0.5 text-2xs text-slate-400">
          Certificates and policies with a renewal date will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {(expiringSoon > 0 || expired > 0) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {expired > 0 && (
            <StatusPill tone="danger" size="md">{expired} expired</StatusPill>
          )}
          {expiringSoon > 0 && (
            <StatusPill tone="warning" size="md">{expiringSoon} expiring soon</StatusPill>
          )}
        </div>
      )}

      <ul className="space-y-1.5">
        {items.map((item) => {
          const u = urgency(item.daysUntilExpiry);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => navigate('/expiry')}
                className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
              >
                {/* Severity rail: readable at a glance and in greyscale print. */}
                <span className={cn('h-8 w-1 shrink-0 rounded-full', u.rail)} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{item.name}</span>
                  <span className="block text-2xs text-slate-500">
                    {fmt.formatDateMedium(item.expiryDate)}
                  </span>
                </span>
                <StatusPill tone={u.tone} dot={false}>{u.label}</StatusPill>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
