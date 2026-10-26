import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from './logger';
import { auditRequestContext } from './audit-context';

// Singleton Prisma client. The globalThis guard prevents `tsx watch` hot
// reloads from opening a fresh connection pool on every code change in dev.
// The factory return type preserves the event-emitter ($on) typing from `log`.
const makePrismaClient = () =>
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn',  emit: 'event' },
    ],
  });

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof makePrismaClient> };

const prisma = globalForPrisma.prisma ?? makePrismaClient();

// Stamp global writes as well as tenant transactions. A fresh transaction is
// necessary: session SET outside a transaction can stamp another pooled request.
prisma.$use(async(params,next)=>{
  const actor=auditRequestContext.getStore()?.actor();
  const writes=['create','createMany','update','updateMany','upsert','delete','deleteMany'];
  if(!actor||params.runInTransaction||!params.model||!writes.includes(params.action))return next(params);
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT set_config('app.current_user_id',${actor.id},true),set_config('app.current_user_role',${actor.role??'system'},true)`;
    const key=params.model![0].toLowerCase()+params.model!.slice(1);const delegate=(tx as unknown as Record<string,Record<string,(args:unknown)=>Promise<unknown>>>)[key];return delegate[params.action](params.args);
  });
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

prisma.$on('error', (e) => {
  logger.error({ err: e }, 'Prisma error');
});

prisma.$on('warn', (e) => {
  logger.warn({ message: e.message }, 'Prisma warning');
});

if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug({ query: e.query, duration: e.duration }, 'Prisma query');
  });
}

export { prisma };

// =============================================================================
// withTenantSchema
//
// All tenant-scoped data (branches, departments, controls, etc.) lives in a
// dynamically named PostgreSQL schema: tenant_{uuid_without_dashes}.
//
// Prisma's multiSchema preview only supports schemas declared statically in
// schema.prisma. Tenant schemas are accessed via raw SQL inside a transaction
// that sets the search_path for that transaction only.
//
// Using SET LOCAL keeps the change scoped to the current transaction, which
// is safe with PgBouncer in transaction pool mode.
//
// The schemaName argument must be the exact schema name from global.tenants.schema_name.
// =============================================================================

const SAFE_SCHEMA_RE = /^tenant_[a-f0-9]{32}$/;

function assertSafeSchemaName(name: string): void {
  if (!SAFE_SCHEMA_RE.test(name)) {
    throw new Error(`Invalid tenant schema name: "${name}". Must match tenant_{32 hex chars}.`);
  }
}

export async function withTenantSchema<T>(
  schemaName: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  assertSafeSchemaName(schemaName);

  return prisma.$transaction(async (tx) => {
    // Prisma.raw() interpolates identifiers without quoting, which is correct
    // here because we have already validated the schema name above.
    await tx.$executeRaw`SET LOCAL search_path = ${Prisma.raw(schemaName)}, framework_data, global, public`;
    const actor=auditRequestContext.getStore()?.actor();
    if(actor) await tx.$queryRaw`SELECT set_config('app.current_user_id',${actor.id},true), set_config('app.current_user_role',${actor.role??'system'},true)`;
    return fn(tx);
  }, options);
}

// Derives the schema name from a tenant UUID (strips hyphens).
export function tenantSchemaName(tenantId: string): string {
  const name = `tenant_${tenantId.replace(/-/g, '')}`;
  assertSafeSchemaName(name);
  return name;
}
