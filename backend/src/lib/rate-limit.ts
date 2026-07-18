import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../config/redis';
import { env } from '../config/env';

// Shared rate-limiter factory backed by Redis.
//
// Previously every limiter used express-rate-limit's default in-memory store,
// which resets on each deploy and is per-process — so the effective cap
// silently multiplied by (instances × restarts) the moment the app scaled past
// one replica. A Redis-backed store makes limits consistent across instances
// and durable across restarts.
export function makeRateLimiter(
  opts: Pick<Options, 'windowMs' | 'max'> & Partial<Options>,
) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    // When Redis is disabled (local dev), fall back to the default in-process
    // MemoryStore so auth routes still rate-limit without a Redis server.
    ...(env.ENABLE_REDIS && {
      store: new RedisStore({
        // ioredis: `call(command, ...args)` issues a raw command. rate-limit-redis
        // handles the atomic INCR/PEXPIRE script internally.
        sendCommand: (command: string, ...args: string[]) =>
          redis.call(command, ...args) as Promise<never>,
        prefix: 'rl:',
      }),
    }),
    ...opts,
  });
}
