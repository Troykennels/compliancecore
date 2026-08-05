import { Request, Response, NextFunction } from 'express';
import { settingsService } from './settings.service';
import { ok, created, noContent } from '../../lib/response';
import { emailTransportStatus, sendDiagnosticEmail } from '../../lib/email';

export const settingsController = {
  // ── Team ───────────────────────────────────────────────────────────────────

  async listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const members = await settingsService.team.listMembers(req.user!.tenantId!);
      ok(res, req, { members });
    } catch (err) {
      next(err);
    }
  },

  async inviteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await settingsService.team.inviteMember(
        req.user!.tenantId!,
        req.body,
        req.user!,
      );
      ok(res, req, result, 202);
    } catch (err) {
      next(err);
    }
  },

  async acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await settingsService.team.acceptInvitation(req.body, req.user!);
      ok(res, req, result);
    } catch (err) {
      next(err);
    }
  },

  async updateMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await settingsService.team.updateMemberRole(
        req.user!.tenantId!,
        req.params.membershipId,
        req.body,
        req.user!,
      );
      ok(res, req, { message: 'Role updated.' });
    } catch (err) {
      next(err);
    }
  },

  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await settingsService.team.removeMember(
        req.user!.tenantId!,
        req.params.membershipId,
        req.user!,
      );
      noContent(res);
    } catch (err) {
      next(err);
    }
  },

  // ── API Keys ───────────────────────────────────────────────────────────────

  async listApiKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const apiKeys = await settingsService.apiKeys.list(req.user!.tenantId!);
      ok(res, req, { apiKeys });
    } catch (err) {
      next(err);
    }
  },

  async createApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const apiKey = await settingsService.apiKeys.create(
        req.user!.tenantId!,
        req.body,
        req.user!,
      );
      created(res, req, { apiKey });
    } catch (err) {
      next(err);
    }
  },

  async revokeApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await settingsService.apiKeys.revoke(req.user!.tenantId!, req.params.id);
      noContent(res);
    } catch (err) {
      next(err);
    }
  },

  // ── Webhooks ───────────────────────────────────────────────────────────────

  async listWebhooks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const webhooks = await settingsService.webhooks.list(req.user!.tenantId!);
      ok(res, req, { webhooks });
    } catch (err) {
      next(err);
    }
  },

  async createWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const webhook = await settingsService.webhooks.create(
        req.user!.tenantId!,
        req.body,
        req.user!,
      );
      created(res, req, { webhook });
    } catch (err) {
      next(err);
    }
  },

  async updateWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await settingsService.webhooks.update(req.user!.tenantId!, req.params.id, req.body);
      ok(res, req, { message: 'Webhook updated.' });
    } catch (err) {
      next(err);
    }
  },

  async deleteWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await settingsService.webhooks.delete(req.user!.tenantId!, req.params.id);
      noContent(res);
    } catch (err) {
      next(err);
    }
  },

  async rotateWebhookSecret(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await settingsService.webhooks.rotateSecret(
        req.user!.tenantId!,
        req.params.id,
      );
      ok(res, req, result);
    } catch (err) {
      next(err);
    }
  },

  // ── Email diagnostics ──────────────────────────────────────────────────────

  async getEmailStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ok(res, req, emailTransportStatus());
    } catch (err) {
      next(err);
    }
  },

  /**
   * Sends a real email to the caller and reports what happened.
   *
   * Returns 200 with `{ sent: false, error }` rather than throwing, because the
   * error text IS the answer — "sender not verified", "invalid API key",
   * "connection timeout" each point at a different fix, and a bare 500 points
   * at none of them.
   */
  async sendTestEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const to = String(req.body?.to ?? req.user!.email);
      const status = emailTransportStatus();
      try {
        await sendDiagnosticEmail(to);
        ok(res, req, { sent: true, to, ...status, error: null });
      } catch (err) {
        const e = err as { message?: string; code?: string; responseCode?: number; response?: string };
        ok(res, req, {
          sent: false,
          to,
          ...status,
          error: `${e.code ?? ''} ${e.responseCode ?? ''} ${e.response ?? e.message ?? 'unknown error'}`
            .replace(/\s+/g, ' ')
            .trim(),
        });
      }
    } catch (err) {
      next(err);
    }
  },

  // ── Notifications ──────────────────────────────────────────────────────────

  async getNotificationSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await settingsService.notifications.get(req.user!.tenantId!);
      ok(res, req, result);
    } catch (err) {
      next(err);
    }
  },

  async updateNotificationSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await settingsService.notifications.update(req.user!.tenantId!, req.body);
      ok(res, req, result);
    } catch (err) {
      next(err);
    }
  },
};
