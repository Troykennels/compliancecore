import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type { CalendarEvent, CalendarFilters, CreateCalendarEventDto } from '../types/calendar.types';

export const calendarApi = {
  list(filters: CalendarFilters = {}) {
    return apiClient.get<ApiResponse<{ events: CalendarEvent[]; total: number }>>('/calendar', { params: filters });
  },
  getById(id: string) {
    return apiClient.get<ApiResponse<CalendarEvent>>(`/calendar/${id}`);
  },
  getUpcoming(days = 14) {
    return apiClient.get<ApiResponse<CalendarEvent[]>>('/calendar/upcoming', { params: { days } });
  },
  create(dto: CreateCalendarEventDto) {
    return apiClient.post<ApiResponse<CalendarEvent>>('/calendar', dto);
  },
  update(id: string, dto: Partial<CreateCalendarEventDto> & { status?: string }) {
    return apiClient.patch<ApiResponse<CalendarEvent>>(`/calendar/${id}`, dto);
  },
  delete(id: string) {
    return apiClient.delete(`/calendar/${id}`);
  },
};
