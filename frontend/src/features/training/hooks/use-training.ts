import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { trainingApi } from '../api/training.api';
import type {
  TrainingFilters,
  CreateTrainingInput,
  UpdateTrainingInput,
  AssignTrainingRecordsInput,
} from '../types/training.types';

export const trainingKeys = {
  all:     ['training'] as const,
  list:    (f: TrainingFilters) => [...trainingKeys.all, 'list', f] as const,
  detail:  (id: string) => [...trainingKeys.all, id] as const,
  records: (id: string) => [...trainingKeys.all, id, 'records'] as const,
};

function errorMessage(fallback: string) {
  return (err: { response?: { data?: { error?: { message: string } } } }) =>
    toast.error(err.response?.data?.error?.message ?? fallback);
}

export function useTrainings(filters: TrainingFilters = {}) {
  return useQuery({
    queryKey: trainingKeys.list(filters),
    queryFn:  () => trainingApi.list(filters).then((r) => r.data.data),
    placeholderData: (prev) => prev,
  });
}

export function useTraining(id: string) {
  return useQuery({
    queryKey: trainingKeys.detail(id),
    queryFn:  () => trainingApi.get(id).then((r) => r.data.data),
    enabled:  Boolean(id),
  });
}

export function useTrainingRecords(id: string) {
  return useQuery({
    queryKey: trainingKeys.records(id),
    queryFn:  () => trainingApi.records(id).then((r) => r.data.data ?? []),
    enabled:  Boolean(id),
  });
}

export function useCreateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTrainingInput) => trainingApi.create(input).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trainingKeys.all });
      toast.success('Training program created successfully.');
    },
    onError: errorMessage('Failed to create training program.'),
  });
}

export function useUpdateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTrainingInput }) =>
      trainingApi.update(id, input).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trainingKeys.all });
      toast.success('Training program updated successfully.');
    },
    onError: errorMessage('Failed to update training program.'),
  });
}

export function useDeleteTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trainingApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trainingKeys.all });
      toast.success('Training program deleted.');
    },
    onError: errorMessage('Failed to delete training program.'),
  });
}

export function useAssignTrainingRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssignTrainingRecordsInput }) =>
      trainingApi.assignRecords(id, input).then((r) => r.data.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: trainingKeys.records(variables.id) });
      qc.invalidateQueries({ queryKey: trainingKeys.detail(variables.id) });
      toast.success('Users assigned successfully.');
    },
    onError: errorMessage('Failed to assign users.'),
  });
}
