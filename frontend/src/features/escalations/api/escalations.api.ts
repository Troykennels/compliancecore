import { apiClient } from '@/lib/api-client';
import type {
  EscalationRule,
  EscalationEvent,
  CreateEscalationRuleDto,
  EscalationFilters,
  EscalationEventFilters,
} from '../types/escalations.types';

export const escalationsApi = {
  listRules(filters: EscalationFilters = {}) {
    return apiClient.get<{ data: { items: EscalationRule[]; total: number } }>('/escalations/rules', { params: filters });
  },

  getRule(id: string) {
    return apiClient.get<{ data: EscalationRule }>(`/escalations/rules/${id}`);
  },

  createRule(dto: CreateEscalationRuleDto) {
    return apiClient.post<{ data: EscalationRule }>('/escalations/rules', dto);
  },

  updateRule(id: string, dto: Partial<CreateEscalationRuleDto>) {
    return apiClient.patch<{ data: EscalationRule }>(`/escalations/rules/${id}`, dto);
  },

  toggleRule(id: string) {
    return apiClient.post<{ data: EscalationRule }>(`/escalations/rules/${id}/toggle`);
  },

  deleteRule(id: string) {
    return apiClient.delete<{ data: { message: string } }>(`/escalations/rules/${id}`);
  },

  listEvents(filters: EscalationEventFilters = {}) {
    return apiClient.get<{ data: { items: EscalationEvent[]; total: number } }>('/escalations/events', { params: filters });
  },

  resolveEvent(id: string, resolutionNote?: string) {
    return apiClient.post<{ data: EscalationEvent }>(`/escalations/events/${id}/resolve`, { resolutionNote });
  },
};
