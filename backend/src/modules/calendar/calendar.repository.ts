import { Prisma } from '@prisma/client';
import type { CalendarEvent, CalendarEventListResult } from './calendar.types';
import type { CreateCalendarEventInput, UpdateCalendarEventInput, ListCalendarEventsInput } from './calendar.schema';

type Tx = Prisma.TransactionClient;

function mapRow(row: Record<string, unknown>): CalendarEvent {
  return {
    id:               row.id as string,
    title:            row.title as string,
    description:      row.description as string | null,
    eventType:        row.eventType as CalendarEvent['eventType'],
    status:           row.status as CalendarEvent['status'],
    startDate:        new Date(row.startDate as string),
    endDate:          row.endDate ? new Date(row.endDate as string) : null,
    allDay:           Boolean(row.allDay),
    isRecurring:      Boolean(row.isRecurring),
    recurrenceRule:   row.recurrenceRule as string | null,
    frameworkId:      row.frameworkId as string | null,
    linkedEntityType: row.linkedEntityType as string | null,
    linkedEntityId:   row.linkedEntityId as string | null,
    assignedTo:       row.assignedTo as string | null,
    assigneeName:     row.assigneeName as string | null,
    assigneeEmail:    row.assigneeEmail as string | null,
    priority:         row.priority as CalendarEvent['priority'],
    color:            row.color as string,
    reminderDays:     (row.reminderDays as number[]) ?? [],
    createdBy:        row.createdBy as string | null,
    createdAt:        new Date(row.createdAt as string),
    updatedAt:        new Date(row.updatedAt as string),
  };
}

export const calendarRepository = {
  async findAll(tx: Tx, filters: ListCalendarEventsInput): Promise<CalendarEventListResult> {
    const conditions: string[] = ['e.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.from) { conditions.push(`e.start_date >= $${idx++}::timestamptz`); params.push(filters.from); }
    if (filters.to)   { conditions.push(`e.start_date <= $${idx++}::timestamptz`); params.push(filters.to); }
    if (filters.eventType)  { conditions.push(`e.event_type = $${idx++}`); params.push(filters.eventType); }
    if (filters.status)     { conditions.push(`e.status = $${idx++}`); params.push(filters.status); }
    if (filters.assignedTo) { conditions.push(`e.assigned_to = $${idx++}::uuid`); params.push(filters.assignedTo); }
    if (filters.frameworkId){ conditions.push(`e.framework_id = $${idx++}::uuid`); params.push(filters.frameworkId); }
    if (filters.priority)   { conditions.push(`e.priority = $${idx++}`); params.push(filters.priority); }

    const where = conditions.join(' AND ');

    const [rows, countRows] = await Promise.all([
      tx.$queryRawUnsafe<Record<string, unknown>[]>(`
        SELECT
          e.id, e.title, e.description, e.event_type AS "eventType", e.status,
          e.start_date AS "startDate", e.end_date AS "endDate",
          e.all_day AS "allDay", e.is_recurring AS "isRecurring",
          e.recurrence_rule AS "recurrenceRule", e.framework_id AS "frameworkId",
          e.linked_entity_type AS "linkedEntityType", e.linked_entity_id AS "linkedEntityId",
          e.assigned_to AS "assignedTo",
          u.first_name || ' ' || u.last_name AS "assigneeName",
          u.email AS "assigneeEmail",
          e.priority, e.color, e.reminder_days AS "reminderDays",
          e.created_by AS "createdBy", e.created_at AS "createdAt", e.updated_at AS "updatedAt"
        FROM compliance_calendar_events e
        LEFT JOIN global.users u ON u.id = e.assigned_to
        WHERE ${where}
        ORDER BY e.start_date ASC
      `, ...params),
      tx.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) FROM compliance_calendar_events e WHERE ${where}`, ...params,
      ),
    ]);

    return { events: rows.map(mapRow), total: Number(countRows[0].count) };
  },

  async findById(tx: Tx, id: string): Promise<CalendarEvent | null> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        e.id, e.title, e.description, e.event_type AS "eventType", e.status,
        e.start_date AS "startDate", e.end_date AS "endDate",
        e.all_day AS "allDay", e.is_recurring AS "isRecurring",
        e.recurrence_rule AS "recurrenceRule", e.framework_id AS "frameworkId",
        e.linked_entity_type AS "linkedEntityType", e.linked_entity_id AS "linkedEntityId",
        e.assigned_to AS "assignedTo",
        u.first_name || ' ' || u.last_name AS "assigneeName",
        u.email AS "assigneeEmail",
        e.priority, e.color, e.reminder_days AS "reminderDays",
        e.created_by AS "createdBy", e.created_at AS "createdAt", e.updated_at AS "updatedAt"
      FROM compliance_calendar_events e
      LEFT JOIN global.users u ON u.id = e.assigned_to
      WHERE e.id = ${id}::uuid AND e.deleted_at IS NULL
    `;
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async create(tx: Tx, input: CreateCalendarEventInput & { createdBy: string }): Promise<{ id: string }> {
    const rows = await tx.$queryRaw<[{ id: string }]>`
      INSERT INTO compliance_calendar_events (
        title, description, event_type, start_date, end_date, all_day,
        is_recurring, recurrence_rule, framework_id, linked_entity_type, linked_entity_id,
        assigned_to, priority, color, reminder_days, created_by, updated_by
      ) VALUES (
        ${input.title}, ${input.description ?? null}, ${input.eventType},
        ${input.startDate}::timestamptz, ${input.endDate ?? null}::timestamptz,
        ${input.allDay ?? false}, ${input.isRecurring ?? false},
        ${input.recurrenceRule ?? null},
        ${input.frameworkId ?? null}::uuid,
        ${input.linkedEntityType ?? null},
        ${input.linkedEntityId ?? null}::uuid,
        ${input.assignedTo ?? null}::uuid,
        ${input.priority}, ${input.color ?? '#3B82F6'},
        ${input.reminderDays ?? [7, 1]},
        ${input.createdBy}::uuid, ${input.createdBy}::uuid
      )
      RETURNING id
    `;
    return rows[0];
  },

  async update(tx: Tx, id: string, input: UpdateCalendarEventInput & { updatedBy: string }): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE compliance_calendar_events SET
        title             = COALESCE(${input.title ?? null}, title),
        description       = CASE WHEN ${input.description !== undefined} THEN ${input.description ?? null} ELSE description END,
        event_type        = COALESCE(${input.eventType ?? null}, event_type),
        status            = COALESCE(${input.status ?? null}, status),
        start_date        = COALESCE(${input.startDate ?? null}::timestamptz, start_date),
        end_date          = CASE WHEN ${input.endDate !== undefined} THEN ${input.endDate ?? null}::timestamptz ELSE end_date END,
        all_day           = COALESCE(${input.allDay ?? null}, all_day),
        is_recurring      = COALESCE(${input.isRecurring ?? null}, is_recurring),
        recurrence_rule   = CASE WHEN ${input.recurrenceRule !== undefined} THEN ${input.recurrenceRule ?? null} ELSE recurrence_rule END,
        framework_id      = CASE WHEN ${input.frameworkId !== undefined} THEN ${input.frameworkId ?? null}::uuid ELSE framework_id END,
        linked_entity_type= CASE WHEN ${input.linkedEntityType !== undefined} THEN ${input.linkedEntityType ?? null} ELSE linked_entity_type END,
        linked_entity_id  = CASE WHEN ${input.linkedEntityId !== undefined} THEN ${input.linkedEntityId ?? null}::uuid ELSE linked_entity_id END,
        assigned_to       = CASE WHEN ${input.assignedTo !== undefined} THEN ${input.assignedTo ?? null}::uuid ELSE assigned_to END,
        priority          = COALESCE(${input.priority ?? null}, priority),
        color             = COALESCE(${input.color ?? null}, color),
        reminder_days     = COALESCE(${input.reminderDays ?? null}, reminder_days),
        updated_by        = ${input.updatedBy}::uuid,
        updated_at        = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  async softDelete(tx: Tx, id: string, deletedBy: string): Promise<boolean> {
    const result = await tx.$executeRaw`
      UPDATE compliance_calendar_events
      SET deleted_at = NOW(), updated_by = ${deletedBy}::uuid
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return result > 0;
  },

  // Returns events starting in the next N days — used by dashboard and reminder job
  async findUpcoming(tx: Tx, daysAhead: number): Promise<CalendarEvent[]> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        e.id, e.title, e.description, e.event_type AS "eventType", e.status,
        e.start_date AS "startDate", e.end_date AS "endDate",
        e.all_day AS "allDay", e.is_recurring AS "isRecurring",
        e.recurrence_rule AS "recurrenceRule", e.framework_id AS "frameworkId",
        e.linked_entity_type AS "linkedEntityType", e.linked_entity_id AS "linkedEntityId",
        e.assigned_to AS "assignedTo",
        u.first_name || ' ' || u.last_name AS "assigneeName",
        u.email AS "assigneeEmail",
        e.priority, e.color, e.reminder_days AS "reminderDays",
        e.created_by AS "createdBy", e.created_at AS "createdAt", e.updated_at AS "updatedAt"
      FROM compliance_calendar_events e
      LEFT JOIN global.users u ON u.id = e.assigned_to
      WHERE e.deleted_at IS NULL
        AND e.start_date >= NOW()
        AND e.start_date <= NOW() + (${daysAhead} || ' days')::interval
        AND e.status NOT IN ('completed', 'cancelled')
      ORDER BY e.start_date ASC
    `;
    return rows.map(mapRow);
  },

  // Mark past-due events as overdue — called by daily job
  async markOverdue(tx: Tx): Promise<number> {
    const result = await tx.$executeRaw`
      UPDATE compliance_calendar_events
      SET status = 'overdue', updated_at = NOW()
      WHERE deleted_at IS NULL
        AND status = 'upcoming'
        AND start_date < NOW()
    `;
    return result;
  },

  // Events needing reminders within the next N days
  async findForReminder(tx: Tx, daysAhead: number): Promise<(CalendarEvent & { ownerEmail: string | null })[]> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT
        e.id, e.title, e.description, e.event_type AS "eventType", e.status,
        e.start_date AS "startDate", e.end_date AS "endDate",
        e.all_day AS "allDay", e.is_recurring AS "isRecurring",
        e.recurrence_rule AS "recurrenceRule", e.framework_id AS "frameworkId",
        e.linked_entity_type AS "linkedEntityType", e.linked_entity_id AS "linkedEntityId",
        e.assigned_to AS "assignedTo",
        u.first_name || ' ' || u.last_name AS "assigneeName",
        u.email AS "assigneeEmail",
        u.email AS "ownerEmail",
        e.priority, e.color, e.reminder_days AS "reminderDays",
        e.created_by AS "createdBy", e.created_at AS "createdAt", e.updated_at AS "updatedAt"
      FROM compliance_calendar_events e
      LEFT JOIN global.users u ON u.id = e.assigned_to
      WHERE e.deleted_at IS NULL
        AND e.status NOT IN ('completed', 'cancelled', 'overdue')
        AND e.start_date BETWEEN NOW() AND NOW() + (${daysAhead} || ' days')::interval
    `;
    return rows.map((r) => ({ ...mapRow(r), ownerEmail: r.ownerEmail as string | null }));
  },
};
