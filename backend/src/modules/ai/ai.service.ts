import Groq from 'groq-sdk';
import { withTenantSchema } from '../../lib/prisma';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors';
import type {
  SummarizeContractDto, SummarizeContractResult,
  GeneratePolicyDto, GeneratePolicyResult,
  AnalyzeRiskDto, AnalyzeRiskResult,
  GenerateChecklistDto, GenerateChecklistResult,
  DocumentQaDto, DocumentQaResult,
  AiSearchDto, AiSearchResult,
} from './ai.types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'llama-3.3-70b-versatile';
const MAX_TOKENS = 4096;

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getEvidenceOcrText(
  schemaName: string,
  evidenceId: string,
): Promise<{ title: string; ocrText: string }> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT title, ocr_text, ocr_status
      FROM evidence
      WHERE id = $1 AND deleted_at IS NULL
    `, evidenceId);
    if (!rows.length) throw new NotFoundError('Evidence not found');
    const row = rows[0];
    if (!row.ocr_text || row.ocr_text.trim().length < 50) {
      throw new ValidationError(
        row.ocr_status === 'completed'
          ? 'This document contains no extractable text. Please upload a text-based document.'
          : `Document text is not yet available (OCR status: ${row.ocr_status}). Please wait for OCR to complete.`,
      );
    }
    return { title: row.title, ocrText: row.ocr_text as string };
  });
}

async function chat(systemPrompt: string, userMessage: string): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });
    const text = completion.choices[0]?.message?.content;
    if (!text) throw new AppError('Empty AI response', 500, 'AI_ERROR');
    return text;
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    if (err?.status === 401 || err?.status === 403) throw new AppError('AI service authentication failed — check GROQ_API_KEY', 503, 'AI_AUTH_ERROR');
    if (err?.status === 429) throw new AppError('AI rate limit reached. Please try again in a moment.', 429, 'AI_RATE_LIMIT');
    throw new AppError('AI service temporarily unavailable', 503, 'AI_UNAVAILABLE');
  }
}

function parseJson<T>(raw: string, fallback: T): T {
  // Strip markdown code fences if present
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = match ? match[1].trim() : raw.trim();
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}

// ── Features ───────────────────────────────────────────────────────────────────

export async function summarizeContract(
  schemaName: string,
  dto: SummarizeContractDto,
): Promise<SummarizeContractResult> {
  const { title, ocrText } = await getEvidenceOcrText(schemaName, dto.evidenceId);
  const truncated = ocrText.slice(0, 60_000);

  const focusSection = dto.focusAreas?.length
    ? `\nPay special attention to: ${dto.focusAreas.join(', ')}.`
    : '';

  const system = `You are a senior legal and compliance analyst specialising in contract review for enterprise GRC teams.
Return ONLY a valid JSON object — no prose, no markdown outside the JSON code block.`;

  const user = `Analyse this contract titled "${title}" and return this JSON:
{
  "summary": "2-3 paragraph executive summary",
  "keyTerms": ["array of key contractual terms"],
  "obligations": ["array of party obligations"],
  "risks": ["array of identified risks or gaps"],
  "expiryDates": ["array of dates, deadlines, renewal windows"],
  "wordCount": <integer>
}${focusSection}

Document:
---
${truncated}
---`;

  const raw = await chat(system, user);
  const parsed = parseJson<SummarizeContractResult>(raw, {
    summary: raw,
    keyTerms: [],
    obligations: [],
    risks: [],
    expiryDates: [],
    wordCount: ocrText.split(/\s+/).length,
  });
  return { ...parsed, wordCount: ocrText.split(/\s+/).length };
}

export async function generatePolicy(
  _schemaName: string,
  dto: GeneratePolicyDto,
): Promise<GeneratePolicyResult> {
  const system = `You are a senior compliance officer and policy writer with expertise across ISO 27001, SOC 2, GDPR, HIPAA, PCI DSS, and NIST.
Return ONLY a valid JSON object.`;

  const context = [
    dto.organizationName && `Organisation: ${dto.organizationName}`,
    dto.framework && `Framework: ${dto.framework}`,
    dto.scope && `Scope: ${dto.scope}`,
    dto.additionalContext && `Context: ${dto.additionalContext}`,
  ].filter(Boolean).join('\n');

  const user = `Generate a comprehensive ${dto.policyType} policy.
${context}

Return this JSON:
{
  "title": "Policy title",
  "sections": ["array of section headings"],
  "policy": "Full policy in markdown with sections, sub-sections, numbered lists"
}

Include: Purpose & Scope, Roles & Responsibilities, Policy Statements, Procedures, Exceptions, Enforcement, Review Schedule.`;

  const raw = await chat(system, user);
  return parseJson<GeneratePolicyResult>(raw, {
    title: `${dto.policyType} Policy`,
    sections: [],
    policy: raw,
  });
}

export async function analyzeRisk(
  _schemaName: string,
  dto: AnalyzeRiskDto,
): Promise<AnalyzeRiskResult> {
  const system = `You are a certified risk management expert (CRISC, CISM) applying ISO 31000 and NIST RMF.
Use a 5x5 risk matrix. Return ONLY a valid JSON object.`;

  const context = [
    dto.industry && `Industry: ${dto.industry}`,
    dto.context && `Context: ${dto.context}`,
  ].filter(Boolean).join('\n');

  const user = `Risk assessment for:
Title: ${dto.riskTitle}
Description: ${dto.riskDescription}
${context}

Return this JSON:
{
  "likelihood": "very_low|low|medium|high|very_high",
  "impact": "very_low|low|medium|high|very_high",
  "riskScore": <1-25>,
  "summary": "2-3 paragraph assessment",
  "mitigationStrategies": ["3-6 actionable controls"],
  "regulatoryConsiderations": ["relevant regulations/standards"],
  "residualRisk": "residual risk description after controls"
}`;

  const raw = await chat(system, user);
  return parseJson<AnalyzeRiskResult>(raw, {
    likelihood: 'medium',
    impact: 'medium',
    riskScore: 9,
    summary: raw,
    mitigationStrategies: [],
    regulatoryConsiderations: [],
    residualRisk: '',
  });
}

export async function generateChecklist(
  _schemaName: string,
  dto: GenerateChecklistDto,
): Promise<GenerateChecklistResult> {
  const system = `You are a lead compliance auditor with expertise in ${dto.framework}.
Return ONLY a valid JSON object with at least 25 checklist items.`;

  const context = [
    dto.scope && `Scope: ${dto.scope}`,
    dto.organizationSize && `Org size: ${dto.organizationSize}`,
    dto.additionalContext && `Context: ${dto.additionalContext}`,
  ].filter(Boolean).join('\n');

  const user = `Generate a ${dto.framework} compliance checklist.
${context}

Return this JSON:
{
  "framework": "${dto.framework}",
  "title": "Checklist title",
  "totalItems": <count>,
  "items": [
    {
      "id": "CHK-001",
      "category": "category name",
      "requirement": "specific requirement",
      "priority": "critical|high|medium|low",
      "notes": "implementation notes or evidence examples"
    }
  ]
}

Cover all major control domains. Include 25-35 items.`;

  const raw = await chat(system, user);
  const result = parseJson<GenerateChecklistResult>(raw, {
    framework: dto.framework,
    title: `${dto.framework} Compliance Checklist`,
    totalItems: 0,
    items: [],
  });
  result.totalItems = result.items.length;
  return result;
}

export async function documentQa(
  schemaName: string,
  dto: DocumentQaDto,
): Promise<DocumentQaResult> {
  const { title, ocrText } = await getEvidenceOcrText(schemaName, dto.evidenceId);
  const truncated = ocrText.slice(0, 60_000);

  const system = `You are a compliance analyst who answers questions based strictly on provided document content.
If the answer is not in the document, say so. Return ONLY a valid JSON object.`;

  const user = `Document: "${title}"
Question: ${dto.question}

Return this JSON:
{
  "answer": "Detailed answer based on the document",
  "confidence": "high|medium|low|not_found",
  "citations": ["exact quotes from the document"]
}

Document:
---
${truncated}
---`;

  const raw = await chat(system, user);
  return parseJson<DocumentQaResult>(raw, {
    answer: raw,
    confidence: 'low',
    citations: [],
  });
}

export async function aiSearch(
  schemaName: string,
  dto: AiSearchDto,
): Promise<AiSearchResult> {
  const limit = dto.limit ?? 5;

  const documents = await withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, title, ocr_text
      FROM evidence
      WHERE deleted_at IS NULL
        AND ocr_status = 'completed'
        AND ocr_text IS NOT NULL
        AND LENGTH(ocr_text) > 100
        AND (title ILIKE $1 OR ocr_text ILIKE $1)
      LIMIT $2
    `, `%${dto.query.split(' ').join('%')}%`, limit * 3);
    return rows;
  });

  const docContext = documents.length > 0
    ? documents.map((d: any, i: number) =>
        `[Doc ${i + 1}] ID: ${d.id}\nTitle: ${d.title}\nExcerpt: ${(d.ocr_text as string).slice(0, 1500)}`,
      ).join('\n\n---\n\n')
    : 'No documents found matching the query.';

  const system = `You are an AI compliance search assistant for a GRC platform.
Answer queries using only the documents provided. Return ONLY a valid JSON object.`;

  const user = `Query: "${dto.query}"

Available documents:
---
${docContext}
---

Return this JSON:
{
  "answer": "Direct answer synthesised from available documents",
  "relevantDocuments": [
    {
      "evidenceId": "document ID",
      "title": "document title",
      "relevanceScore": <0.0-1.0>,
      "snippet": "most relevant 1-2 sentences"
    }
  ],
  "suggestedQueries": ["3 related follow-up queries"]
}`;

  const raw = await chat(system, user);
  return parseJson<AiSearchResult>(raw, {
    answer: raw,
    relevantDocuments: [],
    suggestedQueries: [],
  });
}
