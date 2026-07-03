import { Request, Response, NextFunction } from 'express';
import { departmentsService } from './departments.service';
import { ok, created, noContent } from '../../lib/response';

export const departmentsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await departmentsService.list(req.tenant!.schemaName, req.query as never);
      ok(res, req, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const department = await departmentsService.getById(
        req.tenant!.schemaName,
        req.params.id,
      );
      ok(res, req, { department });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const department = await departmentsService.create(
        req.tenant!.schemaName,
        req.body,
        req.user!,
      );
      created(res, req, { department });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const department = await departmentsService.update(
        req.tenant!.schemaName,
        req.params.id,
        req.body,
        req.user!,
      );
      ok(res, req, { department });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await departmentsService.delete(req.tenant!.schemaName, req.params.id, req.user!);
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
};
