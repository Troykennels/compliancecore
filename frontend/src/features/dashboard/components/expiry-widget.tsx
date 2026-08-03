import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ExpiryUrgentItem } from '../api/dashboard.api';
import { useOrgFormat } from '@/lib/org-format';

interface ExpiryWidgetProps {
  items: ExpiryUrgentItem[];
  expiringSoon: number;
  expired: number;
}

function urgencyClass(daysUntil: number): string {
  if (daysUntil < 0)  return 'text-red-600 bg-red-50';
  if (daysUntil <= 7) return 'text-red-600 bg-red-50';
  if (daysUntil <= 30) return 'text-amber-600 bg-amber-50';
  return 'text-yellow-600 bg-yellow-50';
}

function daysLabel(daysUntil: number): string {
  if (daysUntil < 0)   return `${Math.abs(daysUntil)}d overdue`;
  if (daysUntil === 0) return 'Today';
  return `${daysUntil}d`;
}

export function ExpiryWidget({ items, expiringSoon, expired }: ExpiryWidgetProps) {
  const fmt = useOrgFormat();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
        <AlertTriangle className="h-7 w-7 mb-2 opacity-30" />
        <p className="text-xs">No urgent expirations</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-3">
        {expiringSoon > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            {expiringSoon} expiring soon
          </span>
        )}
        {expired > 0 && (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
            {expired} expired
          </span>
        )}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
          onClick={() => navigate('/expiry')}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
            <p className="text-[11px] text-slate-500">
              {fmt.formatDateMedium(item.expiryDate)}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${urgencyClass(item.daysUntil)}`}>
            {daysLabel(item.daysUntil)}
          </span>
        </div>
      ))}
      <button
        onClick={() => navigate('/expiry')}
        className="w-full flex items-center justify-center gap-1.5 mt-1 rounded-lg border border-slate-200 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
      >
        View all <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
