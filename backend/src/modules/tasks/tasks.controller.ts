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
  const task = await service.createTask(
    req.tenant!.schemaName, dto, req.user!.id, req.user!.email, userName(req),
  );
  res.status(201).json({ success: true, data: task });
}

export async function updateTask(req: Request, res: Response) {
  const dto = validate(updateTaskSchema, req.body);
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
  await service.deleteComment(req.tenant!.schemaName, req.params.commentId, req.user!.id);
  res.json({ success: true, data: null });
}
