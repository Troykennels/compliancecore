import { Request, Response, NextFunction } from 'express';
import { organizationService } from './organization.service';
import { streamOrganizationExport } from './export.service';
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

  // ── Full data export ──────────────────────────────────────────────────────

  async exportAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await streamOrganizationExport(res, {
        tenantId: req.tenant!.id,
        schemaName: req.tenant!.schemaName,
        requestedBy: req.user!.email,
      });
    } catch (err) {
      // Once the ZIP starts streaming the status line is already committed, so
      // the error handler cannot turn it into a clean 500 — only an unstarted
      // export can be reported normally.
      if (res.headersSent) {
        res.destroy();
        return;
      }
      next(err);
    }
  },

  // ── Compliance scoping ────────────────────────────────────────────────────

  async getScoping(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await organizationService.getScoping(req.user!.tenantId!);
      ok(res, req, result);
    } catch (err) {
      next(err);
    }
  },

  async saveScoping(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await organizationService.saveScoping(req.user!.tenantId!, req.body);
      ok(res, req, result);
    } catch (err) {
      next(err);
    }
  },
};
