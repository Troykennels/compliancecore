import { Queue, Worker, Job } from 'bullmq';
import { redisForQueues } from '../config/redis';
import { prisma } from '../config/database';
import { withTenantSchema } from '../lib/prisma';
import { expiryRepository } from '../modules/expiry/expiry.repository';
import { calendarRepository } from '../modules/calendar/calendar.repository';
import { notificationRepository } from '../modules/notifications/notification.repository';
import { email as emailClient } from '../lib/email';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const QUEUE_NAME = 'compliance-reminders';

export const reminderQueue = new Queue(QUEUE_NAME, {
  connection: redisForQueues,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
});

// Schedule the daily reminder check. Idempotent — BullMQ deduplicates by jobId.
export async function scheduleReminderJob(): Promise<void> {
  await reminderQueue.add(
    'daily-check',
    {},
    {
      jobId: 'daily-reminder-check',
      repeat: { pattern: '0 8 * * *' }, // 08:00 UTC daily
      removeOnComplete: 5,
      removeOnFail: 10,
    },
  );
}

interface TenantRow {
  id: string;
  schema_name: string;
  notification_settings: Record<string, unknown> | null;
}

async function getAllActiveTenants(): Promise<TenantRow[]> {
  return prisma.$queryRaw<TenantRow[]>`
    SELECT id, schema_name,
           (SELECT notification_settings FROM global.tenants t2 WHERE t2.id = t.id) AS notification_settings
    FROM global.tenants t
    WHERE is_active = TRUE AND deleted_at IS NULL
  `;
}

async function processExpiryReminders(schemaName: string, tenantId: string): Promise<void> {
  await withTenantSchema(schemaName, async (tx) => {
    // Refresh statuses first
    await expiryRepository.refreshStatuses(tx);

    const items = await expiryRepository.findExpiringSoon(tx, 90);

    const notificationsToCreate = [];

    for (const item of items) {
      const daysUntil = item.daysUntilExpiry;

      // Fire only the tightest reached threshold this run (smallest threshold
      // still >= daysUntil), and mark every larger reached threshold as sent so
      // we never emit a burst of duplicate alerts when an item is first seen.
      const reached = item.reminderDays
        .filter((threshold) => daysUntil <= threshold)
        .sort((a, b) => a - b);
      if (reached.length === 0) continue;

      const tightest = reached[0];

      const alreadySent = await expiryRepository.hasReminderBeenSent(
        tx, 'expiry_item', item.id, 'expiry_warning', tightest, 'in_app',
      );

      if (!alreadySent && item.ownerId) {
        notificationsToCreate.push({
          userId:           item.ownerId,
          title:            `${item.name} expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          body:             `Entity: ${item.entityType}. Expiry: ${item.expiryDate.toLocaleDateString()}.`,
          notificationType: 'expiry_warning' as const,
          priority:         daysUntil <= 7 ? 'critical' as const : daysUntil <= 30 ? 'high' as const : 'medium' as const,
          referenceType:    'expiry_item',
          referenceId:      item.id,
          // Relative. React Router treats a string that does not start with
          // "/" as a path relative to the CURRENT route, so an absolute URL
          // stored here resolved to nonsense like
          // "/dashboard/http:/host/expiry" and dumped the user on the catch-all.
          actionUrl:        '/expiry',
        });

        // Send email if owner email is available. Fire-and-forget; failures
        // must not block notification creation.
        if (item.ownerEmail) {
          await emailClient.sendExpiryReminder({
            to:         item.ownerEmail,
            ownerName:  item.ownerName ?? '',
            itemName:   item.name,
            daysUntil,
            expiryDate: item.expiryDate.toLocaleDateString(),
          }).catch(() => {
            // noop — sendExpiryReminderEmail already swallows transport errors
          });
        }
      }

      // Mark the tightest and every larger reached threshold as sent so future
      // runs only fire when a newer, tighter window is reached.
      for (const threshold of reached) {
        await expiryRepository.logReminderSent(
          tx, 'expiry_item', item.id, 'expiry_warning', threshold, 'in_app',
        );
      }
    }

    if (notificationsToCreate.length > 0) {
      await notificationRepository.createBulk(tx, notificationsToCreate);
    }
  });
}

async function processCalendarReminders(schemaName: string): Promise<void> {
  await withTenantSchema(schemaName, async (tx) => {
    // Mark overdue events
    await calendarRepository.markOverdue(tx);

    const events = await calendarRepository.findForReminder(tx, 30);
    const notificationsToCreate = [];

    for (const event of events) {
      const daysUntil = Math.ceil(
        (event.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      if (!event.assignedTo) continue;

      // Fire only the tightest reached threshold this run; mark larger reached
      // thresholds sent so an event entering the window doesn't alert repeatedly.
      const reached = event.reminderDays
        .filter((threshold) => daysUntil <= threshold)
        .sort((a, b) => a - b);
      if (reached.length === 0) continue;

      const tightest = reached[0];

      const alreadySent = await expiryRepository.hasReminderBeenSent(
        tx, 'calendar_event', event.id, 'calendar_reminder', tightest, 'in_app',
      );

      if (!alreadySent) {
        notificationsToCreate.push({
          userId:           event.assignedTo,
          title:            `Upcoming: ${event.title} in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          body:             `Scheduled: ${event.startDate.toLocaleDateString()}. Type: ${event.eventType}.`,
          notificationType: 'calendar_reminder' as const,
          priority:         event.priority,
          referenceType:    'calendar_event',
          referenceId:      event.id,
          actionUrl:        '/calendar',
        });
      }

      for (const threshold of reached) {
        await expiryRepository.logReminderSent(
          tx, 'calendar_event', event.id, 'calendar_reminder', threshold, 'in_app',
        );
      }
    }

    if (notificationsToCreate.length > 0) {
      await notificationRepository.createBulk(tx, notificationsToCreate);
    }
  });
}

async function runDailyCheck(): Promise<void> {
  const tenants = await getAllActiveTenants();
  logger.info({ count: tenants.length }, 'Running daily compliance reminders');

  for (const tenant of tenants) {
    try {
      await processExpiryReminders(tenant.schema_name, tenant.id);
      await processCalendarReminders(tenant.schema_name);
    } catch (err) {
      logger.error({ err, tenantId: tenant.id }, 'Reminder check failed for tenant');
    }
  }
}

export function startReminderWorker(): Worker {
  const worker = new Worker(QUEUE_NAME, async (_job: Job) => {
    await runDailyCheck();
  }, { connection: redisForQueues, concurrency: 1 });

  worker.on('completed', () => logger.info('Daily reminder job completed'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Reminder job failed'));

  return worker;
}
