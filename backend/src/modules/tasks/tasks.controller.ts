import { getPermissionsForRole, hasPermission } from '../../middleware/rbac.middleware';
import { ForbiddenError } from '../../lib/errors';
import type { Request, Response } from 'express';
import * as service from './tasks.service';
import { createTaskSchema, updateTaskSchema, addCommentSchema, listTasksSchema } from './tasks.schema';
import { validate } from '../../lib/validate';

function userName(req: Request) {
  return req.user!.email;
}

export async function listTasks(req: Request, res: Response) {
  const filters = validate(listTasksSchema, req.query);
  const result = await service.listTasks(req.tenant!.schemaName, filters, req.user!.id);
  res.json({ success: true, data: result });
}

export async function getTask(req: Request, res: Response) {
  const task = await service.getTask(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: task });
}

export async function createTask(req: Request, res: Response) {
  const dto = validate(createTaskSchema, req.body);
  if(dto.assignedTo&&dto.assignedTo!==req.user!.id&&!hasPermission(getPermissionsForRole(req.user!.role!), 'tasks:assign'))throw new ForbiddenError('Your role can prepare your own tasks. Ask a coordinator to assign another person.');
  if(!hasPermission(getPermissionsForRole(req.user!.role!), 'tasks:assign'))dto.assignedTo=req.user!.id;
  const task = await service.createTask(
    req.tenant!.schemaName, dto, req.user!.id, req.user!.email, userName(req),
  );
  res.status(201).json({ success: true, data: task });
}

export async function updateTask(req: Request, res: Response) {
  const dto = validate(updateTaskSchema, req.body);
  const existing=await service.getTask(req.tenant!.schemaName,req.params.id);
  if(!hasPermission(getPermissionsForRole(req.user!.role!), 'tasks:assign')&&(existing.assignedTo!==req.user!.id||(dto.assignedTo!==undefined&&dto.assignedTo!==req.user!.id)))throw new ForbiddenError('You can update your assigned tasks. Ask a coordinator to change responsibility.');
  const task = await service.updateTask(
    req.tenant!.schemaName, req.params.id, dto, req.user!.id, userName(req),
  );
  res.json({ success: true, data: task });
}

export async function getSubtasks(req: Request, res: Response) {
  const subtasks = await service.getSubtasks(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: subtasks });
}

export async function deleteTask(req: Request, res: Response) {
  const existing=await service.getTask(req.tenant!.schemaName,req.params.id);
  if(!hasPermission(getPermissionsForRole(req.user!.role!), 'tasks:assign')&&existing.assignedTo!==req.user!.id)throw new ForbiddenError('You can remove only your assigned tasks.');
  await service.deleteTask(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: null });
}

export async function getOverdueTasks(req: Request, res: Response) {
  const tasks = await service.getOverdueTasks(req.tenant!.schemaName);
  res.json({ success: true, data: tasks });
}

export async function getTaskStats(req: Request, res: Response) {
  const stats = await service.getTaskStats(req.tenant!.schemaName);
  res.json({ success: true, data: stats });
}

export async function getComments(req: Request, res: Response) {
  const comments = await service.getComments(req.tenant!.schemaName, req.params.id);
  res.json({ success: true, data: comments });
}

export async function addComment(req: Request, res: Response) {
  const dto = validate(addCommentSchema, req.body);
  const comment = await service.addComment(
    req.tenant!.schemaName, req.params.id, req.user!.id, userName(req), dto,
  );
  res.status(201).json({ success: true, data: comment });
}

export async function deleteComment(req: Request, res: Response) {
  await service.deleteComment(
    req.tenant!.schemaName, req.params.id, req.params.commentId, req.user!.id, req.user!.role ?? null,
  );
  res.json({ success: true, data: null });
}
