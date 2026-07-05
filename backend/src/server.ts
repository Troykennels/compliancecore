import type { Worker } from 'bullmq';
import { createApp } from './app';
import { prisma } from './config/database';
import { redis, redisForQueues } from './config/redis';
import { logger } from './lib/logger';
import { env } from './config/env';
import { startOcrWorker } from './jobs/ocr.job';
import { startReminderWorker, scheduleReminderJob } from './jobs/reminder.job';
import { startScoreSnapshotWorker, scheduleScoreSnapshotJob } from './jobs/score-snapshot.job';
import { startEscalationWorker, scheduleEscalationJob } from './jobs/escalation.job';
import { startApprovalDeadlineWorker, scheduleApprovalDeadlineJob } from './jobs/approval-deadline.job';
import { startScheduledReportsWorker, scheduleReportsJob } from './jobs/scheduled-reports.job';
import { startBillingRenewalWorker, scheduleBillingRenewalJob } from './jobs/billing-renewal.job';
import { initBillingTables } from './modules/billing/billing.repository';

async function bootstrap(): Promise<void> {
  // Verify database and Redis connectivity before accepting traffic
  await prisma.$connect();
  logger.info('Database connected');

  await redis.connect();
  logger.info('Redis connected');

  // Collect worker handles so they can be drained on shutdown (finish the
  // in-flight job, stop taking new ones) instead of being killed mid-processing.
  const workers: Worker[] = [];

  workers.push(startOcrWorker());
  logger.info('OCR worker started');

  workers.push(startReminderWorker());
  await scheduleReminderJob();
  logger.info('Reminder worker started');

  workers.push(startScoreSnapshotWorker());
  await scheduleScoreSnapshotJob();
  logger.info('Score snapshot worker started');

  workers.push(startEscalationWorker());
  await scheduleEscalationJob();
  logger.info('Escalation worker started');

  workers.push(startApprovalDeadlineWorker());
  await scheduleApprovalDeadlineJob();
  logger.info('Approval deadline worker started');

  workers.push(startScheduledReportsWorker());
  await scheduleReportsJob();
  logger.info('Scheduled reports worker started');

  await initBillingTables();
  workers.push(startBillingRenewalWorker());
  await scheduleBillingRenewalJob();
  logger.info('Billing renewal worker started');

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'ComplianceCore API listening');
  });

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received');

    server.close(async () => {
      logger.info('HTTP server closed');
      // Drain BullMQ workers: let each finish its in-flight job and stop pulling
      // new ones, so a deploy never kills a job mid-processing.
      await Promise.allSettled(workers.map((w) => w.close()));
      logger.info('Workers drained');
      await prisma.$disconnect();
      await redis.quit();
      await redisForQueues.quit();
      logger.info('Connections closed. Exiting.');
      process.exit(0);
    });

    // Force exit after 30 seconds if graceful shutdown stalls
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 30_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down');
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
