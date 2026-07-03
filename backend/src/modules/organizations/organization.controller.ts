import { Request, Response, NextFunction } from 'express';
import { organizationService } from './organization.service';
import { ok } from '../../lib/response';

export const organizationController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organization = await organizationService.createOrganization(req.user!.id, req.body);
      ok(res, req, { organization }, 201);
    } catch (err) {
      next(err);
    }
  },

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await organizationService.getProfile(req.user!.tenantId!);
      ok(res, req, { organization: profile });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organization = await organizationService.updateProfile(
        req.user!.tenantId!,
        req.body,
        { id: req.user!.id, email: req.user!.email, role: req.user!.role ?? '' },
      );
      ok(res, req, { organization });
    } catch (err) {
      next(err);
    }
  },

  async completeOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await organizationService.completeOnboarding(req.user!.tenantId!);
      ok(res, req, result);
    } catch (err) {
      next(err);
    }
  },
};
