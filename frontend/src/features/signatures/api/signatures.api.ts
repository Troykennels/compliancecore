import { apiClient } from '@/lib/api-client';
import type {
  DigitalSignature,
  CreateSignatureDto,
  VerifySignatureResult,
  SignatureFilters,
  SignaturesListResponse,
} from '../types/signatures.types';

export const signaturesApi = {
  create(dto: CreateSignatureDto) {
    return apiClient.post<{ data: DigitalSignature }>('/signatures', dto);
  },

  verify(id: string) {
    return apiClient.post<{ data: VerifySignatureResult }>(`/signatures/${id}/verify`);
  },

  get(id: string) {
    return apiClient.get<{ data: DigitalSignature }>(`/signatures/${id}`);
  },

  list(filters: SignatureFilters = {}) {
    return apiClient.get<{ data: SignaturesListResponse }>('/signatures', { params: filters });
  },

  revoke(id: string, reason: string) {
    return apiClient.post<{ data: DigitalSignature }>(`/signatures/${id}/revoke`, { reason });
  },
};
