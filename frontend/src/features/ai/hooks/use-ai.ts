import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
function aiError(error: unknown) {
  toast.error(
    isAxiosError(error)
      ? (error.response?.data?.error?.message ??
          (error.code === 'ECONNABORTED'
            ? 'The AI request timed out. Try a shorter request.'
            : 'The AI service could not be reached. Check your connection and try again.'))
      : 'The AI request failed. Please try again.',
  );
}
import { aiApi } from '../api/ai.api';
import type {
  SummarizeContractDto,
  GeneratePolicyDto,
  AnalyzeRiskDto,
  GenerateChecklistDto,
  DocumentQaDto,
  AiSearchDto,
} from '../types/ai.types';

export function useSummarizeContract() {
  return useMutation({
    mutationFn: (dto: SummarizeContractDto) =>
      aiApi.summarizeContract(dto).then((r) => r.data.data),
    onError: aiError,
  });
}

export function useGeneratePolicy() {
  return useMutation({
    mutationFn: (dto: GeneratePolicyDto) => aiApi.generatePolicy(dto).then((r) => r.data.data),
    onError: aiError,
  });
}

export function useAnalyzeRisk() {
  return useMutation({
    mutationFn: (dto: AnalyzeRiskDto) => aiApi.analyzeRisk(dto).then((r) => r.data.data),
    onError: aiError,
  });
}

export function useGenerateChecklist() {
  return useMutation({
    mutationFn: (dto: GenerateChecklistDto) =>
      aiApi.generateChecklist(dto).then((r) => r.data.data),
    onError: aiError,
  });
}

export function useDocumentQa() {
  return useMutation({
    mutationFn: (dto: DocumentQaDto) => aiApi.documentQa(dto).then((r) => r.data.data),
    onError: aiError,
  });
}

export function useAiSearch() {
  return useMutation({
    mutationFn: (dto: AiSearchDto) => aiApi.search(dto).then((r) => r.data.data),
    onError: aiError,
  });
}
