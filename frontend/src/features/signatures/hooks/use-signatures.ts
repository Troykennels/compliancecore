import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { signaturesApi } from '../api/signatures.api';
import type { SignatureFilters, CreateSignatureDto } from '../types/signatures.types';

export const signatureKeys = {
  all:     ['signatures'] as const,
  list:    (f: SignatureFilters) => [...signatureKeys.all, 'list', f] as const,
  detail:  (id: string) => [...signatureKeys.all, id] as const,
  verify:  (id: string) => [...signatureKeys.all, 'verify', id] as const,
};

export function useSignatures(filters: SignatureFilters = {}) {
  return useQuery({
    queryKey: signatureKeys.list(filters),
    queryFn:  () => signaturesApi.list(filters).then((r) => r.data.data!),
    placeholderData: (prev) => prev,
  });
}

export function useSignature(id: string) {
  return useQuery({
    queryKey: signatureKeys.detail(id),
    queryFn:  () => signaturesApi.get(id).then((r) => r.data.data!),
    enabled:  Boolean(id),
  });
}

export function useVerifySignature(id: string) {
  return useQuery({
    queryKey: signatureKeys.verify(id),
    queryFn:  () => signaturesApi.verify(id).then((r) => r.data.data!),
    enabled:  Boolean(id),
    staleTime: 60_000,
  });
}

export function useCreateSignature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSignatureDto) =>
      signaturesApi.create(dto).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: signatureKeys.all });
      toast.success('Digital signature created.');
    },
    onError: () => toast.error('Failed to create signature.'),
  });
}

export function useRevokeSignature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      signaturesApi.revoke(id, reason).then((r) => r.data.data!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: signatureKeys.all });
      toast.success('Signature revoked.');
    },
    onError: () => toast.error('Failed to revoke signature.'),
  });
}
