import { Request, Response, NextFunction } from 'express';
import { organizationService } from './organization.service';
import { streamOrganizationExport } from './export.service';
import { ok } from '../../lib/response';
import { ValidationError } from '../../lib/errors';
import { requestErasure, cancelErasure } from '../../lib/tenant-erasure';
import { revokeUserTokens } from '../../lib/token-revocation';

export const organizationController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const organization = await organizationService.createOrganization(req.user!.id, req.body);
      ok(res, req, { organization }, 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Starts the erasure of the caller's organisation.
   *
   * Access stops immediately; the data itself goes after the grace window, so
   * a mistake is recoverable via /restore and a genuine request still completes
   * without anyone having to run SQL by hand.
   */
  async requestErasure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.user!.tenantId!;
      const profile = await organizationService.getProfile(tenantId);

      // Compared case-insensitively on trimmed input: this is a confirmation
      // that the person knows what they are deleting, not a password.
      const typed = String(req.body.confirmName ?? '').trim().toLowerCase();
      if (!profile || typed !== String(profile.name ?? '').trim().toLowerCase()) {
        throw new ValidationError(
          'The name you typed does not match this organisation. Deletion has not been started.',
        );
      }

      const { purgeAfter } = await requestErasure(tenantId);

      // Everyone loses access now, not whenever their token happens to expire.
      const members = await organizationService.listMemberUserIds(tenantId);
      await Promise.all(members.map((id) => revokeUserTokens(id, 'organisation deleted')));

      ok(res, req, {
        message:
          'Your organisation has been scheduled for deletion and is no longer accessible. '
          + 'You can restore it until the date below, after which the data is permanently erased.',
        purgeAfter,
      });
    } catch (err) {
      next(err);
    }
  },

  async cancelErasure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const restored = await cancelErasure(req.user!.tenantId!);
      if (!restored) {
        throw new ValidationError(
          'This organisation is not scheduled for deletion, or the window to restore it has passed.',
        );
      }
      ok(res, req, { message: 'Organisation restored. Members can sign in again.' });
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
