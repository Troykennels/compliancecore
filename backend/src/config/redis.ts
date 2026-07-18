import Redis from 'ioredis';
import { env } from './env';

// ── In-memory fallback (ENABLE_REDIS=false, local dev only) ──────────────────
// A minimal, TTL-aware stand-in for the tiny cache surface the app actually uses
// (setex/del/exists + connect/quit/on). Lets the API run with no Redis server.
// NOT for production: it is per-process and non-durable, so multi-instance rate
// limits, token revocation, and background queues do not work across instances.
class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  private live(key: string): boolean {
    const e = this.store.get(key);
    if (!e) return false;
    if (e.expiresAt !== null && e.expiresAt <= Date.now()) { this.store.delete(key); return false; }
    return true;
  }
  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    this.store.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    return 'OK';
  }
  async del(...keys: string[]): Promise<number> {
    let n = 0; for (const k of keys) { if (this.store.delete(k)) n++; } return n;
  }
  async exists(...keys: string[]): Promise<number> {
    return keys.reduce((n, k) => n + (this.live(k) ? 1 : 0), 0);
  }
  async connect(): Promise<void> { /* no-op */ }
  async quit(): Promise<'OK'> { this.store.clear(); return 'OK'; }
  on(): this { return this; }
}

const REDIS_ENABLED = env.ENABLE_REDIS;

// Shared cache client (real Redis, or the in-memory stub in dev).
export const redis: Redis = REDIS_ENABLED
  ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, enableReadyCheck: true, lazyConnect: true })
  : (new InMemoryRedis() as unknown as Redis);

// Dedicated BullMQ connection. When Redis is disabled the module-scope Queue
// objects in src/jobs still attach to this client, so it must exist — but we
// make it lazyConnect and stop reconnecting so a missing Redis doesn't spam.
export const redisForQueues = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: !REDIS_ENABLED,
  ...(REDIS_ENABLED ? {} : { retryStrategy: () => null }),
});

// An ioredis client with NO 'error' listener turns any connection error into an
// uncaught exception that crashes the process. Always attach one — even when
// Redis is disabled (BullMQ's queues will still try to connect this client).
redis.on('error', (err: Error) => {
  if (REDIS_ENABLED && process.env.NODE_ENV !== 'test') {
    console.error('[redis] connection error:', err.message);
  }
});
redisForQueues.on('error', (err: Error) => {
  if (REDIS_ENABLED && process.env.NODE_ENV !== 'test') {
    console.error('[redis:queues] connection error:', err.message);
  }
});

// Keys
export const REDIS_KEYS = {
  revokedToken: (jti: string) => `revoked_token:${jti}`,
  complianceScore: (tenantId: string, frameworkId: string) =>
    `compliance:score:${tenantId}:${frameworkId}`,
  dashboardSummary: (tenantId: string) => `dashboard:summary:${tenantId}`,
  mfaChallenge: (userId: string) => `mfa_challenge:${userId}`,
} as const;
