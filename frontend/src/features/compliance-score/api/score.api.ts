import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type { OverallScore, ScoreTrendPoint, ScoreSnapshot } from '../types/score.types';

export const scoreApi = {
  getCurrent() {
    return apiClient.get<ApiResponse<OverallScore>>('/compliance-score/current');
  },
  getTrend(days = 180) {
    return apiClient.get<ApiResponse<ScoreTrendPoint[]>>('/compliance-score/trend', { params: { days } });
  },
  getLatestSnapshot() {
    return apiClient.get<ApiResponse<ScoreSnapshot>>('/compliance-score/snapshot');
  },
  triggerSnapshot() {
    return apiClient.post<ApiResponse<{ message: string }>>('/compliance-score/snapshot', {});
  },
};
