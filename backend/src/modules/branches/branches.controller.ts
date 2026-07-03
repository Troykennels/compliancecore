import { Request, Response, NextFunction } from 'express';
import { branchesService } from './branches.service';
import { ok, created, noContent } from '../../lib/response';

export const branchesController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await branchesService.list(req.tenant!.schemaName, req.query as never);
      ok(res, req, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchesService.getById(req.tenant!.schemaName, req.params.id);
      ok(res, req, { branch });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchesService.create(
        req.tenant!.schemaName,
        req.body,
        req.user!,
      );
      created(res, req, { branch });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchesService.update(
        req.tenant!.schemaName,
        req.params.id,
        req.body,
        req.user!,
      );
      ok(res, req, { branch });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await branchesService.delete(req.tenant!.schemaName, req.params.id, req.user!);
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
};
