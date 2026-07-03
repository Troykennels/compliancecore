import jwt, { type SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { jwtPrivateKey, jwtPublicKey, env } from '../config/env';
import type { JwtPayload } from '../modules/auth/auth.types';

export function signAccessToken(payload: Omit<JwtPayload, 'jti' | 'iat' | 'exp'>): string {
  return jwt.sign({ ...payload, jti: uuidv4() }, jwtPrivateKey, {
    algorithm: 'RS256',
    // env value is a runtime-validated duration string (e.g. "15m"); @types/jsonwebtoken
    // requires the narrower ms.StringValue template-literal type for expiresIn.
    expiresIn: env.JWT_ACCESS_TOKEN_EXPIRY as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, jwtPublicKey, {
    algorithms: ['RS256'],
  }) as JwtPayload;
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
  return jwt.sign({ sub: userId, purpose: 'mfa_challenge' }, jwtPrivateKey, {
    algorithm: 'RS256',
    expiresIn: '5m',
  });
}

export function verifyMfaChallengeToken(token: string): { sub: string; purpose: string } {
  return jwt.verify(token, jwtPublicKey, { algorithms: ['RS256'] }) as {
    sub: string;
    purpose: string;
  };
}
