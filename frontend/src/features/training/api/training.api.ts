import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type {
  TrainingProgram,
  TrainingFilters,
  TrainingProgramListResult,
  TrainingRecord,
  CreateTrainingInput,
  UpdateTrainingInput,
  AssignTrainingRecordsInput,
} from '../types/training.types';

export const trainingApi = {
  list(filters: TrainingFilters = {}) {
    return apiClient.get<ApiResponse<TrainingProgramListResult>>('/training', { params: filters });
  },

  get(id: string) {
    return apiClient.get<ApiResponse<TrainingProgram>>(`/training/${id}`);
  },

  create(input: CreateTrainingInput) {
    return apiClient.post<ApiResponse<TrainingProgram>>('/training', input);
  },

  update(id: string, input: UpdateTrainingInput) {
    return apiClient.patch<ApiResponse<TrainingProgram>>(`/training/${id}`, input);
  },

  remove(id: string) {
    return apiClient.delete(`/training/${id}`);
  },

  records(id: string) {
    return apiClient.get<ApiResponse<TrainingRecord[]>>(`/training/${id}/records`);
  },

  assignRecords(id: string, input: AssignTrainingRecordsInput) {
    return apiClient.post<ApiResponse<TrainingRecord[]>>(`/training/${id}/records`, input);
  },
};
