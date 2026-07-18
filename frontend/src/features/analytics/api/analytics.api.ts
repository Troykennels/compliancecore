import { apiClient } from '@/lib/api-client';
import type { AnalyticsOverview } from '../types/analytics.types';

export const analyticsApi = {
  getOverview() {
    return apiClient.get<{ data: AnalyticsOverview }>('/analytics/overview');
  },
};
