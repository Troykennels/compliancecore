import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request } from 'express';
import { redis } from '../config/redis';
import { env } from '../config/env';

// Resolves the end user's IP for rate-limit bucketing.
//
// express-rate-limit keys on req.ip by default, which Express derives from the
// `trust proxy` setting. On Railway that produced a SINGLE key for the entire
// internet — Redis held exactly one bucket, `rl:79.127.178.81`, counting every
// user's attempts together. The effect was a self-inflicted denial of service:
// three signups per hour across all customers, and five failed logins locking
// out everyone, because one person fumbling a password consumed the global
// allowance.
//
// Resolves the end user's IP for rate-limit bucketing.
//
// `req.ip` is the right answer, and the only one that adapts to the deployment:
// app.ts sets `trust proxy` to the number of proxies in front of us, and
// Express then walks X-Forwarded-For inward by exactly that many hops. It is
// neither forgeable (anything the client injects is left of the trusted hops)
// nor topology-dependent.
//
// Reading the header by hand went wrong in both directions. Taking the LEFTMOST
// entry trusted whatever the caller sent, so an attacker got a fresh bucket per
// request just by varying the header — unlimited password guessing. Taking the
// RIGHTMOST, which I changed it to, assumed a single proxy hop; with two, the
// rightmost entry is the platform's own internal address, identical for every
// visitor. That collapses the whole internet into one bucket, and the first
// symptom is real users being told "too many registration attempts" because
// three other people signed up that hour.
//
// The header is consulted only as a fallback for the case where req.ip is
// somehow unavailable, and then from the left, since without trust-proxy
// context there is no better guess.
function clientIp(req: Request): string {
  if (req.ip) return req.ip;

  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  return raw?.split(',')[0]?.trim() || 'unknown';
}

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
    keyGenerator: clientIp,
    // req.ip is unreliable behind this proxy chain (see clientIp), and the
    // built-in check only inspects req.ip — it would flag a correct setup here
    // and log on every request.
    // express-rate-limit's own warning assumes you have not configured
    // `trust proxy`. app.ts does, so the check would fire on every request
    // against a correct setup.
    validate: { trustProxy: false, xForwardedForHeader: false },
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
