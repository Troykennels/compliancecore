import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { escalationsApi } from '../api/escalations.api';
import type { CreateEscalationRuleDto, EscalationFilters, EscalationEventFilters } from '../types/escalations.types';

export const escalationKeys = {
  all:    ['escalations'] as const,
  rules:  (f: EscalationFilters) => [...escalationKeys.all, 'rules', f] as const,
  rule:   (id: string) => [...escalationKeys.all, 'rule', id] as const,
  events: (f: EscalationEventFilters) => [...escalationKeys.all, 'events', f] as const,
};

export function useEscalationRules(filters: EscalationFilters = {}) {
  return useQuery({
    queryKey: escalationKeys.rules(filters),
    queryFn:  () => escalationsApi.listRules(filters).then((r) => r.data.data!),
    placeholderData: (prev) => prev,
  });
}

export function useEscalationRule(id: string) {
  return useQuery({
    queryKey: escalationKeys.rule(id),
    queryFn:  () => escalationsApi.getRule(id).then((r) => r.data.data!),
    enabled:  Boolean(id),
  });
}

export function useEscalationEvents(filters: EscalationEventFilters = {}) {
  return useQuery({
    queryKey: escalationKeys.events(filters),
    queryFn:  () => escalationsApi.listEvents(filters).then((r) => r.data.data!),
    placeholderData: (prev) => prev,
    refetchInterval: 5 * 60_000,
  });
}

export function useCreateEscalationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateEscalationRuleDto) =>
      escalationsApi.createRule(dto).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: escalationKeys.all });
      toast.success('Escalation rule created.');
    },
    onError: () => toast.error('Failed to create escalation rule.'),
  });
}

export function useToggleEscalationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; isActive: boolean }) =>
      escalationsApi.toggleRule(id).then((r) => r.data.data!),
    onSuccess: (rule) => {
      qc.invalidateQueries({ queryKey: escalationKeys.all });
      toast.success(`Rule ${rule.isActive ? 'activated' : 'deactivated'}.`);
    },
    onError: () => toast.error('Failed to update rule.'),
  });
}

export function useDeleteEscalationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => escalationsApi.deleteRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: escalationKeys.all });
      toast.success('Escalation rule deleted.');
    },
    onError: () => toast.error('Failed to delete rule.'),
  });
}

export function useResolveEscalationEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionNote }: { id: string; resolutionNote?: string }) =>
      escalationsApi.resolveEvent(id, resolutionNote).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: escalationKeys.all });
      toast.success('Escalation event resolved.');
    },
    onError: () => toast.error('Failed to resolve event.'),
  });
}
