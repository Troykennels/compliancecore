import jwt, { type SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { jwtPrivateKey, jwtPublicKey, env } from '../config/env';
import type { JwtPayload } from '../modules/auth/auth.types';

// Every token this service issues is signed with the same key, so the signature
// alone says nothing about what a token is FOR. Without a purpose claim the
// short-lived MFA challenge token — handed out after a correct password but
// BEFORE the second factor — verified as a perfectly good access token, and
// since `authenticate()` reads `payload.sub`, it authenticated as the user.
// Password alone was therefore enough to reach the API and to mint a full
// per-tenant token via switch-tenant, with the second factor never presented.
//
// The purpose is now explicit on both sides: an access token must say it is
// one, and a challenge token must say it is one.
const ACCESS_TOKEN_PURPOSE = 'access';
const MFA_CHALLENGE_PURPOSE = 'mfa_challenge';

export function signAccessToken(payload: Omit<JwtPayload, 'jti' | 'iat' | 'exp'>): string {
  return jwt.sign({ ...payload, purpose: ACCESS_TOKEN_PURPOSE, jti: uuidv4() }, jwtPrivateKey, {
    algorithm: 'RS256',
    // env value is a runtime-validated duration string (e.g. "15m"); @types/jsonwebtoken
    // requires the narrower ms.StringValue template-literal type for expiresIn.
    expiresIn: env.JWT_ACCESS_TOKEN_EXPIRY as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  const payload = jwt.verify(token, jwtPublicKey, {
    algorithms: ['RS256'],
  }) as JwtPayload & { purpose?: string };

  // Reject anything minted for another purpose. Access tokens issued before
  // this claim existed carry no `purpose` at all and are still accepted, so a
  // deploy does not sign every active user out mid-session; only a token
  // explicitly stamped for something else is refused.
  if (payload.purpose !== undefined && payload.purpose !== ACCESS_TOKEN_PURPOSE) {
    throw new jwt.JsonWebTokenError(`token is not an access token (purpose: ${payload.purpose})`);
  }

  return payload;
}

export function decodeAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload | null;
  } catch {
    return null;
  }
}

// Short-lived token used exclusively to carry the user through the MFA challenge step.
// It has no permissions and cannot be used for any authenticated endpoint.
export function signMfaChallengeToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: MFA_CHALLENGE_PURPOSE }, jwtPrivateKey, {
    algorithm: 'RS256',
    expiresIn: '5m',
  });
}

export function verifyMfaChallengeToken(token: string): { sub: string; purpose: string } {
  const payload = jwt.verify(token, jwtPublicKey, { algorithms: ['RS256'] }) as {
    sub: string;
    purpose?: string;
  };

  // The mirror of the check in verifyAccessToken: a full access token must not
  // be usable to answer an MFA challenge either. One caller enforced this and
  // its sibling did not, which is the same missing-claim bug in the other
  // direction.
  if (payload.purpose !== MFA_CHALLENGE_PURPOSE) {
    throw new jwt.JsonWebTokenError('token is not an MFA challenge token');
  }

  return payload as { sub: string; purpose: string };
}
