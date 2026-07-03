import { apiClient } from '@/lib/api-client';
import type {
  Task,
  TaskComment,
  TaskStats,
  CreateTaskDto,
  UpdateTaskDto,
  TaskFilters,
  TasksListResponse,
} from '../types/tasks.types';

export const tasksApi = {
  list(filters: TaskFilters = {}) {
    return apiClient.get<{ data: TasksListResponse }>('/tasks', { params: filters });
  },

  get(id: string) {
    return apiClient.get<{ data: Task }>(`/tasks/${id}`);
  },

  getSubtasks(id: string) {
    return apiClient.get<{ data: Task[] }>(`/tasks/${id}/subtasks`);
  },

  stats() {
    return apiClient.get<{ data: TaskStats }>('/tasks/stats');
  },

  overdue() {
    return apiClient.get<{ data: Task[] }>('/tasks/overdue');
  },

  create(dto: CreateTaskDto) {
    return apiClient.post<{ data: Task }>('/tasks', dto);
  },

  update(id: string, dto: UpdateTaskDto) {
    return apiClient.patch<{ data: Task }>(`/tasks/${id}`, dto);
  },

  delete(id: string) {
    return apiClient.delete<{ data: { message: string } }>(`/tasks/${id}`);
  },

  getComments(taskId: string) {
    return apiClient.get<{ data: TaskComment[] }>(`/tasks/${taskId}/comments`);
  },

  addComment(taskId: string, content: string, isInternal: boolean = false) {
    return apiClient.post<{ data: TaskComment }>(`/tasks/${taskId}/comments`, { body: content, isInternal });
  },

  deleteComment(taskId: string, commentId: string) {
    return apiClient.delete<{ data: { message: string } }>(`/tasks/${taskId}/comments/${commentId}`);
  },
};
