import { withTenantSchema } from "../../lib/prisma";
import {
  canReadWorkspace,
  type RecordActor,
} from "./compliance-records.service";
import { ForbiddenError, AppError } from "../../lib/errors";
const allowed: Record<string, string[]> = {
  obligations: ["members", "controls", "evidence"],
  tests: ["controls", "evidence", "audits"],
  risks: ["risks", "controls", "frameworks"],
  acknowledgments: ["policies", "members"],
  vendors: ["vendors", "evidence"],
  actions: ["tasks", "sources", "evidence"],
  incidents: ["incidents", "obligations", "evidence"],
  training: ["records", "evidence"],
  audits: ["audits", "findings", "evidence", "controls", "tests"],
};
export async function complianceOptions(
  schema: string,
  kind: string,
  source: string,
  q: string,
  a: RecordActor,
) {
  if (!canReadWorkspace(kind, a)) throw new ForbiddenError();
  if(source==='audits'&&!canReadWorkspace('audits',a))throw new ForbiddenError();
  if (!allowed[kind]?.includes(source))
    throw new AppError("This picker is not available for this workflow.", 422);
  const selects: Record<string, string> = {
    tests:"SELECT t.id,c.control_ref||' ? '||t.result||' ? '||t.tested_at::date title FROM control_tests t JOIN controls c ON c.id=t.control_id WHERE c.deleted_at IS NULL",
    controls:
      "SELECT id,control_ref||' — '||title title FROM controls WHERE deleted_at IS NULL",
    evidence:
      "SELECT e.id,e.title FROM evidence e JOIN evidence_versions v ON v.id=e.current_version_id WHERE e.deleted_at IS NULL AND e.status='active' AND v.upload_status='completed' AND (e.retention_date IS NULL OR e.retention_date>NOW())",
    frameworks:
      "SELECT f.id,f.name title FROM framework_data.frameworks f JOIN framework_implementations p ON p.framework_id=f.id WHERE f.deleted_at IS NULL",
    risks: "SELECT id,title FROM risks WHERE deleted_at IS NULL",
    policies:
      "SELECT id,title FROM policies WHERE deleted_at IS NULL AND status='published'",
    vendors: "SELECT id,name title FROM vendors WHERE deleted_at IS NULL",
    tasks: "SELECT id,title FROM tasks WHERE deleted_at IS NULL",
    incidents: "SELECT id,title FROM incidents WHERE deleted_at IS NULL",
    obligations:
      "SELECT id,title FROM compliance_obligations WHERE status='active' AND applicability='applicable'",
    audits: "SELECT id,title FROM audits WHERE deleted_at IS NULL",
    findings:
      "SELECT f.id,a.title||' — '||f.title title FROM audit_findings f JOIN audits a ON a.id=f.audit_id WHERE a.deleted_at IS NULL",
    records:
      "SELECT r.id,p.title||' — '||COALESCE(NULLIF(concat_ws(' ',u.first_name,u.last_name),''),u.email) title FROM training_records r JOIN training_programs p ON p.id=r.program_id JOIN global.users u ON u.id=r.user_id WHERE p.deleted_at IS NULL",
    sources:
      "SELECT id,title,'finding' type FROM audit_findings UNION ALL SELECT id,title,'incident' type FROM incidents WHERE deleted_at IS NULL UNION ALL SELECT id,title,'control' type FROM controls WHERE deleted_at IS NULL",
  };
  return withTenantSchema(schema, (tx) =>
    source === "members"
      ? tx.$queryRawUnsafe(
          "SELECT u.id,COALESCE(NULLIF(concat_ws(' ',u.first_name,u.last_name),''),u.email) title FROM global.users u JOIN global.tenant_memberships m ON m.user_id=u.id WHERE m.tenant_id=$2::uuid AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL AND concat_ws(' ',u.first_name,u.last_name,u.email) ILIKE $1 ORDER BY title LIMIT 50",
          "%" + q.slice(0, 120) + "%",
          a.tenantId,
        )
      : tx.$queryRawUnsafe(
          "SELECT * FROM (" +
            selects[source] +
            ") choices WHERE title ILIKE $1 ORDER BY title,id LIMIT 50",
          "%" + q.slice(0, 120) + "%",
        ),
  );
}
