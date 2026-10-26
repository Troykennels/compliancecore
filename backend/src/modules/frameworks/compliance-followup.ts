import type { Prisma } from "@prisma/client";
import { notificationRepository } from "../notifications/notification.repository";
export async function complianceFollowup(
  tx: Prisma.TransactionClient,
  input: {
    kind: string;
    id: string;
    title: string;
    due: string;
    ownerId: string;
    actorId: string;
    url: string;
  },
) {
  const sourceKey = `compliance:${input.kind}:${input.id}`;
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO compliance_calendar_events(title,event_type,start_date,all_day,assigned_to,priority,linked_entity_type,linked_entity_id,reminder_days,source_key,created_by,updated_by)
 VALUES($1,'review',$2::date,true,$3::uuid,'medium',$4,$5::uuid,ARRAY[7,1],$6,$7::uuid,$7::uuid)
 ON CONFLICT(source_key) WHERE source_key IS NOT NULL DO UPDATE SET assigned_to=EXCLUDED.assigned_to,title=EXCLUDED.title,start_date=EXCLUDED.start_date,status='upcoming',deleted_at=NULL,updated_at=NOW() RETURNING id`,
    input.title,
    input.due,
    input.ownerId,
    input.kind,
    input.id,
    sourceKey,
    input.actorId,
  );
  // A stable reference and title make retries safe without a second notification engine.
  const existing = await tx.$queryRawUnsafe<unknown[]>(
    "SELECT 1 FROM notifications WHERE user_id=$1::uuid AND reference_type=$2 AND reference_id=$3::uuid AND title=$4 LIMIT 1",
    input.ownerId,
    input.kind,
    input.id,
    input.title,
  );
  if (!existing.length)
    await notificationRepository.create(tx, {
      userId: input.ownerId,
      title: input.title,
      body: `Review due ${input.due}. Open the source record to record the outcome.`,
      notificationType: "reminder",
      referenceType: input.kind,
      referenceId: input.id,
      actionUrl: input.url,
      priority: "medium",
    });
  return rows[0];
}
