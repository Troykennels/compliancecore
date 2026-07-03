import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './ai.service';

const summarizeSchema = z.object({
  evidenceId:  z.string().uuid(),
  focusAreas:  z.array(z.string().max(100)).max(5).optional(),
});

const policySchema = z.object({
  policyType:          z.string().min(1).max(200),
  framework:           z.string().max(100).optional(),
  organizationName:    z.string().max(200).optional(),
  scope:               z.string().max(500).optional(),
  additionalContext:   z.string().max(2000).optional(),
});

const riskSchema = z.object({
  riskTitle:       z.string().min(1).max(300),
  riskDescription: z.string().min(10).max(5000),
  context:         z.string().max(2000).optional(),
  industry:        z.string().max(100).optional(),
});

const checklistSchema = z.object({
  framework:          z.string().min(1).max(100),
  scope:              z.string().max(500).optional(),
  organizationSize:   z.enum(['small', 'medium', 'large', 'enterprise']).optional(),
  additionalContext:  z.string().max(2000).optional(),
});

const docQaSchema = z.object({
  evidenceId: z.string().uuid(),
  question:   z.string().min(5).max(1000),
});

const searchSchema = z.object({
  query: z.string().min(2).max(500),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msgs = result.error.issues.map((i) => i.message).join(', ');
    throw Object.assign(new Error(msgs), { statusCode: 422 });
  }
  return result.data;
}

export async function summarizeContract(req: Request, res: Response) {
  const dto = validate(summarizeSchema, req.body);
  const result = await service.summarizeContract(req.tenant!.schemaName, dto);
  res.json({ success: true, data: result });
}

export async function generatePolicy(req: Request, res: Response) {
  const dto = validate(policySchema, req.body);
  const result = await service.generatePolicy(req.tenant!.schemaName, dto);
  res.json({ success: true, data: result });
}

export async function analyzeRisk(req: Request, res: Response) {
  const dto = validate(riskSchema, req.body);
  const result = await service.analyzeRisk(req.tenant!.schemaName, dto);
  res.json({ success: true, data: result });
}

export async function generateChecklist(req: Request, res: Response) {
  const dto = validate(checklistSchema, req.body);
  const result = await service.generateChecklist(req.tenant!.schemaName, dto);
  res.json({ success: true, data: result });
}

export async function documentQa(req: Request, res: Response) {
  const dto = validate(docQaSchema, req.body);
  const result = await service.documentQa(req.tenant!.schemaName, dto);
  res.json({ success: true, data: result });
}

export async function aiSearch(req: Request, res: Response) {
  const dto = validate(searchSchema, req.body);
  const result = await service.aiSearch(req.tenant!.schemaName, dto);
  res.json({ success: true, data: result });
}
