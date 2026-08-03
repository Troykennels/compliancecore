import { withTenantSchema } from '../../lib/tenant';
import type { Task, TaskComment, CreateTaskDto, UpdateTaskDto, TaskFilters, AddCommentDto } from './tasks.types';

// ── Tasks ─────────────────────────────────────────────────────

export async function findTasks(
  schemaName: string,
  filters: TaskFilters,
  currentUserId: string,
): Promise<{ items: Task[]; total: number; page: number; limit: number }> {
  return withTenantSchema(schemaName, async (prisma) => {
    const conditions: string[] = ['t.deleted_at IS NULL'];
    const params: any[] = [];
    let p = 1;

    if (filters.status)      { conditions.push(`t.status = $${p++}`);      params.push(filters.status); }
    if (filters.priority)    { conditions.push(`t.priority = $${p++}`);    params.push(filters.priority); }
    if (filters.assignedTo)  { conditions.push(`t.assigned_to = $${p++}::uuid`); params.push(filters.assignedTo); }
    if (filters.entityType)  { conditions.push(`t.entity_type = $${p++}`); params.push(filters.entityType); }
    if (filters.entityId)    { conditions.push(`t.entity_id = $${p++}::uuid`);   params.push(filters.entityId); }
    if (filters.frameworkId) { conditions.push(`t.framework_id = $${p++}::uuid`);params.push(filters.frameworkId); }
    if (filters.dueBefore)   { conditions.push(`t.due_date <= $${p++}`);   params.push(filters.dueBefore); }
    if (filters.dueAfter)    { conditions.push(`t.due_date >= $${p++}`);   params.push(filters.dueAfter); }
    if (filters.parentTaskId){ conditions.push(`t.parent_task_id = $${p++}::uuid`); params.push(filters.parentTaskId); }
    else                     { conditions.push(`t.parent_task_id IS NULL`); } // top-level only by default
    if (filters.overdue)     { conditions.push(`t.due_date < NOW() AND t.status NOT IN ('completed','cancelled')`); }
    if (filters.myTasks)     { conditions.push(`t.assigned_to = $${p++}::uuid`); params.push(currentUserId); }
    if (filters.q)           { conditions.push(`t.title ILIKE $${p++}`);   params.push(`%${filters.q}%`); }

    const where = conditions.join(' AND ');
    const limit  = filters.limit  ?? 25;
    const offset = ((filters.page ?? 1) - 1) * limit;

    const [countRow] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS total FROM tasks t WHERE ${where}`, ...params,
    );
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT t.*,
             u1.first_name || ' ' || u1.last_name AS assignee_name, u1.email AS assignee_email,
             u2.first_name || ' ' || u2.last_name AS assigner_name,
             u3.first_name || ' ' || u3.last_name AS creator_name,
             (SELECT COUNT(*)::int FROM tasks st WHERE st.parent_task_id = t.id AND st.deleted_at IS NULL) AS subtask_count,
             (SELECT COUNT(*)::int FROM tasks st WHERE st.parent_task_id = t.id AND st.deleted_at IS NULL AND st.status = 'completed') AS completed_subtask_count,
             (SELECT COUNT(*)::int FROM task_comments tc WHERE tc.task_id = t.id AND tc.deleted_at IS NULL) AS comment_count
      FROM tasks t
      LEFT JOIN global.users u1 ON u1.id = t.assigned_to
      LEFT JOIN global.users u2 ON u2.id = t.assigned_by
      LEFT JOIN global.users u3 ON u3.id = t.created_by
      WHERE ${where}
      ORDER BY
        CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
      LIMIT $${p++} OFFSET $${p++}
    `, ...params, limit, offset);

    return { items: rows.map(mapTask), total: countRow.total, page: filters.page ?? 1, limit };
  });
}

export async function findTaskById(schemaName: string, id: string): Promise<Task | null> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT t.*,
             u1.first_name || ' ' || u1.last_name AS assignee_name, u1.email AS assignee_email,
             u2.first_name || ' ' || u2.last_name AS assigner_name,
             u3.first_name || ' ' || u3.last_name AS creator_name,
             (SELECT COUNT(*)::int FROM tasks st WHERE st.parent_task_id = t.id AND st.deleted_at IS NULL) AS subtask_count,
             (SELECT COUNT(*)::int FROM tasks st WHERE st.parent_task_id = t.id AND st.deleted_at IS NULL AND st.status = 'completed') AS completed_subtask_count,
             (SELECT COUNT(*)::int FROM task_comments tc WHERE tc.task_id = t.id AND tc.deleted_at IS NULL) AS comment_count
      FROM tasks t
      LEFT JOIN global.users u1 ON u1.id = t.assigned_to
      LEFT JOIN global.users u2 ON u2.id = t.assigned_by
      LEFT JOIN global.users u3 ON u3.id = t.created_by
      WHERE t.id = $1::uuid AND t.deleted_at IS NULL
    `, id);
    if (!rows.length) return null;
    return mapTask(rows[0]);
  });
}

export async function findSubtasks(schemaName: string, parentId: string): Promise<Task[]> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT t.*,
             u1.first_name || ' ' || u1.last_name AS assignee_name, u1.email AS assignee_email,
             u2.first_name || ' ' || u2.last_name AS assigner_name
      FROM tasks t
      LEFT JOIN global.users u1 ON u1.id = t.assigned_to
      LEFT JOIN global.users u2 ON u2.id = t.assigned_by
      WHERE t.parent_task_id = $1::uuid AND t.deleted_at IS NULL
      ORDER BY t.created_at ASC
    `, parentId);
    return rows.map(mapTask);
  });
}

export async function createTask(schemaName: string, dto: CreateTaskDto, userId: string): Promise<string> {
  return withTenantSchema(schemaName, async (prisma) => {
    const [row] = await prisma.$queryRawUnsafe<any[]>(`
      INSERT INTO tasks(title,description,assigned_to,assigned_by,due_date,priority,entity_type,entity_id,framework_id,parent_task_id,estimated_hours,tags,is_recurring,recurrence_rule,created_by)
      VALUES($1,$2,$3::uuid,$4::uuid,$5::timestamptz,$6,$7,$8::uuid,$9::uuid,$10::uuid,$11,$12::text[],$13,$14,$15::uuid) RETURNING id
    `,
      dto.title, dto.description ?? null, dto.assignedTo ?? null, userId,
      dto.dueDate ?? null, dto.priority ?? 'medium',
      dto.entityType ?? null, dto.entityId ?? null, dto.frameworkId ?? null,
      dto.parentTaskId ?? null, dto.estimatedHours ?? null,
      dto.tags ?? [],
      dto.isRecurring ?? false, dto.recurrenceRule ?? null, userId,
    );
    return row.id as string;
  });
}

export async function updateTask(schemaName: string, id: string, dto: UpdateTaskDto): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    // completed_at: set NOW() when completing, clear when moving to any other
    // explicit status (e.g. reopening), otherwise leave untouched.
    const completedAt =
      dto.status === 'completed' ? 'NOW()'
        : dto.status !== undefined ? 'NULL'
          : 'completed_at';
    // assigned_to: use a presence flag ($9) so an explicit null un-assigns the
    // task, while an omitted field leaves the current assignee unchanged.
    await prisma.$executeRawUnsafe(`
      UPDATE tasks SET
        title           = COALESCE($2, title),
        description     = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE description END,
        assigned_to     = CASE WHEN $9::boolean THEN $4::uuid ELSE assigned_to END,
        due_date        = CASE WHEN $5::timestamptz IS NOT NULL THEN $5 ELSE due_date END,
        priority        = COALESCE($6, priority),
        status          = COALESCE($7, status),
        actual_hours    = CASE WHEN $8::numeric IS NOT NULL THEN $8 ELSE actual_hours END,
        completed_at    = ${completedAt},
        updated_at      = NOW()
      WHERE id = $1::uuid AND deleted_at IS NULL
    `, id, dto.title ?? null, dto.description ?? null, dto.assignedTo ?? null,
      dto.dueDate ?? null, dto.priority ?? null, dto.status ?? null, dto.actualHours ?? null,
      dto.assignedTo !== undefined,
    );
    if (dto.tags) {
      await prisma.$executeRawUnsafe(
        `UPDATE tasks SET tags = $2::text[] WHERE id = $1::uuid`,
        id, dto.tags,
      );
    }
  });
}

export async function softDeleteTask(schemaName: string, id: string): Promise<void> {
  return withTenantSchema(schemaName, async (prisma) => {
    await prisma.$executeRawUnsafe(`UPDATE tasks SET deleted_at=NOW() WHERE id=$1::uuid`, id);
  });
}

export async function getOverdueTasks(schemaName: string): Promise<Task[]> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT t.*, u1.first_name || ' ' || u1.last_name AS assignee_name, u1.email AS assignee_email,
             u2.first_name || ' ' || u2.last_name AS assigner_name
      FROM tasks t
      LEFT JOIN global.users u1 ON u1.id = t.assigned_to
      LEFT JOIN global.users u2 ON u2.id = t.assigned_by
      WHERE t.deleted_at IS NULL AND t.due_date < NOW()
        AND t.status NOT IN ('completed','cancelled')
      ORDER BY t.due_date ASC
    `);
    return rows.map(mapTask);
  });
}

// ── Comments ──────────────────────────────────────────────────

export async function findComments(schemaName: string, taskId: string): Promise<TaskComment[]> {
  return withTenantSchema(schemaName, async (prisma) => {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT tc.*, u.first_name || ' ' || u.last_name AS user_name, u.email AS user_email
      FROM task_comments tc
      JOIN global.users u ON u.id = tc.user_id
      WHERE tc.task_id = $1::uuid AND tc.deleted_at IS NULL
      ORDER BY tc.created_at ASC
    `, taskId);
    return rows.map(mapComment);
  });
}

export async function addComment(schemaName: string, taskId: string, userId: string, dto: AddCommentDto): Promise<string> {
  return withTenantSchema(schemaName, async (prisma) => {
    const [row] = await prisma.$queryRawUnsafe<any[]>(`
      INSERT INTO task_comments(task_id, user_id, body, is_internal)
      VALUES($1::uuid,$2::uuid,$3,$4) RETURNING id
    `, taskId, userId, dto.body, dto.isInternal ?? false);
    return row.id as string;
  });
}

export async function deleteComment(
  schemaName: string,
  taskId: string,
  commentId: string,
  userId: string,
  canModerate: boolean,
): Promise<boolean> {
  return withTenantSchema(schemaName, async (prisma) => {
    // Scope the delete to the task in the URL and to the comment author, unless
    // the actor has an elevated (moderator) role.
    const affected = await prisma.$executeRawUnsafe(
      `UPDATE task_comments SET deleted_at = NOW()
       WHERE id = $1::uuid AND task_id = $2::uuid AND deleted_at IS NULL
         AND ($4::boolean OR user_id = $3::uuid)`,
      commentId, taskId, userId, canModerate,
    );
    return affected === 1;
  });
}

export async function getTaskStatusCounts(schemaName: string): Promise<{
  total: number; todo: number; in_progress: number; in_review: number;
  completed: number; cancelled: number; overdue: number;
}> {
  return withTenantSchema(schemaName, async (prisma) => {
    const [row] = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END)::int AS todo,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END)::int AS in_progress,
        SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END)::int AS in_review,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::int AS completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int AS cancelled,
        SUM(CASE WHEN due_date < NOW() AND status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END)::int AS overdue
      FROM tasks WHERE deleted_at IS NULL
    `);
    return {
      total:       row.total ?? 0,
      todo:        row.todo ?? 0,
      in_progress: row.in_progress ?? 0,
      in_review:   row.in_review ?? 0,
      completed:   row.completed ?? 0,
      cancelled:   row.cancelled ?? 0,
      overdue:     row.overdue ?? 0,
    };
  });
}

// ── Mappers ───────────────────────────────────────────────────

function mapTask(r: any): Task {
  return {
    id: r.id, title: r.title, description: r.description,
    assignedTo: r.assigned_to, assigneeName: r.assignee_name ?? null,
    assigneeEmail: r.assignee_email ?? null, assignedBy: r.assigned_by,
    assignerName: r.assigner_name ?? null, dueDate: r.due_date,
    priority: r.priority, status: r.status, entityType: r.entity_type,
    entityId: r.entity_id, frameworkId: r.framework_id,
    parentTaskId: r.parent_task_id, estimatedHours: r.estimated_hours,
    actualHours: r.actual_hours, tags: r.tags ?? [], isRecurring: r.is_recurring,
    recurrenceRule: r.recurrence_rule, completedAt: r.completed_at,
    subtaskCount: r.subtask_count ?? 0,
    completedSubtasks: r.completed_subtask_count ?? 0,
    commentCount: r.comment_count ?? 0,
    createdBy: r.created_by, createdByName: r.creator_name ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapComment(r: any): TaskComment {
  return {
    id: r.id, taskId: r.task_id, userId: r.user_id, userName: r.user_name ?? null,
    userEmail: r.user_email ?? null, body: r.body, isInternal: r.is_internal,
    editedAt: r.edited_at, createdAt: r.created_at,
  };
}
