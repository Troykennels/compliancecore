import { useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Plus, Calendar, List, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useCalendarEvents, useDeleteCalendarEvent } from '../hooks/use-calendar';
import { CalendarGrid } from '../components/calendar-grid';
import { CalendarEventModal } from '../components/calendar-event-modal';
import type { CalendarEvent, CalendarEventType, CalendarEventStatus } from '../types/calendar.types';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS, STATUS_LABELS } from '../types/calendar.types';

type ViewMode = 'month' | 'list';

const STATUS_BADGE: Record<CalendarEventStatus, string> = {
  upcoming:    'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-slate-100 text-slate-500',
  overdue:     'bg-red-100 text-red-700',
};

const DEFAULT_BADGE = 'bg-slate-100 text-slate-500';
const DEFAULT_EVENT_COLOR = '#64748B';

function safeFormat(dateStr: string | null | undefined, fmt: string): string | null {
  if (!dateStr) return null;
  const parsed = parseISO(dateStr);
  return isValid(parsed) ? format(parsed, fmt) : null;
}

export function CalendarPage() {
  const [view, setView]             = useState<ViewMode>('month');
  const [modalOpen, setModalOpen]   = useState(false);
  const [selected, setSelected]     = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<CalendarEventType | ''>('');
  const [filterStatus, setFilterStatus] = useState<CalendarEventStatus | ''>('');

  const { data, isLoading, isError, refetch } = useCalendarEvents({
    eventType: filterType || undefined,
    status:    filterStatus || undefined,
  });
  const deleteEvent = useDeleteCalendarEvent();

  const events: CalendarEvent[] = data?.events ?? [];

  function openCreate(date?: Date) {
    setSelected(null);
    setDefaultDate(date ?? null);
    setModalOpen(true);
  }

  function openEdit(ev: CalendarEvent) {
    setSelected(ev);
    setDefaultDate(null);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    // Fire-and-forget: the hook surfaces success/error toasts. Using mutate (not
    // mutateAsync) avoids an unhandled promise rejection when the delete fails.
    if (confirm('Delete this event?')) {
      deleteEvent.mutate(id);
    }
  }

  return (
    <div className="flex flex-col h-full px-6 py-6 gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Compliance Calendar</h1>
          <p className="text-sm text-slate-500 mt-0.5">Deadlines, reviews, audits and renewals</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-white">
            <button
              onClick={() => setView('month')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === 'month' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-4 w-4" /> Month
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="h-4 w-4" /> List
            </button>
          </div>
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> New Event
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 shrink-0">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as CalendarEventType | '')}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="">All Types</option>
          {(Object.entries(EVENT_TYPE_LABELS) as [CalendarEventType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as CalendarEventStatus | '')}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="">All Statuses</option>
          {(Object.entries(STATUS_LABELS) as [CalendarEventStatus, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-slate-500">{events.length} event{events.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">Loading events…</div>
      ) : isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm">Couldn't load calendar events.</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      ) : view === 'month' ? (
        // Scrolls, rather than clipping. A month can run to six week rows and
        // each cell holds a stack of events, so the grid needs ~600px before
        // the page header and filters are counted — more than a laptop viewport
        // has. With overflow-hidden the last weeks of the month were simply
        // cut off and there was no way to reach them.
        <div className="flex-1 overflow-y-auto">
          <CalendarGrid
            events={events}
            onDayClick={(date) => openCreate(date)}
            onEventClick={(ev) => openEdit(ev)}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm">No events found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => {
                const startLabel = safeFormat(ev.startDate, 'MMM d, yyyy h:mm a');
                const endLabel = safeFormat(ev.endDate, 'MMM d, yyyy h:mm a');
                return (
                <div
                  key={ev.id}
                  className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:shadow-sm transition-shadow"
                >
                  <div
                    className="mt-1 h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: ev.color || EVENT_TYPE_COLORS[ev.eventType] || DEFAULT_EVENT_COLOR }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 text-sm truncate">{ev.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[ev.status] ?? DEFAULT_BADGE}`}>
                        {STATUS_LABELS[ev.status] ?? ev.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {startLabel ?? '—'}
                      {endLabel && ` – ${endLabel}`}
                    </p>
                    {ev.description && (
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">{ev.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(ev)}
                      className="rounded-md px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="rounded-md px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <CalendarEventModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        event={selected}
        defaultDate={defaultDate}
      />
    </div>
  );
}
