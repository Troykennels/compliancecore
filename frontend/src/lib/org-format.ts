import { useQuery } from '@tanstack/react-query';
import { organizationApi } from '@/features/organizations/api/organization.api';
import type { DateFormat } from '@/features/organizations/types/organization.types';

/**
 * Date and time rendering in the organisation's own timezone and format.
 *
 * The organisation already stores `timezone` and `dateFormat`, but the app had
 * been rendering everything with raw `toLocaleString()` / hard-coded date-fns
 * patterns — i.e. in the *viewer's browser* timezone and in US month-day order.
 * For a compliance product that is not cosmetic: an incident detected at
 * 00:30 WAT shows as the previous day to a reviewer in London, and "05/12/2025"
 * means two different days either side of the Atlantic. Audit evidence has to
 * read the same for everyone looking at it.
 *
 * Uses Intl rather than date-fns-tz so timezone handling needs no extra
 * dependency, and falls back to sensible defaults before the profile loads.
 */

const DEFAULTS = { timezone: 'UTC', dateFormat: 'DD/MM/YYYY' as DateFormat };

interface Parts {
  day: string; month: string; year: string;
  hour: string; minute: string; monthName: string;
}

function extract(date: Date, timeZone: string): Parts {
  // en-GB with 2-digit options gives stable, zero-padded parts to reassemble.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  // Short month name for the compact forms, taken in the SAME timezone so it
  // cannot disagree with the numeric day above at a month boundary.
  const monthName = new Intl.DateTimeFormat('en-GB', { timeZone, month: 'short' })
    .formatToParts(date).find((p) => p.type === 'month')?.value ?? '';

  return {
    day: get('day'), month: get('month'), year: get('year'), monthName,
    // Intl renders midnight as "24" in some engines under hour12:false.
    hour: get('hour') === '24' ? '00' : get('hour'),
    minute: get('minute'),
  };
}

function applyPattern(p: Parts, pattern: DateFormat): string {
  switch (pattern) {
    case 'MM/DD/YYYY': return `${p.month}/${p.day}/${p.year}`;
    case 'YYYY-MM-DD': return `${p.year}-${p.month}-${p.day}`;
    case 'DD-MM-YYYY': return `${p.day}-${p.month}-${p.year}`;
    case 'DD/MM/YYYY':
    default:           return `${p.day}/${p.month}/${p.year}`;
  }
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

type Formatter = (value: string | Date | null | undefined, fallback?: string) => string;

export interface OrgFormatters {
  /** "31/12/2025" in the organisation's format and timezone. */
  formatDate: Formatter;
  /** "31/12/2025 14:05" — 24-hour, unambiguous for audit records. */
  formatDateTime: Formatter;
  /** "31 Dec" — compact, for chips and dense tables. Month name rather than a
   *  number, so it stays unambiguous even though the year is dropped. */
  formatDateShort: Formatter;
  /** "31 Dec 2025" — replaces the old hard-coded 'MMM d, yyyy' patterns. */
  formatDateMedium: Formatter;
  /** "31 Dec 2025 14:05". */
  formatDateTimeMedium: Formatter;
  /** "Dec 2025" — billing periods, where the day is noise. */
  formatMonthYear: Formatter;
  /** "14:05" in the organisation's timezone. */
  formatTime: Formatter;
  timezone: string;
  dateFormat: DateFormat;
}

export function makeOrgFormatters(timezone: string, dateFormat: DateFormat): OrgFormatters {
  const safeZone = (() => {
    try { new Intl.DateTimeFormat('en-GB', { timeZone: timezone }); return timezone; }
    catch { return DEFAULTS.timezone; } // a bad stored value must not crash the page
  })();

  type Style = 'date' | 'dateTime' | 'time' | 'short' | 'medium' | 'mediumTime' | 'monthYear';

  const fmt = (value: string | Date | null | undefined, style: Style, fallback: string) => {
    const date = toDate(value);
    if (!date) return fallback;
    const p = extract(date, safeZone);
    const time = `${p.hour}:${p.minute}`;

    switch (style) {
      case 'time':       return time;
      case 'short':      return `${Number(p.day)} ${p.monthName}`;
      case 'medium':     return `${Number(p.day)} ${p.monthName} ${p.year}`;
      case 'mediumTime': return `${Number(p.day)} ${p.monthName} ${p.year} ${time}`;
      case 'monthYear':  return `${p.monthName} ${p.year}`;
      case 'dateTime':   return `${applyPattern(p, dateFormat)} ${time}`;
      case 'date':
      default:           return applyPattern(p, dateFormat);
    }
  };

  return {
    formatDate:           (v, fallback = '—') => fmt(v, 'date', fallback),
    formatDateTime:       (v, fallback = '—') => fmt(v, 'dateTime', fallback),
    formatDateShort:      (v, fallback = '—') => fmt(v, 'short', fallback),
    formatDateMedium:     (v, fallback = '—') => fmt(v, 'medium', fallback),
    formatDateTimeMedium: (v, fallback = '—') => fmt(v, 'mediumTime', fallback),
    formatMonthYear:      (v, fallback = '—') => fmt(v, 'monthYear', fallback),
    formatTime:           (v, fallback = '—') => fmt(v, 'time', fallback),
    timezone: safeZone,
    dateFormat,
  };
}

/**
 * Formatters bound to the current organisation.
 *
 * The profile is cached by react-query and shared across every caller, so this
 * costs one request per session rather than one per component.
 */
export function useOrgFormat(): OrgFormatters {
  const { data } = useQuery({
    queryKey: ['organization', 'profile'],
    queryFn: () => organizationApi.getProfile().then((r) => r.data.data.organization),
    staleTime: 5 * 60 * 1000,
  });

  return makeOrgFormatters(
    data?.timezone ?? DEFAULTS.timezone,
    data?.dateFormat ?? DEFAULTS.dateFormat,
  );
}
