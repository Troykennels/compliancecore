import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  Incident, IncidentFilters, IncidentListResult, IncidentStats, IncidentUpdate,
  CreateIncidentInput, UpdateIncidentInput, IncidentEntryType,
} from '../types/incidents.types';

export const incidentsApi = {
  list(filters: IncidentFilters = {}) {
    return apiClient.get<ApiResponse<IncidentListResult>>('/incidents', { params: filters });
  },

  stats() {
    return apiClient.get<ApiResponse<IncidentStats>>('/incidents/stats');
  },

  get(id: string) {
    return apiClient.get<ApiResponse<Incident>>(`/incidents/${id}`);
  },

  create(input: CreateIncidentInput) {
    return apiClient.post<ApiResponse<Incident>>('/incidents', input);
  },

  update(id: string, input: UpdateIncidentInput) {
    return apiClient.patch<ApiResponse<Incident>>(`/incidents/${id}`, input);
  },

  remove(id: string) {
    return apiClient.delete(`/incidents/${id}`);
  },

  updates(id: string) {
    return apiClient.get<ApiResponse<IncidentUpdate[]>>(`/incidents/${id}/updates`);
  },

  addUpdate(id: string, body: string, entryType: IncidentEntryType = 'note') {
    return apiClient.post<ApiResponse<IncidentUpdate>>(`/incidents/${id}/updates`, { body, entryType });
  },
};
