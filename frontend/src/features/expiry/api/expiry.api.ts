import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type { ExpiryItem, ExpiryFilters, CreateExpiryItemDto } from '../types/expiry.types';

export const expiryApi = {
  list(filters: ExpiryFilters = {}) {
    return apiClient.get<ApiResponse<{ items: ExpiryItem[]; total: number }>>('/expiry', { params: filters });
  },
  getById(id: string) {
    return apiClient.get<ApiResponse<ExpiryItem>>(`/expiry/${id}`);
  },
  getExpiringSoon(days = 30) {
    return apiClient.get<ApiResponse<ExpiryItem[]>>('/expiry/expiring-soon', { params: { days } });
  },
  getStats() {
    return apiClient.get<ApiResponse<{ active: number; expiringSoon: number; expired: number; renewed: number; cancelled: number }>>('/expiry/stats');
  },
  create(dto: CreateExpiryItemDto) {
    return apiClient.post<ApiResponse<ExpiryItem>>('/expiry', dto);
  },
  update(id: string, dto: Partial<CreateExpiryItemDto> & { status?: string }) {
    return apiClient.patch<ApiResponse<ExpiryItem>>(`/expiry/${id}`, dto);
  },
  delete(id: string) {
    return apiClient.delete(`/expiry/${id}`);
  },
};
