import { Queue, Worker, type Job } from 'bullmq';
import { redisForQueues } from '../config/redis';
import { prisma } from '../lib/prisma';
import { withTenantSchema } from '../lib/tenant';
import { notificationService } from '../modules/notifications/notification.service';
import { sendEmail, emailTemplates } from '../lib/email.service';

const QUEUE_NAME = 'approval-deadlines';

export const approvalDeadlineQueue = new Queue(QUEUE_NAME, {
  connection: redisForQueues,
  defaultJobOptions: { removeOnComplete: 50, removeOnFail: 100 },
});

async function processJob(_job: Job) {
  const tenants = await prisma.$queryRaw<{ id: string; schema_name: string }[]>`
    SELECT id, schema_name FROM global.tenants WHERE is_active = TRUE
  `;

  for (const tenant of tenants) {
    try {
      await checkTenantDeadlines(tenant.schema_name);
    } catch (err) {
      console.error(`[approval-deadline.job] Tenant ${tenant.schema_name} failed:`, err);
    }
  }
}

async function checkTenantDeadlines(schemaName: string) {
  // Find approval requests approaching their deadline (within 24h) that are still pending
  const approaching = await withTenantSchema(schemaName, (p) =>
    p.$queryRawUnsafe<any[]>(`
      SELECT ar.id, ar.title, ar.requested_by, ar.deadline,
             u.email AS requester_email,
             u.first_name || ' ' || u.last_name AS requester_name
      FROM approval_requests ar
      JOIN global.users u ON u.id = ar.requested_by
      WHERE ar.deleted_at IS NULL AND ar.status = 'pending'
        AND ar.deadline IS NOT NULL
        AND ar.deadline BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.reference_type = 'approval_request'
            AND n.reference_id = ar.id
            AND n.notification_type = 'approval_deadline_warning'
            AND n.created_at > NOW() - INTERVAL '25 hours'
        )
    `),
  );

  for (const req of approaching) {
    // Notify requester
    await notificationService.createForUser(schemaName, {
      userId:           req.requested_by,
      title:            `Approval deadline approaching: ${req.title}`,
      body:             `Your approval request is due in less than 24 hours.`,
      notificationType: 'approval_deadline_warning',
      priority:         'high',
      referenceType:    'approval_request',
      referenceId:      req.id,
      actionUrl:        `/approvals/${req.id}`,
    });

    // Notify active step approvers
    const activeSteps = await withTenantSchema(schemaName, (p) =>
      p.$queryRawUnsafe<any[]>(`
        SELECT ars.assigned_to, u.email, u.first_name || ' ' || u.last_name AS name
        FROM approval_request_steps ars
        JOIN global.users u ON u.id = ars.assigned_to
        WHERE ars.request_id = $1 AND ars.status = 'active' AND ars.assigned_to IS NOT NULL
      `, req.id),
    );

    for (const step of activeSteps) {
      await notificationService.createForUser(schemaName, {
        userId:           step.assigned_to,
        title:            `Urgent: approval needed for "${req.title}"`,
        body:             `This approval request expires in less than 24 hours.`,
        notificationType: 'approval_deadline_warning',
        priority:         'critical',
        referenceType:    'approval_request',
        referenceId:      req.id,
        actionUrl:        `/approvals/${req.id}`,
      });
    }
  }

  // Mark overdue approvals as timed-out (escalate to rejected for hard deadlines)
  await withTenantSchema(schemaName, (p) =>
    p.$executeRawUnsafe(`
      UPDATE approval_requests
      SET status = 'rejected', rejection_reason = 'Approval deadline exceeded', completed_at = NOW(), updated_at = NOW()
      WHERE deleted_at IS NULL AND status = 'pending'
        AND deadline IS NOT NULL AND deadline < NOW()
    `),
  );
}

export function startApprovalDeadlineWorker() {
  const worker = new Worker(QUEUE_NAME, processJob, { connection: redisForQueues, concurrency: 1 });
  worker.on('failed', (job, err) => console.error(`[approval-deadline.job] Job ${job?.id} failed:`, err));
  return worker;
}

export async function scheduleApprovalDeadlineJob() {
  await approvalDeadlineQueue.add(
    'check-approval-deadlines',
    {},
    { repeat: { pattern: '30 * * * *' } }, // every hour at :30
  );
}
