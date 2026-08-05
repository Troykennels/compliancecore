import { Queue, Worker, type Job } from 'bullmq';
import { redisForQueues } from '../config/redis';
import { logger } from '../lib/logger';
import { purgeDueTenants } from '../lib/tenant-erasure';

/**
 * Permanently erases organisations whose grace period has expired.
 *
 * The second half of the erasure path: requestErasure stops access and starts
 * the clock, this destroys the data once it runs out. It is what makes a GDPR
 * Art.17 / NDPA erasure request something the product can actually honour
 * rather than a support ticket someone runs SQL for.
 *
 * Runs at 03:00 UTC, after the renewal job, so a tenant being erased has
 * already had its subscription cancelled and is not charged on the way out.
 */

const QUEUE_NAME = 'tenant-purge';

export const tenantPurgeQueue = new Queue(QUEUE_NAME, {
  connection: redisForQueues,
  // Deliberately NOT retried automatically. The work is idempotent, so the next
  // daily run picks up anything that failed — but a destructive operation
  // hammering itself three times on a transient database error is not a
  // behaviour worth having.
  defaultJobOptions: { attempts: 1 },
});

export async function scheduleTenantPurgeJob(): Promise<void> {
  await tenantPurgeQueue.add(
    'purge-erased-tenants',
    {},
    {
      jobId: 'tenant-purge-daily',
      repeat: { pattern: '0 3 * * *' },
      removeOnComplete: 5,
      removeOnFail: 20,
    },
  );
}

export function startTenantPurgeWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      const { purged, failed } = await purgeDueTenants();
      if (failed > 0) {
        // Surfaced as a job failure so it appears in monitoring: a tenant that
        // cannot be erased is a compliance obligation left unmet, not a
        // routine warning.
        throw new Error(`${failed} tenant purge(s) failed (${purged} succeeded)`);
      }
    },
    { connection: redisForQueues, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Tenant purge job failed');
  });

  return worker;
}
