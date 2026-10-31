import { apiClient } from '@/lib/api-client';
import type {
  SummarizeContractDto,
  SummarizeContractResult,
  GeneratePolicyDto,
  GeneratePolicyResult,
  AnalyzeRiskDto,
  AnalyzeRiskResult,
  GenerateChecklistDto,
  GenerateChecklistResult,
  DocumentQaDto,
  DocumentQaResult,
  AiSearchDto,
  AiSearchResult,
} from '../types/ai.types';

export const aiApi = {
  summarizeContract(dto: SummarizeContractDto) {
    return apiClient.post<{ data: SummarizeContractResult }>('/ai/summarize-contract', dto, {
      timeout: 75000,
    });
  },

  generatePolicy(dto: GeneratePolicyDto) {
    return apiClient.post<{ data: GeneratePolicyResult }>('/ai/generate-policy', dto, {
      timeout: 75000,
    });
  },

  analyzeRisk(dto: AnalyzeRiskDto) {
    return apiClient.post<{ data: AnalyzeRiskResult }>('/ai/analyze-risk', dto, { timeout: 75000 });
  },

  generateChecklist(dto: GenerateChecklistDto) {
    return apiClient.post<{ data: GenerateChecklistResult }>('/ai/generate-checklist', dto, {
      timeout: 75000,
    });
  },

  documentQa(dto: DocumentQaDto) {
    return apiClient.post<{ data: DocumentQaResult }>('/ai/document-qa', dto, { timeout: 75000 });
  },

  search(dto: AiSearchDto) {
    return apiClient.post<{ data: AiSearchResult }>('/ai/search', dto, { timeout: 75000 });
  },
};
