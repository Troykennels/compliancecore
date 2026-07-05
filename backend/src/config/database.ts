// Single canonical Prisma client.
//
// This module previously constructed a SECOND PrismaClient (separate from
// lib/prisma.ts). That doubled the Postgres connection pool (~2× connections,
// a real exhaustion risk) and, worse, meant server.ts ran $connect() and the
// readiness probe against a client that served no tenant traffic. All modules
// now share the one client defined in lib/prisma.ts (which also owns
// withTenantSchema and structured query/error logging).
export { prisma } from '../lib/prisma';
