import { withTenantSchema } from "../../lib/prisma";
import {
  canReadWorkspace,
  type RecordActor,
} from "./compliance-records.service";
export const attentionConditions = {
  obligations:
    "status<>'superseded' AND (status<>'active' OR review_date<CURRENT_DATE)",
  tests: "t.status='submitted'",
  actions:
    "status='in_review' AND corrective_action->>'state'='awaiting_verification'",
};
export async function complianceSummary(schema: string, actor: RecordActor) {
  return withTenantSchema(schema, async (tx) => {
    const definitions = [
      {
        kind: "obligations",
        title: "Duties needing review",
        help: "Draft, undecided or due for another review.",
        href: "/frameworks?workflow=obligations&attention=review",
        sql:
          "SELECT count(*)::int n FROM compliance_obligations WHERE " +
          attentionConditions.obligations,
      },
      {
        kind: "tests",
        title: "Safeguard tests awaiting review",
        help: "Submitted tests need an independent decision.",
        href: "/controls?workflow=tests&attention=review",
        sql:
          "SELECT count(*)::int n FROM control_tests t JOIN controls c ON c.id=t.control_id WHERE c.deleted_at IS NULL AND " +
          attentionConditions.tests,
      },
      {
        kind: "actions",
        title: "Actions awaiting effectiveness checks",
        help: "Verify the correction before closing the task.",
        href: "/tasks?workflow=actions&attention=review",
        sql:
          "SELECT count(*)::int n FROM tasks WHERE deleted_at IS NULL AND " +
          attentionConditions.actions,
      },
      {
        kind: "acknowledgments",
        title: "Policies waiting for readers",
        help: "Current published versions with unread assignments.",
        href: "/policies?workflow=acknowledgments&attention=review",
        sql:
          "SELECT count(*)::int n FROM policy_acknowledgments a JOIN policies p ON p.id=a.policy_id JOIN policy_versions v ON v.id=a.policy_version_id WHERE p.deleted_at IS NULL AND p.status='published' AND p.current_version=v.version_number AND a.acknowledged_at IS NULL" +
          (["owner", "admin", "compliance_manager", "msp_admin"].includes(
            actor.role ?? "",
          )
            ? ""
            : " AND a.user_id=$1::uuid"),
      },
    ];
    const cards = [];
    for (const d of definitions) {
      if (!canReadWorkspace(d.kind, actor)) continue;
      const rows = await tx.$queryRawUnsafe<Array<{ n: number }>>(
        d.sql,
        ...(d.kind === "acknowledgments" &&
        !["owner", "admin", "compliance_manager", "msp_admin"].includes(
          actor.role ?? "",
        )
          ? [actor.id]
          : []),
      );
      const { sql, ...card } = d;
      cards.push({ ...card, count: rows[0].n });
    }
    return cards;
  });
}
