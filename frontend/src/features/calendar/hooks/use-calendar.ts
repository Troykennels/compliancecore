import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { calendarApi } from '../api/calendar.api';
import type { CalendarFilters, CreateCalendarEventDto } from '../types/calendar.types';

export const calendarKeys = {
  all: ['calendar'] as const,
  lists: () => [...calendarKeys.all, 'list'] as const,
  list: (f: CalendarFilters) => [...calendarKeys.lists(), f] as const,
  detail: (id: string) => [...calendarKeys.all, 'detail', id] as const,
  upcoming: (days: number) => [...calendarKeys.all, 'upcoming', days] as const,
};

export function useCalendarEvents(filters: CalendarFilters = {}) {
  return useQuery({
    queryKey: calendarKeys.list(filters),
    queryFn: () => calendarApi.list(filters).then((r) => r.data.data!),
    placeholderData: (prev) => prev,
  });
}

export function useCalendarEvent(id: string) {
  return useQuery({
    queryKey: calendarKeys.detail(id),
    queryFn: () => calendarApi.getById(id).then((r) => r.data.data!),
    enabled: Boolean(id),
  });
}

export function useUpcomingEvents(days = 14) {
  return useQuery({
    queryKey: calendarKeys.upcoming(days),
    queryFn: () => calendarApi.getUpcoming(days).then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCalendarEventDto) => calendarApi.create(dto).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.lists() });
      qc.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success('Event created.');
    },
    onError: () => toast.error('Failed to create event.'),
  });
}

export function useUpdateCalendarEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<CreateCalendarEventDto> & { status?: string }) =>
      calendarApi.update(id, dto).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.lists() });
      qc.invalidateQueries({ queryKey: calendarKeys.detail(id) });
      toast.success('Event updated.');
    },
    onError: () => toast.error('Failed to update event.'),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendarApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.lists() });
      toast.success('Event deleted.');
    },
    onError: () => toast.error('Failed to delete event.'),
  });
}
