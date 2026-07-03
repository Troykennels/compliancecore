import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tasksApi } from '../api/tasks.api';
import type { CreateTaskDto, UpdateTaskDto, TaskFilters } from '../types/tasks.types';

export const taskKeys = {
  all:      ['tasks'] as const,
  list:     (f: TaskFilters) => [...taskKeys.all, 'list', f] as const,
  detail:   (id: string) => [...taskKeys.all, id] as const,
  subtasks: (id: string) => [...taskKeys.all, id, 'subtasks'] as const,
  comments: (id: string) => [...taskKeys.all, id, 'comments'] as const,
  stats:    () => [...taskKeys.all, 'stats'] as const,
  overdue:  () => [...taskKeys.all, 'overdue'] as const,
};

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn:  () => tasksApi.list(filters).then((r) => r.data.data!),
    placeholderData: (prev) => prev,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn:  () => tasksApi.get(id).then((r) => r.data.data!),
    enabled:  Boolean(id),
  });
}

export function useSubtasks(id: string) {
  return useQuery({
    queryKey: taskKeys.subtasks(id),
    queryFn:  () => tasksApi.getSubtasks(id).then((r) => r.data.data ?? []),
    enabled:  Boolean(id),
  });
}

export function useTaskStats() {
  return useQuery({
    queryKey: taskKeys.stats(),
    queryFn:  () => tasksApi.stats().then((r) => r.data.data!),
  });
}

export function useOverdueTasks() {
  return useQuery({
    queryKey: taskKeys.overdue(),
    queryFn:  () => tasksApi.overdue().then((r) => r.data.data ?? []),
    refetchInterval: 5 * 60_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTaskDto) => tasksApi.create(dto).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      toast.success('Task created.');
    },
    onError: () => toast.error('Failed to create task.'),
  });
}

export function useUpdateTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateTaskDto) => tasksApi.update(taskId, dto).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      toast.success('Task updated.');
    },
    onError: () => toast.error('Failed to update task.'),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      toast.success('Task deleted.');
    },
    onError: () => toast.error('Failed to delete task.'),
  });
}

export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: taskKeys.comments(taskId),
    queryFn:  () => tasksApi.getComments(taskId).then((r) => r.data.data ?? []),
    enabled:  Boolean(taskId),
    refetchInterval: 60_000,
  });
}

export function useAddComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, isInternal }: { content: string; isInternal?: boolean }) =>
      tasksApi.addComment(taskId, content, isInternal).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.comments(taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
    onError: () => toast.error('Failed to add comment.'),
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => tasksApi.deleteComment(taskId, commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.comments(taskId) });
    },
    onError: () => toast.error('Failed to delete comment.'),
  });
}
