import { Queue, Worker, type Job } from 'bullmq';
import { redisForQueues } from '../config/redis';
import { prisma } from '../lib/prisma';
import * as escalRepo from '../modules/escalations/escalations.repository';
import { notificationService } from '../modules/notifications/notification.service';
import { sendEmail, emailTemplates } from '../lib/email.service';
import { withTenantSchema } from '../lib/tenant';
import type { EscalationChainStep } from '../modules/escalations/escalations.types';

const QUEUE_NAME = 'escalation-evaluation';

export const escalationQueue = new Queue(QUEUE_NAME, {
  connection: redisForQueues,
  defaultJobOptions: { removeOnComplete: 50, removeOnFail: 100 },
});

async function getActiveTenants() {
  return prisma.$queryRaw<{ id: string; schema_name: string }[]>`
    SELECT id, schema_name FROM global.tenants WHERE is_active = TRUE
  `;
}

async function evaluateTenantEscalations(schemaName: string) {
  const rules = await escalRepo.findActiveRules(schemaName);

  for (const rule of rules) {
    try {
      await evaluateRule(schemaName, rule);
    } catch (err) {
      console.error(`[escalation.job] Rule ${rule.id} failed for ${schemaName}:`, err);
    }
  }

  // Process due escalation events (advance chain steps)
  await processDueEvents(schemaName);
}

async function evaluateRule(schemaName: string, rule: any) {
  const conditions = rule.conditions ?? {};
  let entities: Array<{ entityType: string; entityId: string; metadata: Record<string, unknown> }> = [];

  switch (rule.triggerType) {
    case 'task_overdue': {
      const daysOverdue = conditions.daysOverdue ?? 1;
      const priorityFilter = conditions.priority ?? [];
      const rows = await withTenantSchema(schemaName, (p) =>
        p.$queryRawUnsafe<any[]>(`
          SELECT id, title, assigned_to, due_date, priority
          FROM tasks
          WHERE deleted_at IS NULL
            AND status NOT IN ('completed','cancelled')
            AND due_date < NOW() - INTERVAL '${daysOverdue} days'
            ${priorityFilter.length ? `AND priority = ANY($1)` : ''}
        `, ...(priorityFilter.length ? [`{${priorityFilter.join(',')}}`] : [])),
      );
      entities = rows.map((r) => ({
        entityType: 'task',
        entityId:   r.id,
        metadata:   { title: r.title, assignedTo: r.assigned_to, dueDate: r.due_date },
      }));
      break;
    }

    case 'approval_pending': {
      const daysPending = conditions.daysPending ?? 2;
      const rows = await withTenantSchema(schemaName, (p) =>
        p.$queryRawUnsafe<any[]>(`
          SELECT id, title, requested_by, priority
          FROM approval_requests
          WHERE deleted_at IS NULL AND status = 'pending'
            AND submitted_at < NOW() - INTERVAL '${daysPending} days'
        `),
      );
      entities = rows.map((r) => ({
        entityType: 'approval_request',
        entityId:   r.id,
        metadata:   { title: r.title, requestedBy: r.requested_by },
      }));
      break;
    }

    case 'expiry_approaching': {
      const daysUntilExpiry = conditions.daysUntilExpiry ?? 30;
      const rows = await withTenantSchema(schemaName, (p) =>
        p.$queryRawUnsafe<any[]>(`
          SELECT id, name, expiry_date, owner_id
          FROM expiry_items
          WHERE status IN ('active','expiring_soon')
            AND expiry_date BETWEEN NOW() AND NOW() + INTERVAL '${daysUntilExpiry} days'
        `),
      );
      entities = rows.map((r) => ({
        entityType: 'expiry_item',
        entityId:   r.id,
        metadata:   { name: r.name, expiryDate: r.expiry_date, ownerId: r.owner_id },
      }));
      break;
    }

    case 'control_overdue': {
      const daysOverdue = conditions.daysOverdue ?? 7;
      const rows = await withTenantSchema(schemaName, (p) =>
        p.$queryRawUnsafe<any[]>(`
          SELECT id, title, owner_id, due_date, criticality
          FROM controls
          WHERE deleted_at IS NULL
            AND implementation_status NOT IN ('implemented','not_applicable')
            AND due_date < NOW() - INTERVAL '${daysOverdue} days'
        `),
      );
      entities = rows.map((r) => ({
        entityType: 'control',
        entityId:   r.id,
        metadata:   { title: r.title, ownerId: r.owner_id, criticality: r.criticality },
      }));
      break;
    }

    default:
      return;
  }

  for (const entity of entities) {
    const alreadyActive = await escalRepo.hasActiveEvent(
      schemaName, rule.id, entity.entityType, entity.entityId,
    );
    if (alreadyActive) continue;

    const chain: EscalationChainStep[] = rule.escalationChain ?? [];
    if (!chain.length) continue;

    const firstStep = chain[0];
    const nextAt = firstStep.delayHours > 0
      ? new Date(Date.now() + firstStep.delayHours * 3600_000)
      : null;

    const eventId = await escalRepo.createEvent(
      schemaName, rule.id, entity.entityType, entity.entityId, nextAt, entity.metadata,
    );

    if (!eventId) continue;

    // Fire step 0 immediately if delay is 0
    if (firstStep.delayHours === 0) {
      await fireChainStep(schemaName, entity, firstStep, rule.name, entity.metadata);
    }
  }
}

async function processDueEvents(schemaName: string) {
  const dueEvents = await escalRepo.findDueEvents(schemaName);

  for (const event of dueEvents) {
    const chain: EscalationChainStep[] = event.escalation_chain ?? [];
    const nextStep = event.current_chain_step + 1;

    if (nextStep >= chain.length) {
      await escalRepo.completeEvent(schemaName, event.id);
      continue;
    }

    const step = chain[nextStep];
    await fireChainStep(
      schemaName,
      { entityType: event.entity_type, entityId: event.entity_id, metadata: event.metadata ?? {} },
      step,
      event.rule_name,
      event.metadata ?? {},
    );

    const nextNextStep = chain[nextStep + 1];
    const nextAt = nextNextStep
      ? new Date(Date.now() + nextNextStep.delayHours * 3600_000)
      : null;

    if (nextAt) {
      await escalRepo.advanceEvent(schemaName, event.id, nextStep, nextAt);
    } else {
      await escalRepo.completeEvent(schemaName, event.id);
    }
  }
}

async function fireChainStep(
  schemaName: string,
  entity: { entityType: string; entityId: string; metadata: Record<string, unknown> },
  step: EscalationChainStep,
  ruleName: string,
  metadata: Record<string, unknown>,
) {
  const entityTitle = (metadata.title ?? metadata.name ?? `${entity.entityType} ${entity.entityId}`) as string;
  const entityUrl = `${process.env.APP_URL ?? 'http://localhost:5173'}/${entity.entityType.replace('_', '-')}s/${entity.entityId}`;

  switch (step.action) {
    case 'notify': {
      // Notify assignee or specific user
      const targetUserId = step.targetId ?? (metadata.assignedTo as string) ?? (metadata.ownerId as string);
      if (!targetUserId) break;
      await notificationService.createForUser(schemaName, {
        userId:           targetUserId,
        title:            `Escalation: ${entityTitle}`,
        body:             step.message,
        notificationType: 'escalation',
        priority:         'high',
        referenceType:    entity.entityType,
        referenceId:      entity.entityId,
        actionUrl:        entityUrl,
      });
      await _sendEscalationEmail(schemaName, targetUserId, entityTitle, step.message, entityUrl);
      break;
    }

    case 'notify_role': {
      if (!step.targetRole) break;
      const users = await withTenantSchema(schemaName, (p) =>
        p.$queryRawUnsafe<any[]>(`
          SELECT DISTINCT u.id FROM global.users u
          JOIN global.tenant_users tu ON tu.user_id = u.id
          JOIN global.tenants t ON t.schema_name = $1
          WHERE tu.tenant_id = t.id AND tu.role = $2 AND tu.is_active = TRUE
        `, schemaName, step.targetRole),
      );
      for (const user of users) {
        await notificationService.createForUser(schemaName, {
          userId: user.id, title: `Escalation: ${entityTitle}`,
          body: step.message, notificationType: 'escalation',
          priority: 'high', referenceType: entity.entityType,
          referenceId: entity.entityId, actionUrl: entityUrl,
        });
      }
      break;
    }

    case 'notify_manager':
    case 'reassign':
    case 'create_task':
      // Complex actions — notify compliance_manager role as fallback
      console.warn(`[escalation.job] Action ${step.action} for rule in ${schemaName} — requires manual handling`);
      break;
  }
}

async function _sendEscalationEmail(schemaName: string, userId: string, entityTitle: string, message: string, entityUrl: string) {
  try {
    const [user] = await withTenantSchema(schemaName, (p) =>
      p.$queryRawUnsafe<any[]>(`SELECT email, first_name, last_name FROM global.users WHERE id=$1`, userId),
    );
    if (!user?.email) return;
    const tmpl = emailTemplates.escalationAlert({
      recipientName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email,
      entityTitle,
      message,
      entityUrl,
    });
    await sendEmail({ to: user.email, ...tmpl });
  } catch { /* fire-and-forget */ }
}

// ── Worker & scheduler ────────────────────────────────────────

async function processJob(_job: Job) {
  const tenants = await getActiveTenants();
  for (const tenant of tenants) {
    try {
      await evaluateTenantEscalations(tenant.schema_name);
    } catch (err) {
      console.error(`[escalation.job] Tenant ${tenant.schema_name} failed:`, err);
    }
  }
}

export function startEscalationWorker() {
  const worker = new Worker(QUEUE_NAME, processJob, { connection: redisForQueues, concurrency: 1 });
  worker.on('failed', (job, err) => console.error(`[escalation.job] Job ${job?.id} failed:`, err));
  return worker;
}

export async function scheduleEscalationJob() {
  await escalationQueue.add(
    'evaluate-escalations',
    {},
    { repeat: { pattern: '0 * * * *' } }, // every hour
  );
}
