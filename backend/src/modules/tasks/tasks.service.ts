import * as repo from './tasks.repository';
import { notificationService } from '../notifications/notification.service';
import { sendEmail, emailTemplates } from '../../lib/email.service';
import { withTenantSchema } from '../../lib/tenant';
import { AppError } from '../../lib/errors';
import { assertActiveMembers } from '../../lib/active-member';
import type { CreateTaskDto, UpdateTaskDto, TaskFilters, AddCommentDto } from './tasks.types';

export async function listTasks(schemaName: string, filters: TaskFilters, currentUserId: string) {
  return repo.findTasks(schemaName, filters, currentUserId);
}

export async function getTask(schemaName: string, id: string) {
  const task = await repo.findTaskById(schemaName, id);
  if (!task) throw new AppError('Task not found', 404);
  const [subtasks, comments] = await Promise.all([
    repo.findSubtasks(schemaName, id),
    repo.findComments(schemaName, id),
  ]);
  return { ...task, subtasks, comments };
}

export async function createTask(
  schemaName: string,
  dto: CreateTaskDto,
  userId: string,
  userEmail: string,
  userName: string,
) {
  await assertActiveMembers(schemaName,[dto.assignedTo]);
  const id = await repo.createTask(schemaName, dto, userId);

  if (dto.assignedTo && dto.assignedTo !== userId) {
    await notificationService.createForUser(schemaName, {
      userId:           dto.assignedTo,
      title:            `Task assigned: ${dto.title}`,
      body:          `${userName} assigned you a task.${dto.dueDate ? ` Due: ${new Date(dto.dueDate).toLocaleDateString()}` : ''}`,
      notificationType: 'task_assigned',
      priority:         dto.priority ?? 'medium',
      referenceType:    'task',
      referenceId:      id,
      actionUrl:        `/tasks/${id}`,
    });

    // Fire-and-forget email
    _sendTaskAssignedEmail(schemaName, dto.assignedTo, id, dto.title, dto.dueDate, userName).catch(() => {});
  }

  return repo.findTaskById(schemaName, id);
}

export async function updateTask(
  schemaName: string,
  id: string,
  dto: UpdateTaskDto,
  currentUserId: string,
  currentUserName: string,
) {
  const existing = await repo.findTaskById(schemaName, id);
  if (!existing) throw new AppError('Task not found', 404);

  await assertActiveMembers(schemaName,[dto.assignedTo]);

  if(dto.status==='completed'&&Object.keys(dto).some(key=>key!=='status')){const action=await withTenantSchema(schemaName,tx=>tx.$queryRawUnsafe<Array<{corrective_action:unknown}>>('SELECT corrective_action FROM tasks WHERE id=$1::uuid',id));if(action[0]?.corrective_action)throw new AppError('Save changed action details and obtain a fresh effectiveness check before closure.',409,'ACTION_REVIEW_REQUIRED');}
  if(dto.status==='completed') {
    const rows=await withTenantSchema(schemaName,tx=>tx.$queryRawUnsafe<Array<{corrective_action:{state?:string}|null}>>('SELECT corrective_action FROM tasks WHERE id=$1::uuid',id));
    if(rows[0]?.corrective_action&&rows[0].corrective_action.state!=='effective')throw new AppError('An independent reviewer must verify corrective-action effectiveness before closure.',409,'ACTION_REVIEW_REQUIRED');
  }
  await repo.updateTask(schemaName, id, dto);
  if(Object.keys(dto).some(key=>!['status','actualHours'].includes(key)))await withTenantSchema(schemaName,tx=>tx.$executeRawUnsafe("UPDATE tasks SET corrective_action=(corrective_action-'reviewedBy'-'reviewedAt'-'reviewNote')||'{\"state\":\"awaiting_verification\"}'::jsonb,status='in_review' WHERE id=$1::uuid AND corrective_action IS NOT NULL",id));

  // Notify new assignee if reassigned
  if (dto.assignedTo && dto.assignedTo !== existing.assignedTo && dto.assignedTo !== currentUserId) {
    await notificationService.createForUser(schemaName, {
      userId:           dto.assignedTo,
      title:            `Task assigned: ${existing.title}`,
      body:          `${currentUserName} reassigned this task to you.`,
      notificationType: 'task_assigned',
      priority:         dto.priority ?? existing.priority,
      referenceType:    'task',
      referenceId:      id,
      actionUrl:        `/tasks/${id}`,
    });
  }

  return repo.findTaskById(schemaName, id);
}

export async function getSubtasks(schemaName: string, taskId: string) {
  const task = await repo.findTaskById(schemaName, taskId);
  if (!task) throw new AppError('Task not found', 404);
  return repo.findSubtasks(schemaName, taskId);
}

export async function deleteTask(schemaName: string, id: string) {
  const existing = await repo.findTaskById(schemaName, id);
  if (!existing) throw new AppError('Task not found', 404);
  await repo.softDeleteTask(schemaName, id);
}

export async function getOverdueTasks(schemaName: string) {
  return repo.getOverdueTasks(schemaName);
}

export async function getTaskStats(schemaName: string) {
  return repo.getTaskStatusCounts(schemaName);
}

export async function getComments(schemaName: string, taskId: string) {
  const task = await repo.findTaskById(schemaName, taskId);
  if (!task) throw new AppError('Task not found', 404);
  return repo.findComments(schemaName, taskId);
}

export async function addComment(
  schemaName: string,
  taskId: string,
  userId: string,
  userName: string,
  dto: AddCommentDto,
) {
  const task = await repo.findTaskById(schemaName, taskId);
  if (!task) throw new AppError('Task not found', 404);

  const id = await repo.addComment(schemaName, taskId, userId, dto);

  // Notify assignee if comment is from someone else
  if (task.assignedTo && task.assignedTo !== userId) {
    await notificationService.createForUser(schemaName, {
      userId:           task.assignedTo,
      title:            `New comment on task: ${task.title}`,
      body:          `${userName}: ${dto.body.slice(0, 100)}${dto.body.length > 100 ? '...' : ''}`,
      notificationType: 'task_comment',
      priority:         'low',
      referenceType:    'task',
      referenceId:      taskId,
      actionUrl:        `/tasks/${taskId}`,
    });
  }

  const comments = await repo.findComments(schemaName, taskId);
  return comments.find((c) => c.id === id)!;
}

// Roles allowed to delete any comment on a task (not just their own).
const COMMENT_MODERATOR_ROLES = new Set(['owner', 'admin', 'compliance_manager']);

export async function deleteComment(
  schemaName: string,
  taskId: string,
  commentId: string,
  userId: string,
  role: string | null,
) {
  const canModerate = role ? COMMENT_MODERATOR_ROLES.has(role) : false;
  const deleted = await repo.deleteComment(schemaName, taskId, commentId, userId, canModerate);
  if (!deleted) throw new AppError('Comment not found', 404);
}

// ── Helpers ───────────────────────────────────────────────────

async function _sendTaskAssignedEmail(
  schemaName: string,
  assignedTo: string,
  taskId: string,
  taskTitle: string,
  dueDate: string | undefined,
  assignedBy: string,
) {
  // Look the recipient up inside the tenant transaction, but send outside it.
  // withTenantSchema wraps the callback in prisma.$transaction, so awaiting an
  // SMTP handshake in there held a pooled connection and an open transaction
  // open for the whole exchange — up to the socket timeout against a slow or
  // unreachable host, which can exhaust the pool and trip transaction timeouts.
  const user = await withTenantSchema(schemaName, async (prisma) => {
    // $1 must be cast: Prisma binds JS strings as `text` and users.id is uuid,
    // so an uncast comparison throws 42883. The caller swallows errors from
    // this function, so that failure was silent — the email simply never sent.
    const [row] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT email, first_name, last_name FROM global.users WHERE id = $1::uuid`, assignedTo,
    );
    return row;
  });

  if (!user?.email) return;
  const tmpl = emailTemplates.taskAssigned({
    recipientName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email,
    taskTitle,
    dueDate: dueDate ? new Date(dueDate).toLocaleDateString() : undefined,
    assignedBy,
    taskId,
  });
  await sendEmail({ to: user.email, ...tmpl });
}
