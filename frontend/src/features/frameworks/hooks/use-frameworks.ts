import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { frameworksApi } from '../api/frameworks.api';

export const frameworkKeys = {
  all:    ['frameworks'] as const,
  list:   () => [...frameworkKeys.all, 'list'] as const,
  detail: (id: string) => [...frameworkKeys.all, id] as const,
};

function errorMessage(fallback: string) {
  return (err: { response?: { data?: { error?: { message: string } } } }) =>
    toast.error(err.response?.data?.error?.message ?? fallback);
}

export function useFrameworks() {
  return useQuery({
    queryKey: frameworkKeys.list(),
    queryFn:  () => frameworksApi.list().then((r) => r.data.data ?? []),
  });
}

export function useFramework(id: string) {
  return useQuery({
    queryKey: frameworkKeys.detail(id),
    queryFn:  () => frameworksApi.get(id).then((r) => r.data.data),
    enabled:  Boolean(id),
  });
}

export function useAdoptFramework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => frameworksApi.adopt(id).then((r) => r.data.data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: frameworkKeys.all });
      // Adoption creates controls, so refresh the controls views/score too.
      qc.invalidateQueries({ queryKey: ['controls'] });
      toast.success(`Created ${result?.created ?? 0} controls`);
    },
    onError: errorMessage('Failed to adopt framework.'),
  });
}
