import Redis from 'ioredis';
import { env } from './env';

// Shared cache client
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

// Dedicated BullMQ connection (BullMQ requires exclusive control of its connection)
export const redisForQueues = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error('[redis] connection error:', err.message);
  }
});

// ioredis throws an unhandled 'error' event (crashing the process) if a client
// has no 'error' listener. redisForQueues (BullMQ) needs its own.
redisForQueues.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
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
