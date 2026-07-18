import * as repo from './escalations.repository';
import { AppError } from '../../lib/errors';
import type { CreateEscalationRuleDto } from './escalations.types';

export async function listRules(schemaName: string) {
  return repo.findRules(schemaName);
}

export async function getRule(schemaName: string, id: string) {
  const rule = await repo.findRuleById(schemaName, id);
  if (!rule) throw new AppError('Escalation rule not found', 404);
  return rule;
}

export async function createRule(schemaName: string, dto: CreateEscalationRuleDto, userId: string) {
  const id = await repo.createRule(schemaName, dto, userId);
  return repo.findRuleById(schemaName, id);
}

export async function updateRule(schemaName: string, id: string, dto: Partial<CreateEscalationRuleDto>) {
  const existing = await repo.findRuleById(schemaName, id);
  if (!existing) throw new AppError('Escalation rule not found', 404);
  await repo.updateRule(schemaName, id, dto);
  return repo.findRuleById(schemaName, id);
}

export async function toggleRule(schemaName: string, id: string) {
  const existing = await repo.findRuleById(schemaName, id);
  if (!existing) throw new AppError('Escalation rule not found', 404);
  await repo.toggleRule(schemaName, id, !existing.isActive);
  return repo.findRuleById(schemaName, id);
}

export async function deleteRule(schemaName: string, id: string) {
  const existing = await repo.findRuleById(schemaName, id);
  if (!existing) throw new AppError('Escalation rule not found', 404);
  await repo.softDeleteRule(schemaName, id);
}

export async function listEvents(schemaName: string, status?: string) {
  return repo.findEvents(schemaName, status);
}

export async function resolveEvent(schemaName: string, eventId: string, resolutionNote?: string) {
  const event = await repo.resolveEvent(schemaName, eventId, resolutionNote);
  if (!event) throw new AppError('Escalation event not found', 404);
  return event;
}
