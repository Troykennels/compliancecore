import { Queue, Worker, Job } from 'bullmq';
import { redisForQueues } from '../config/redis';
import { prisma } from '../config/database';
import { scoreService } from '../modules/compliance-score/score.service';
import { logger } from '../lib/logger';

const QUEUE_NAME = 'score-snapshots';

export const scoreSnapshotQueue = new Queue(QUEUE_NAME, {
  connection: redisForQueues,
  defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 30_000 } },
});

export async function scheduleScoreSnapshotJob(): Promise<void> {
  await scoreSnapshotQueue.add(
    'daily-snapshot',
    {},
    {
      jobId: 'daily-score-snapshot',
      repeat: { pattern: '0 1 * * *' }, // 01:00 UTC daily
      removeOnComplete: 5,
      removeOnFail: 10,
    },
  );
}

async function getAllActiveTenants(): Promise<{ id: string; schema_name: string }[]> {
  return prisma.$queryRaw<{ id: string; schema_name: string }[]>`
    SELECT id, schema_name FROM global.tenants
    WHERE deleted_at IS NULL
      AND subscription_status IS DISTINCT FROM 'cancelled'
  `;
}

export function startScoreSnapshotWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      const tenants = await getAllActiveTenants();
      logger.info({ count: tenants.length }, 'Taking daily compliance score snapshots');

      for (const tenant of tenants) {
        try {
          await scoreService.takeSnapshot(tenant.schema_name);
          logger.debug({ tenantId: tenant.id }, 'Score snapshot saved');
        } catch (err) {
          logger.error({ err, tenantId: tenant.id }, 'Score snapshot failed for tenant');
        }
      }
    },
    { connection: redisForQueues, concurrency: 1 },
  );

  worker.on('completed', () => logger.info('Daily score snapshot job completed'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Score snapshot job failed'));

  return worker;
}
