import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { requestId } from './middleware/request-id.middleware';
import { errorHandler } from './middleware/error.middleware';
import { authRouter } from './modules/auth/auth.router';
import organizationRouter from './modules/organizations/organization.router';
import branchesRouter from './modules/branches/branches.router';
import departmentsRouter from './modules/departments/departments.router';
import settingsRouter from './modules/settings/settings.router';
import evidenceRouter from './modules/evidence/evidence.router';
import controlsRouter from './modules/controls/controls.router';
import policiesRouter from './modules/policies/policies.router';
import risksRouter from './modules/risks/risks.router';
import vendorsRouter from './modules/vendors/vendors.router';
import calendarRouter from './modules/calendar/calendar.router';
import expiryRouter from './modules/expiry/expiry.router';
import notificationsRouter from './modules/notifications/notification.router';
import scoreRouter from './modules/compliance-score/score.router';
import dashboardRouter from './modules/dashboard/dashboard.router';
import { approvalsRouter } from './modules/approvals/approvals.router';
import { signaturesRouter } from './modules/signatures/signatures.router';
import { tasksRouter } from './modules/tasks/tasks.router';
import { escalationsRouter } from './modules/escalations/escalations.router';
import { aiRouter } from './modules/ai/ai.router';
import { reportsRouter } from './modules/reports/reports.router';
import { billingRouter } from './modules/billing/billing.router';
import { healthRouter } from './modules/health/health.router';
import { installOrionGate } from './orionLicense';
import { env } from './config/env';

export function createApp(): Express {
  const app = express();

  // ─── Trust Proxy (Railway / load balancer) ───────────────────────────────
  app.set('trust proxy', 1);

  // ─── Security Headers ────────────────────────────────────────────────────
  app.use(helmet());

  // ─── CORS ────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true, // Required for httpOnly cookie to be sent cross-origin
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
    }),
  );

  // ─── Request Parsing ─────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // ─── Request ID ──────────────────────────────────────────────────────────
  app.use(requestId());

  // ─── Health Check ────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'compliancecore-api', timestamp: new Date().toISOString() });
  });
  // Liveness (/health/live) + readiness (/health/ready, checks DB + Redis)
  app.use('/health', healthRouter);

  // ─── Orion licensing gate ────────────────────────────────────────────────
  // Baked product config; a deployment is licensed by setting ORION_LICENSE_KEY.
  // COMPLETELY OFF unless that variable is set, and fails open on any error, so
  // it can never take a running deployment down.
  try {
    installOrionGate(app);
  } catch {
    /* never let licensing break startup */
  }

  // ─── API Routes ──────────────────────────────────────────────────────────
  app.use('/api/auth',         authRouter);
  app.use('/api/organizations', organizationRouter);
  app.use('/api/branches',     branchesRouter);
  app.use('/api/departments',  departmentsRouter);
  app.use('/api/settings',     settingsRouter);
  app.use('/api/evidence',       evidenceRouter);
  app.use('/api/controls',       controlsRouter);
  app.use('/api/policies',       policiesRouter);
  app.use('/api/risks',          risksRouter);
  app.use('/api/vendors',        vendorsRouter);
  app.use('/api/calendar',       calendarRouter);
  app.use('/api/expiry',         expiryRouter);
  app.use('/api/notifications',  notificationsRouter);
  app.use('/api/compliance-score', scoreRouter);
  app.use('/api/dashboard',      dashboardRouter);
  app.use('/api/approvals',      approvalsRouter);
  app.use('/api/signatures',     signaturesRouter);
  app.use('/api/tasks',          tasksRouter);
  app.use('/api/escalations',    escalationsRouter);
  app.use('/api/ai',             aiRouter);
  app.use('/api/reports',        reportsRouter);
  app.use('/api/billing',        billingRouter);

  // ─── 404 ─────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // ─── Global Error Handler (must be last) ─────────────────────────────────
  app.use(errorHandler);

  return app;
}
