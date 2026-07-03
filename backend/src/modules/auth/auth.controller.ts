import type { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import * as service from './auth.service';

const REFRESH_COOKIE = 'cc_refresh_token';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
};

function setRefreshCookie(res: Response, rawToken: string, expiresAt?: Date): void {
  res.cookie(REFRESH_COOKIE, rawToken, {
    ...cookieOptions,
    expires: expiresAt ?? new Date(Date.now() + env.JWT_REFRESH_TOKEN_EXPIRY_DAYS * 86400000),
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}

function ok(res: Response, req: Request, data: unknown, statusCode = 200): void {
  res.status(statusCode).json({ data, error: null, meta: { requestId: req.requestId } });
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.register(req.body);
    ok(res, req, result, 201);
  } catch (err) {
    next(err);
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? null;
    const userAgent = req.headers['user-agent'] ?? null;

    const result = await service.login(req.body, ipAddress, userAgent);

    if (result.requiresMfa) {
      ok(res, req, {
        requiresMfa: true,
        mfaChallengeToken: result.mfaChallengeToken,
        user: { email: result.user.email },
      });
      return;
    }

    const raw = (result as typeof result & { _rawRefreshToken: string })._rawRefreshToken;
    setRefreshCookie(res, raw);

    ok(res, req, {
      accessToken: result.accessToken,
      user: result.user,
      activeTenant: result.activeTenant,
      allTenants: result.allTenants,
      requiresMfa: false,
    });
  } catch (err) {
    next(err);
  }
}

// ─── MFA Challenge ────────────────────────────────────────────────────────────

export async function completeMfaChallenge(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { mfaChallengeToken, code } = req.body;
    const ipAddress = req.ip ?? null;
    const userAgent = req.headers['user-agent'] ?? null;

    const result = await service.completeMfaChallenge(mfaChallengeToken, code, ipAddress, userAgent);
    const raw = (result as typeof result & { _rawRefreshToken: string })._rawRefreshToken;
    setRefreshCookie(res, raw);

    ok(res, req, {
      accessToken: result.accessToken,
      user: result.user,
      activeTenant: result.activeTenant,
      allTenants: result.allTenants,
    });
  } catch (err) {
    next(err);
  }
}

export async function completeMfaWithBackupCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { mfaChallengeToken, backupCode } = req.body;
    const ipAddress = req.ip ?? null;
    const userAgent = req.headers['user-agent'] ?? null;

    const result = await service.completeMfaWithBackupCode(
      mfaChallengeToken,
      backupCode,
      ipAddress,
      userAgent,
    );
    const raw = (result as typeof result & { _rawRefreshToken: string })._rawRefreshToken;
    setRefreshCookie(res, raw);

    ok(res, req, {
      accessToken: result.accessToken,
      user: result.user,
      activeTenant: result.activeTenant,
      allTenants: result.allTenants,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Email Verification ───────────────────────────────────────────────────────

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.query as { token: string };
    const result = await service.verifyEmail(token);
    ok(res, req, result);
  } catch (err) {
    next(err);
  }
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken = req.cookies[REFRESH_COOKIE];
    if (!rawToken) {
      res.status(401).json({
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'No refresh token provided' },
        meta: { requestId: req.requestId },
      });
      return;
    }

    const { accessToken, rawRefreshToken } = await service.refreshAccessToken(rawToken);
    setRefreshCookie(res, rawRefreshToken);
    ok(res, req, { accessToken });
  } catch (err) {
    clearRefreshCookie(res);
    next(err);
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken = req.cookies[REFRESH_COOKIE];
    if (rawToken) {
      await service.logout(rawToken, req.user.jti, 0); // exp=0 means "use token's own exp"
    }
    clearRefreshCookie(res);
    ok(res, req, { message: 'Logged out successfully' });
  } catch (err) {
    clearRefreshCookie(res);
    next(err);
  }
}

export async function logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.logoutAllSessions(req.user.id, req.user.jti, 0);
    clearRefreshCookie(res);
    ok(res, req, { message: 'All sessions terminated' });
  } catch (err) {
    next(err);
  }
}

// ─── Forgot / Reset Password ─────────────────────────────────────────────────

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.forgotPassword(req.body.email);
    ok(res, req, result);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.resetPassword(req.body);
    ok(res, req, result);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.changePassword(req.user.id, req.body);
    ok(res, req, result);
  } catch (err) {
    next(err);
  }
}

// ─── MFA Management ───────────────────────────────────────────────────────────

export async function setupMfa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.setupMfa(req.user.id);
    ok(res, req, result);
  } catch (err) {
    next(err);
  }
}

export async function confirmMfaSetup(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.confirmMfaSetup(req.user.id, req.body.code);
    ok(res, req, result);
  } catch (err) {
    next(err);
  }
}

export async function disableMfa(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.disableMfa(req.user.id, req.body.password);
    ok(res, req, result);
  } catch (err) {
    next(err);
  }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Current session ID is attached by auth middleware via the JWT sub + sessionId
    const sessions = await service.getActiveSessions(req.user.id, '');
    ok(res, req, sessions);
  } catch (err) {
    next(err);
  }
}

export async function revokeSessionById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await service.revokeSession(req.user.id, req.params.sessionId);
    ok(res, req, result);
  } catch (err) {
    next(err);
  }
}

// ─── Current User ─────────────────────────────────────────────────────────────

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { findUserById, findUserMemberships } = await import('./auth.repository');
    const user = await findUserById(req.user.id);
    if (!user) {
      res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'User not found' }, meta: {} });
      return;
    }
    const memberships = await findUserMemberships(user.id);
    ok(res, req, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt,
      isActive: user.isActive,
      onboardingCompletedAt: user.onboardingCompletedAt,
      tenants: memberships.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role,
      })),
    });
  } catch (err) {
    next(err);
  }
}
