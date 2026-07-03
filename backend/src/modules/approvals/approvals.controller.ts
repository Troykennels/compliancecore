import type { Request, Response } from 'express';
import * as service from './approvals.service';
import {
  createWorkflowSchema, updateWorkflowSchema,
  createApprovalRequestSchema, decideApprovalSchema,
  listApprovalRequestsSchema,
} from './approvals.schema';
import { validate } from '../../lib/validate';

export async function listWorkflows(req: Request, res: Response) {
  const workflows = await service.listWorkflows(req.tenant!.schemaName);
  res.json({ success: true, data: workflows });
}

export async function getWorkflow(req: Request, res: Response) {
  const workflow = await service.getWorkflow(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: workflow });
}

export async function createWorkflow(req: Request, res: Response) {
  const dto = validate(createWorkflowSchema, req.body);
  const workflow = await service.createWorkflow(req.tenant!.schemaName, dto, req.user!.id);
  res.status(201).json({ success: true, data: workflow });
}

export async function updateWorkflow(req: Request, res: Response) {
  const dto = validate(updateWorkflowSchema, req.body);
  const workflow = await service.updateWorkflow(req.tenant!.schemaName, req.params.id, dto);
  res.json({ success: true, data: workflow });
}

export async function deleteWorkflow(req: Request, res: Response) {
  await service.deleteWorkflow(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: null });
}

export async function listRequests(req: Request, res: Response) {
  const filters = validate(listApprovalRequestsSchema, req.query);
  const result = await service.listRequests(req.tenant!.schemaName, filters, req.user!.id);
  res.json({ success: true, data: result });
}

export async function getRequest(req: Request, res: Response) {
  const request = await service.getRequest(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: request });
}

export async function createRequest(req: Request, res: Response) {
  const dto = validate(createApprovalRequestSchema, req.body);
  const request = await service.createRequest(
    req.tenant!.schemaName, dto, req.user!.id, req.user!.email,
  );
  res.status(201).json({ success: true, data: request });
}

export async function decideRequest(req: Request, res: Response) {
  const dto = validate(decideApprovalSchema, req.body);
  await service.decideRequest(
    req.tenant!.schemaName,
    req.params.id,
    req.user!.id,
    req.user!.email,
    req.user!.email,
    dto,
    req.ip ?? '',
    req.headers['user-agent'] ?? '',
  );
  const updated = await service.getRequest(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: updated });
}

export async function cancelRequest(req: Request, res: Response) {
  await service.cancelRequest(
    req.tenant!.schemaName, req.params.id, req.user!.id, req.body.reason,
  );
  res.json({ success: true, data: null });
}

export async function getMyPending(req: Request, res: Response) {
  const requests = await service.getMyPending(
    req.tenant!.schemaName, req.user!.id, req.user!.role ?? '',
  );
  res.json({ success: true, data: requests });
}
