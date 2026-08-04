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
// The platform edge APPENDS the peer it sees to X-Forwarded-For, so the entry
// to trust is the RIGHTMOST one — the only entry written by our own proxy.
//
// This previously took the leftmost, which the caller controls completely. A
// request carrying `X-Forwarded-For: 1.2.3.4` arrives at the app as
// "1.2.3.4, <real client>", so reading the left gave the attacker a fresh
// bucket per request just by varying the header. That made the limits on login,
// MFA challenge, registration and password reset decorative: unlimited password
// guessing, and an unthrottled oracle against a 6-digit TOTP code.
//
// Forging cannot beat the rightmost entry, because anything the client sends is
// pushed left when the edge appends. A legitimate client sends no header at
// all, so for them the two are identical and nothing changes.
function clientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff.join(',') : xff;
  const entries = raw?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const candidate = entries[entries.length - 1];
  // Fall back to req.ip (and finally a constant) so a missing header degrades
  // gracefully rather than throwing.
  return candidate || req.ip || 'unknown';
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
