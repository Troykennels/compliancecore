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
  // Retry on transient DB/Redis blips so a single failed tick doesn't silently
  // drop that hour's escalation sweep until the next cron fire.
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

async function getActiveTenants() {
  return prisma.$queryRaw<{ id: string; schema_name: string }[]>`
    SELECT id, schema_name FROM global.tenants WHERE is_active = TRUE AND deleted_at IS NULL
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

// Coerce a tenant-authored condition value to a safe bounded integer so it can
// be passed as a bound query parameter rather than interpolated into SQL.
function toInt(value: unknown, fallback: number): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

async function evaluateRule(schemaName: string, rule: any) {
  const conditions = rule.conditions ?? {};
  let entities: Array<{ entityType: string; entityId: string; metadata: Record<string, unknown> }> = [];

  switch (rule.triggerType) {
    case 'task_overdue': {
      const daysOverdue = toInt(conditions.daysOverdue, 1);
      const priorityFilter: string[] = Array.isArray(conditions.priority) ? conditions.priority : [];
      const rows = await withTenantSchema(schemaName, (p) =>
        p.$queryRawUnsafe<any[]>(`
          SELECT id, title, assigned_to, due_date, priority
          FROM tasks
          WHERE deleted_at IS NULL
            AND status NOT IN ('completed','cancelled')
            AND due_date < NOW() - ($1::int * INTERVAL '1 day')
            ${priorityFilter.length ? `AND priority = ANY($2::text[])` : ''}
        `, daysOverdue, ...(priorityFilter.length ? [priorityFilter] : [])),
      );
      entities = rows.map((r) => ({
        entityType: 'task',
        entityId:   r.id,
        metadata:   { title: r.title, assignedTo: r.assigned_to, dueDate: r.due_date },
      }));
      break;
    }

    case 'approval_pending': {
      const daysPending = toInt(conditions.daysPending, 2);
      const rows = await withTenantSchema(schemaName, (p) =>
        p.$queryRawUnsafe<any[]>(`
          SELECT id, title, requested_by, priority
          FROM approval_requests
          WHERE deleted_at IS NULL AND status = 'pending'
            AND submitted_at < NOW() - ($1::int * INTERVAL '1 day')
        `, daysPending),
      );
      entities = rows.map((r) => ({
        entityType: 'approval_request',
        entityId:   r.id,
        metadata:   { title: r.title, requestedBy: r.requested_by },
      }));
      break;
    }

    case 'expiry_approaching': {
      const daysUntilExpiry = toInt(conditions.daysUntilExpiry, 30);
      const rows = await withTenantSchema(schemaName, (p) =>
        p.$queryRawUnsafe<any[]>(`
          SELECT id, name, expiry_date, owner_id
          FROM expiry_items
          WHERE status IN ('active','expiring_soon')
            AND expiry_date BETWEEN NOW() AND NOW() + ($1::int * INTERVAL '1 day')
        `, daysUntilExpiry),
      );
      entities = rows.map((r) => ({
        entityType: 'expiry_item',
        entityId:   r.id,
        metadata:   { name: r.name, expiryDate: r.expiry_date, ownerId: r.owner_id },
      }));
      break;
    }

    case 'control_overdue': {
      const daysOverdue = toInt(conditions.daysOverdue, 7);
      const rows = await withTenantSchema(schemaName, (p) =>
        p.$queryRawUnsafe<any[]>(`
          SELECT id, title, owner_id, due_date, criticality
          FROM controls
          WHERE deleted_at IS NULL
            AND implementation_status NOT IN ('implemented','not_applicable')
            AND due_date < NOW() - ($1::int * INTERVAL '1 day')
        `, daysOverdue),
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
    // current_chain_step semantics: the index of the NEXT step to fire.
    // A fresh event defaults to 0, so step 0 is scheduled first: fire now when
    // its delay is 0, otherwise schedule it delayHours from now.
    const step0At = firstStep.delayHours > 0
      ? new Date(Date.now() + firstStep.delayHours * 3600_000)
      : new Date();

    const eventId = await escalRepo.createEvent(
      schemaName, rule.id, entity.entityType, entity.entityId, step0At, entity.metadata,
    );

    if (!eventId) continue;

    // If step 0 is due immediately, fire it now and schedule step 1 (if any).
    // Otherwise leave current_chain_step=0 so processDueEvents fires step 0 on
    // its due tick — the authored chain then runs strictly in order.
    if (firstStep.delayHours === 0) {
      await fireChainStep(schemaName, entity, firstStep, rule.name, entity.metadata);
      const secondStep = chain[1];
      if (secondStep) {
        await escalRepo.advanceEvent(
          schemaName, eventId, 1, new Date(Date.now() + secondStep.delayHours * 3600_000),
        );
      } else {
        await escalRepo.completeEvent(schemaName, eventId);
      }
    }
  }
}

async function processDueEvents(schemaName: string) {
  const dueEvents = await escalRepo.findDueEvents(schemaName);

  for (const event of dueEvents) {
    const chain: EscalationChainStep[] = event.escalation_chain ?? [];
    // current_chain_step is the index of the next step to fire (see evaluateRule).
    const stepIndex = event.current_chain_step;

    if (stepIndex >= chain.length) {
      await escalRepo.completeEvent(schemaName, event.id);
      continue;
    }

    const step = chain[stepIndex];
    await fireChainStep(
      schemaName,
      { entityType: event.entity_type, entityId: event.entity_id, metadata: event.metadata ?? {} },
      step,
      event.rule_name,
      event.metadata ?? {},
    );

    // Schedule the following step, or complete the event when the chain is done.
    const followingStep = chain[stepIndex + 1];
    if (followingStep) {
      await escalRepo.advanceEvent(
        schemaName, event.id, stepIndex + 1,
        new Date(Date.now() + followingStep.delayHours * 3600_000),
      );
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
  /**
   * Where an escalation notification should take you.
   *
   * This used to build an ABSOLUTE url from APP_URL — an env var this service
   * does not even define, so it fell back to a hard-coded localhost:5173 in
   * production — and pluralised by appending "s", which produced "/policys/".
   * Between the wrong origin and the wrong word, the link never resolved.
   *
   * It now points at the module's list page, which is a route that definitely
   * exists. Per-record detail routes are declared in paths.ts but several have
   * no matching <Route>, so linking straight to a record would land the user on
   * the dashboard with no explanation of what was escalated.
   */
  function entityPath(entityType: string): string {
    const LIST_PATHS: Record<string, string> = {
      control: '/controls',
      policy: '/policies',
      risk: '/risks',
      vendor: '/vendors',
      audit: '/audits',
      task: '/tasks',
      evidence: '/evidence',
      incident: '/incidents',
      approval: '/approvals',
      training: '/training',
      expiry_item: '/expiry',
      calendar_event: '/calendar',
    };
    return LIST_PATHS[entityType] ?? '/dashboard';
  }

  const entityTitle = (metadata.title ?? metadata.name ?? `${entity.entityType} ${entity.entityId}`) as string;
  const entityUrl = entityPath(entity.entityType);

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
      await _notifyRole(schemaName, step.targetRole, entity, entityTitle, step.message, entityUrl);
      break;
    }

    case 'notify_manager': {
      // The identity store has no manager model, so escalate to the
      // compliance_manager role as the responsible party (safe fallback).
      await _notifyRole(schemaName, 'compliance_manager', entity, entityTitle, step.message, entityUrl);
      break;
    }

    case 'reassign': {
      const newAssignee = step.targetId ?? null;
      if (!newAssignee) {
        // Nothing to reassign to — fall back to notifying the current owner.
        const owner = (metadata.assignedTo as string) ?? (metadata.ownerId as string) ?? null;
        if (owner) {
          await notificationService.createForUser(schemaName, {
            userId: owner, title: `Escalation: ${entityTitle}`, body: step.message,
            notificationType: 'escalation', priority: 'high',
            referenceType: entity.entityType, referenceId: entity.entityId, actionUrl: entityUrl,
          });
        }
        break;
      }
      // Move ownership of the underlying entity to the escalation target.
      if (entity.entityType === 'task') {
        await withTenantSchema(schemaName, (p) =>
          p.$executeRawUnsafe(
            `UPDATE tasks SET assigned_to = $1::uuid, updated_at = NOW() WHERE id = $2::uuid`,
            newAssignee, entity.entityId,
          ),
        );
      } else if (entity.entityType === 'control') {
        await withTenantSchema(schemaName, (p) =>
          p.$executeRawUnsafe(
            `UPDATE controls SET owner_id = $1::uuid, updated_at = NOW() WHERE id = $2::uuid`,
            newAssignee, entity.entityId,
          ),
        );
      }
      // Tell the new owner they now own this item.
      await notificationService.createForUser(schemaName, {
        userId: newAssignee, title: `Reassigned to you: ${entityTitle}`, body: step.message,
        notificationType: 'escalation', priority: 'high',
        referenceType: entity.entityType, referenceId: entity.entityId, actionUrl: entityUrl,
      });
      break;
    }

    case 'create_task': {
      const assignee = step.targetId
        ?? (metadata.assignedTo as string)
        ?? (metadata.ownerId as string)
        ?? null;
      await withTenantSchema(schemaName, (p) =>
        p.$executeRawUnsafe(
          `INSERT INTO tasks (title, description, assigned_to, priority, status, entity_type, entity_id)
           VALUES ($1, $2, $3::uuid, 'high', 'todo', $4, $5::uuid)`,
          `Escalation: ${entityTitle}`,
          step.message,
          assignee,
          entity.entityType,
          entity.entityId,
        ),
      );
      break;
    }
  }
}

// Notify every active member of a tenant role. Uses global.tenant_memberships
// (the membership table) joined to the tenant by schema_name.
async function _notifyRole(
  schemaName: string,
  role: string,
  entity: { entityType: string; entityId: string; metadata: Record<string, unknown> },
  entityTitle: string,
  message: string,
  entityUrl: string,
) {
  const users = await withTenantSchema(schemaName, (p) =>
    p.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT u.id FROM global.users u
      JOIN global.tenant_memberships tu ON tu.user_id = u.id
      JOIN global.tenants t ON t.schema_name = $1
      WHERE tu.tenant_id = t.id AND tu.role::text = $2 AND tu.is_active = TRUE
        AND u.is_active = TRUE AND u.deleted_at IS NULL
    `, schemaName, role),
  );
  for (const user of users) {
    await notificationService.createForUser(schemaName, {
      userId: user.id, title: `Escalation: ${entityTitle}`,
      body: message, notificationType: 'escalation',
      priority: 'high', referenceType: entity.entityType,
      referenceId: entity.entityId, actionUrl: entityUrl,
    });
  }
}

async function _sendEscalationEmail(schemaName: string, userId: string, entityTitle: string, message: string, entityUrl: string) {
  try {
    const [user] = await withTenantSchema(schemaName, (p) =>
      p.$queryRawUnsafe<any[]>(`SELECT email, first_name, last_name FROM global.users WHERE id=$1::uuid`, userId),
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
