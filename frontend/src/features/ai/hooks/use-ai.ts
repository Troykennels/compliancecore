import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { aiApi } from '../api/ai.api';
import type {
  SummarizeContractDto, GeneratePolicyDto, AnalyzeRiskDto,
  GenerateChecklistDto, DocumentQaDto, AiSearchDto,
} from '../types/ai.types';

export function useSummarizeContract() {
  return useMutation({
    mutationFn: (dto: SummarizeContractDto) =>
      aiApi.summarizeContract(dto).then((r) => r.data.data),
    onError: () => toast.error('Contract analysis failed.'),
  });
}

export function useGeneratePolicy() {
  return useMutation({
    mutationFn: (dto: GeneratePolicyDto) =>
      aiApi.generatePolicy(dto).then((r) => r.data.data),
    onError: () => toast.error('Policy generation failed.'),
  });
}

export function useAnalyzeRisk() {
  return useMutation({
    mutationFn: (dto: AnalyzeRiskDto) =>
      aiApi.analyzeRisk(dto).then((r) => r.data.data),
    onError: () => toast.error('Risk analysis failed.'),
  });
}

export function useGenerateChecklist() {
  return useMutation({
    mutationFn: (dto: GenerateChecklistDto) =>
      aiApi.generateChecklist(dto).then((r) => r.data.data),
    onError: () => toast.error('Checklist generation failed.'),
  });
}

export function useDocumentQa() {
  return useMutation({
    mutationFn: (dto: DocumentQaDto) =>
      aiApi.documentQa(dto).then((r) => r.data.data),
    onError: () => toast.error('Document Q&A failed.'),
  });
}

export function useAiSearch() {
  return useMutation({
    mutationFn: (dto: AiSearchDto) =>
      aiApi.search(dto).then((r) => r.data.data),
    onError: () => toast.error('AI search failed.'),
  });
}
