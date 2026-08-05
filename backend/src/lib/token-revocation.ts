import { redis, REDIS_KEYS } from '../config/redis';
import { logger } from './logger';

/**
 * Invalidating access tokens that are not in your hand.
 *
 * Access tokens are stateless JWTs, and the only revocation the app had was a
 * per-jti blacklist — which can only ever revoke the token the caller is
 * currently presenting. So:
 *
 *   - removing a team member left their session working until it expired;
 *   - demoting an admin left them holding admin permissions in their token;
 *   - changing your password after a compromise revoked nothing on the
 *     attacker's other sessions;
 *   - "log out everywhere" logged out exactly one device — your own.
 *
 * A per-user cut-off fixes all four with one mechanism: record the moment
 * everything before it stopped counting, and have authenticate() refuse any
 * token issued earlier.
 *
 * The window is bounded by the access-token lifetime, so the marker only needs
 * to outlive the longest token that could still be in circulation. An hour is
 * comfortably beyond the 15-minute default and costs one small key per event.
 */
const MARKER_TTL_SECONDS = 60 * 60;

/**
 * Refuses every access token this user holds right now.
 *
 * Never throws: this is called from the middle of security actions — removing a
 * member, changing a password — that must complete even if Redis is briefly
 * unavailable. A failure here is logged loudly, because it means the old tokens
 * survive until they expire.
 */
export async function revokeUserTokens(userId: string, reason: string): Promise<void> {
  try {
    // Stored in whole seconds to compare directly against the JWT `iat` claim.
    // Rounded UP so a token minted in the same second as the revocation is also
    // refused, rather than surviving on a sub-second tie.
    const cutoff = Math.ceil(Date.now() / 1000);
    await redis.setex(REDIS_KEYS.userTokensRevokedBefore(userId), MARKER_TTL_SECONDS, String(cutoff));
    logger.info({ userId, reason, cutoff }, 'Access tokens revoked for user');
  } catch (err) {
    logger.error({ err, userId, reason }, 'Could not revoke access tokens — old sessions stay valid until expiry');
  }
}

/**
 * True when this token predates the user's cut-off and must be rejected.
 *
 * Fails OPEN on a Redis error, deliberately: an outage in the cache must not
 * lock every customer out of a compliance system. The trade is a short window
 * where a revoked token still works, against the whole product being
 * unavailable.
 */
export async function isTokenRevoked(userId: string, issuedAt: number | undefined): Promise<boolean> {
  if (!userId || issuedAt === undefined) return false;
  try {
    const raw = await redis.get(REDIS_KEYS.userTokensRevokedBefore(userId));
    if (!raw) return false;
    return issuedAt < Number(raw);
  } catch (err) {
    logger.error({ err, userId }, 'Token revocation check failed — allowing request');
    return false;
  }
}
