import { withTenantSchema } from './prisma';
import { AppError } from './errors';
/** Prevent ownership, notification and approval targets crossing organisations. */
export async function assertActiveMembers(schema:string,ids:Array<string|null|undefined>):Promise<void>{
 const unique=[...new Set(ids.filter((id):id is string=>Boolean(id)))];if(!unique.length)return;
 await withTenantSchema(schema,async tx=>{const rows=await tx.$queryRawUnsafe<Array<{user_id:string}>>(`SELECT m.user_id FROM global.tenant_memberships m JOIN global.tenants t ON t.id=m.tenant_id JOIN global.users u ON u.id=m.user_id WHERE t.schema_name=$1 AND m.user_id=ANY($2::uuid[]) AND m.is_active AND m.deleted_at IS NULL AND u.is_active AND u.deleted_at IS NULL`,schema,unique);if(new Set(rows.map(r=>r.user_id)).size!==unique.length)throw new AppError('Choose active members of this organisation for ownership, assignment or review.',422,'INVALID_MEMBER');});
}
