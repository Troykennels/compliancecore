import { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday,
  addMonths, subMonths, format, parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useOrgFormat } from '@/lib/org-format';
import type { CalendarEvent } from '../types/calendar.types';

interface CalendarGridProps {
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const MAX_VISIBLE_PER_DAY = 3;

export function CalendarGrid({ events, onDayClick, onEventClick }: CalendarGridProps) {
  const fmt = useOrgFormat();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Events are instants, so their calendar day depends on the timezone you read
  // them in. Bucketing by the browser's date puts an event created at 00:30 in
  // Lagos on the previous day for a reviewer in New York — the same record
  // landing on different cells for different people. Key on the organisation's
  // timezone so everyone sees it on the day it actually happened.
  //
  // The grid cells themselves stay as they are: they represent wall-clock
  // calendar days rather than instants, so converting them would shift the whole
  // month.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = fmt.toDayKey(e.startDate) ?? format(parseISO(e.startDate), 'yyyy-MM-dd');
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events, fmt]);

  return (
    // min-h-full, not h-full: the grid must be free to grow past the viewport
    // so the scroll container above it has something to scroll, while still
    // filling the space on a tall screen.
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="rounded-lg p-2 hover:bg-slate-100 text-slate-600"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-base font-semibold text-slate-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="rounded-lg p-2 hover:bg-slate-100 text-slate-600"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day-of-week labels. Sticky, because the grid scrolls now and a column
          of dates with no day names above it is unreadable. */}
      <div className="sticky top-0 z-10 mb-1 grid grid-cols-7 bg-slate-50">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
          <div key={d} className="py-1 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1 border-l border-t border-slate-200">
        {days.map((day) => {
          const key      = format(day, 'yyyy-MM-dd');
          const dayEvts  = eventsByDay.get(key) ?? [];
          const overflow = dayEvts.length - MAX_VISIBLE_PER_DAY;
          const inMonth  = isSameMonth(day, currentMonth);

          return (
            <div
              key={key}
              onClick={() => onDayClick(day)}
              className={[
                'border-b border-r border-slate-200 p-1 min-h-[100px] cursor-pointer transition-colors',
                inMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60',
              ].join(' ')}
            >
              {/* Day number */}
              <div className="flex justify-end mb-1">
                <span
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    isToday(day)
                      ? 'bg-blue-600 text-white'
                      : inMonth
                        ? 'text-slate-700'
                        : 'text-slate-400',
                  ].join(' ')}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-0.5">
                {dayEvts.slice(0, MAX_VISIBLE_PER_DAY).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                    style={{ backgroundColor: ev.color }}
                    className="w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white leading-4 hover:opacity-90 transition-opacity"
                    title={ev.title}
                  >
                    {ev.title}
                  </button>
                ))}
                {overflow > 0 && (
                  <div className="px-1 text-[11px] text-slate-500 font-medium">
                    +{overflow} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Today button */}
      <div className="mt-3 flex justify-center">
        <button
          onClick={() => setCurrentMonth(new Date())}
          className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          Today
        </button>
      </div>
    </div>
  );
}
