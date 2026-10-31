import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { frameworksApi } from '../api/frameworks.api';

export const frameworkKeys = {
  all: ['frameworks'] as const,
  list: () => [...frameworkKeys.all, 'list'] as const,
  detail: (id: string) => [...frameworkKeys.all, id] as const,
};

function errorMessage(fallback: string) {
  return (err: { response?: { data?: { error?: { message: string } } } }) =>
    toast.error(err.response?.data?.error?.message ?? fallback);
}

export function useFrameworks() {
  return useQuery({
    queryKey: frameworkKeys.list(),
    queryFn: () => frameworksApi.list().then((r) => r.data.data ?? []),
  });
}

export function useFramework(id: string) {
  return useQuery({
    queryKey: frameworkKeys.detail(id),
    queryFn: () => frameworksApi.get(id).then((r) => r.data.data),
    enabled: Boolean(id),
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

/**
 * Removing an adopted framework.
 *
 * QA found adoption was a one-way door — a framework chosen by mistake could
 * only be undone by contacting support. This is the way back.
 *
 * The 409 the server raises when controls carry real work is NOT surfaced as an
 * error. It is the answer to a question the dialog is in the middle of asking:
 * it carries the itemised impact, and the caller turns it into a warning and
 * offers to proceed. Toasting it as a failure would be actively misleading —
 * nothing failed, and the user's next move is to confirm.
 */
export function useUnadoptFramework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      frameworksApi.unadopt(id, force).then((r) => r.data.data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: frameworkKeys.all });
      // Removal withdraws controls from scope, so every view derived from them —
      // the controls list, the compliance score, the dashboard — is now stale.
      qc.invalidateQueries({ queryKey: ['controls'] });
      qc.invalidateQueries({ queryKey: ['compliance-score'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        `Removed ${result?.frameworkName ?? 'framework'} — ${result?.removed ?? 0} controls withdrawn from scope`,
      );
    },
    // Deliberately no onError toast: the caller inspects the 409 and asks the
    // user to confirm. See the component.
  });
}

/** The cost of removing a framework, fetched only while a dialog is open. */
export function useUnadoptImpact(id: string | null) {
  return useQuery({
    queryKey: [...frameworkKeys.all, id, 'unadopt-impact'],
    queryFn: () => frameworksApi.unadoptImpact(id!).then((r) => r.data.data),
    enabled: Boolean(id),
    staleTime: 0,
  });
}
