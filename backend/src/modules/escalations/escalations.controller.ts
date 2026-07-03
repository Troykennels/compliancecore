import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './escalations.service';
import { validate } from '../../lib/validate';

const chainStepSchema = z.object({
  delayHours:  z.number().int().min(0),
  action:      z.enum(['notify','notify_manager','notify_role','reassign','create_task','cancel_request']),
  targetType:  z.enum(['assignee','requester','user','role','manager']),
  targetId:    z.string().uuid().optional(),
  targetRole:  z.string().max(100).optional(),
  message:     z.string().min(1).max(1000),
});

const createRuleSchema = z.object({
  name:            z.string().min(1).max(500),
  description:     z.string().max(5000).optional(),
  triggerType:     z.enum(['task_overdue','approval_pending','control_overdue','expiry_approaching','risk_unmitigated','signature_missing']),
  entityType:      z.string().max(100).optional(),
  conditions:      z.object({
    daysOverdue:     z.number().int().min(0).optional(),
    daysPending:     z.number().int().min(0).optional(),
    daysUntilExpiry: z.number().int().min(0).optional(),
    priority:        z.array(z.string()).optional(),
    status:          z.array(z.string()).optional(),
  }).default({}),
  escalationChain: z.array(chainStepSchema).min(1),
});

export async function listRules(req: Request, res: Response) {
  const rules = await service.listRules(req.tenant!.schemaName);
  res.json({ success: true, data: { items: rules, total: rules.length } });
}

export async function getRule(req: Request, res: Response) {
  const rule = await service.getRule(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: rule });
}

export async function createRule(req: Request, res: Response) {
  const dto = validate(createRuleSchema, req.body);
  const rule = await service.createRule(req.tenant!.schemaName, dto as any, req.user!.id);
  res.status(201).json({ success: true, data: rule });
}

export async function updateRule(req: Request, res: Response) {
  const dto = validate(createRuleSchema.partial(), req.body);
  const rule = await service.updateRule(req.tenant!.schemaName, req.params.id, dto as any);
  res.json({ success: true, data: rule });
}

export async function toggleRule(req: Request, res: Response) {
  const rule = await service.toggleRule(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: rule });
}

export async function deleteRule(req: Request, res: Response) {
  await service.deleteRule(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: null });
}

export async function listEvents(req: Request, res: Response) {
  const { status } = req.query as { status?: string };
  const events = await service.listEvents(req.tenant!.schemaName, status);
  res.json({ success: true, data: { items: events, total: events.length } });
}

export async function resolveEvent(req: Request, res: Response) {
  await service.resolveEvent(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: null });
}
