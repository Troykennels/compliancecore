export interface SummarizeContractDto {
  evidenceId: string;
  focusAreas?: string[];
}

export interface SummarizeContractResult {
  summary: string;
  keyTerms: string[];
  obligations: string[];
  risks: string[];
  expiryDates: string[];
  wordCount: number;
}

export interface GeneratePolicyDto {
  policyType: string;
  framework?: string;
  organizationName?: string;
  scope?: string;
  additionalContext?: string;
}

export interface GeneratePolicyResult {
  title: string;
  policy: string;
  sections: string[];
}

export interface AnalyzeRiskDto {
  riskTitle: string;
  riskDescription: string;
  context?: string;
  industry?: string;
}

export interface AnalyzeRiskResult {
  likelihood: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  impact: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  riskScore: number;
  summary: string;
  mitigationStrategies: string[];
  regulatoryConsiderations: string[];
  residualRisk: string;
}

export interface GenerateChecklistDto {
  framework: string;
  scope?: string;
  organizationSize?: 'small' | 'medium' | 'large' | 'enterprise';
  additionalContext?: string;
}

export interface ChecklistItem {
  id: string;
  category: string;
  requirement: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  notes?: string;
}

export interface GenerateChecklistResult {
  framework: string;
  title: string;
  totalItems: number;
  items: ChecklistItem[];
}

export interface DocumentQaDto {
  evidenceId: string;
  question: string;
}

export interface DocumentQaResult {
  answer: string;
  confidence: 'high' | 'medium' | 'low' | 'not_found';
  citations: string[];
}

export interface AiSearchDto {
  query: string;
  limit?: number;
}

export interface AiSearchResult {
  answer: string;
  relevantDocuments: Array<{
    evidenceId: string;
    title: string;
    relevanceScore: number;
    snippet: string;
  }>;
  suggestedQueries: string[];
}
