import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { env } from '../../config/env';
import { redis, REDIS_KEYS } from '../../config/redis';
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  generateRefreshToken,
  generateBackupCodes,
  encrypt,
  decrypt,
  sha256,
} from '../../lib/crypto';
import {
  signAccessToken,
  signMfaChallengeToken,
  verifyMfaChallengeToken,
} from '../../lib/jwt';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendMfaBackupCodesEmail,
  sendWelcomeEmail,
} from '../../lib/email';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from '../../lib/errors';
import { getPermissionsForRole } from '../../middleware/rbac.middleware';
import { logger } from '../../lib/logger';
import * as repo from './auth.repository';
import type { LoginResult, MfaSetupResult, SessionInfo, UserPublic } from './auth.types';
import type { RegisterInput, LoginInput, ResetPasswordInput, ChangePasswordInput } from './auth.schema';

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(input: RegisterInput): Promise<{ message: string }> {
  const existing = await repo.findUserByEmail(input.email);
  if (existing) {
    // Respond with the same message regardless to avoid email enumeration
    return { message: 'If this email is not registered, you will receive a verification link.' };
  }

  const passwordHash = await hashPassword(input.password);
  const { raw: verificationToken, hash: verificationTokenHash } = generateSecureToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await repo.createUser({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    emailVerificationTokenHash: verificationTokenHash,
    emailVerificationExpiresAt: expiresAt,
  });

  await sendVerificationEmail(input.email, input.firstName, verificationToken);

  return { message: 'Account created. Please check your email to verify your address.' };
}

// ─── Email Verification ────────────────────────────────────────────────────────

export async function verifyEmail(rawToken: string): Promise<{ message: string }> {
  const tokenHash = sha256(rawToken);
  const user = await repo.findUserByVerificationToken(tokenHash);

  if (!user) {
    throw new ValidationError('Verification link is invalid or has expired.');
  }

  if (user.emailVerifiedAt) {
    return { message: 'Email already verified. You can now log in.' };
  }

  await repo.setEmailVerified(user.id);
  await sendWelcomeEmail(user.email, user.firstName ?? '');

  return { message: 'Email verified successfully. You can now log in.' };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(
  input: LoginInput,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<LoginResult> {
  const user = await repo.findUserByEmail(input.email);

  // Constant-time comparison to prevent timing attacks on user enumeration
  const dummyHash = '$2b$12$invalidhashthatshouldnevermatch000000000000000000000';
  const passwordValid = user?.passwordHash
    ? await verifyPassword(input.password, user.passwordHash)
    : await verifyPassword(input.password, dummyHash);

  if (!user || !passwordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.emailVerifiedAt) {
    throw new ForbiddenError('Please verify your email address before logging in.');
  }

  if (!user.isActive) {
    throw new ForbiddenError('Your account has been deactivated. Contact your administrator.');
  }

  // Check if MFA is configured and verified
  const mfaCredential = await repo.findMfaCredential(user.id);
  if (mfaCredential?.isVerified) {
    const mfaChallengeToken = signMfaChallengeToken(user.id);
    // Cache that this user is in MFA challenge state
    await redis.setex(REDIS_KEYS.mfaChallenge(user.id), 300, '1');
    return {
      accessToken: '',
      user: toPublicUser(user),
      activeTenant: null,
      allTenants: [],
      requiresMfa: true,
      mfaChallengeToken,
    };
  }

  return issueTokensAndBuildResult(user, ipAddress, userAgent);
}

// ─── MFA Challenge (during login) ─────────────────────────────────────────────

export async function completeMfaChallenge(
  mfaChallengeToken: string,
  code: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<LoginResult> {
  let payload;
  try {
    payload = verifyMfaChallengeToken(mfaChallengeToken);
  } catch {
    throw new UnauthorizedError('MFA challenge token is invalid or expired');
  }

  if (payload.purpose !== 'mfa_challenge') {
    throw new UnauthorizedError('Invalid token purpose');
  }

  const pending = await redis.exists(REDIS_KEYS.mfaChallenge(payload.sub));
  if (!pending) {
    throw new UnauthorizedError('MFA session expired. Please log in again.');
  }

  const user = await repo.findUserById(payload.sub);
  if (!user) throw new UnauthorizedError('User not found');

  const mfaCredential = await repo.findMfaCredential(user.id);
  if (!mfaCredential?.isVerified) {
    throw new UnauthorizedError('MFA not configured');
  }

  const secret = decrypt(mfaCredential.secretEncrypted);
  const isValid = authenticator.check(code, secret);
  if (!isValid) {
    throw new UnauthorizedError('Invalid MFA code');
  }

  await repo.touchMfaCredential(mfaCredential.id);
  await redis.del(REDIS_KEYS.mfaChallenge(user.id));

  return issueTokensAndBuildResult(user, ipAddress, userAgent);
}

export async function completeMfaWithBackupCode(
  mfaChallengeToken: string,
  backupCode: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<LoginResult> {
  let payload;
  try {
    payload = verifyMfaChallengeToken(mfaChallengeToken);
  } catch {
    throw new UnauthorizedError('MFA challenge token is invalid or expired');
  }

  const pending = await redis.exists(REDIS_KEYS.mfaChallenge(payload.sub));
  if (!pending) {
    throw new UnauthorizedError('MFA session expired. Please log in again.');
  }

  const user = await repo.findUserById(payload.sub);
  if (!user) throw new UnauthorizedError('User not found');

  const mfaCredential = await repo.findMfaCredential(user.id);
  if (!mfaCredential?.isVerified) {
    throw new UnauthorizedError('MFA not configured');
  }

  // Each backup code is stored as a bcrypt hash. Try each one.
  const codes = mfaCredential.backupCodesEncrypted;
  let matchedIndex = -1;
  for (let i = 0; i < codes.length; i++) {
    const { verifyBackupCode } = await import('../../lib/crypto');
    if (await verifyBackupCode(backupCode, codes[i])) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex === -1) {
    throw new UnauthorizedError('Invalid backup code');
  }

  // Remove the used backup code (each code is single-use)
  const remaining = codes.filter((_, i) => i !== matchedIndex);
  await repo.updateMfaBackupCodes(mfaCredential.id, remaining);
  await redis.del(REDIS_KEYS.mfaChallenge(user.id));

  return issueTokensAndBuildResult(user, ipAddress, userAgent);
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

export async function refreshAccessToken(
  rawRefreshToken: string,
): Promise<{ accessToken: string; rawRefreshToken: string }> {
  const tokenHash = sha256(rawRefreshToken);
  const stored = await repo.findRefreshToken(tokenHash);

  if (!stored) {
    // Token reuse detection: the token is not currently valid. If it nonetheless
    // exists in the table, it was already rotated/revoked and is now being
    // replayed — a strong signal the token was stolen. Revoke the whole family
    // (all of that user's refresh tokens) so neither the attacker nor the
    // legitimate client can keep using the compromised session.
    const prior = await repo.findRefreshTokenAnyState(tokenHash);
    if (prior) {
      await repo.revokeAllUserRefreshTokens(prior.userId);
      logger.warn({ userId: prior.userId }, 'Refresh token reuse detected — revoked all sessions for user');
    }
    throw new UnauthorizedError('Refresh token is invalid or expired');
  }

  const user = await repo.findUserById(stored.userId);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }

  const memberships = await repo.findUserMemberships(user.id);
  const { accessToken, rawRefreshToken: newRawToken, refreshExpiresAt } = buildTokens(
    user,
    stored.sessionId ? { tenantId: null, memberships } : { tenantId: null, memberships },
  );

  await repo.rotateRefreshToken(stored.id, { tokenHash: sha256(newRawToken), expiresAt: refreshExpiresAt });
  await repo.touchSession(stored.sessionId);

  return { accessToken, rawRefreshToken: newRawToken };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(
  rawRefreshToken: string,
  accessTokenJti: string,
  accessTokenExp: number,
): Promise<void> {
  const tokenHash = sha256(rawRefreshToken);
  const stored = await repo.findRefreshToken(tokenHash);

  if (stored) {
    await repo.revokeRefreshToken(tokenHash);
    await repo.revokeSession(stored.sessionId);
  }

  // Add the still-valid access token to the revocation list so it cannot be reused
  const ttl = Math.max(0, accessTokenExp - Math.floor(Date.now() / 1000));
  if (ttl > 0) {
    await redis.setex(REDIS_KEYS.revokedToken(accessTokenJti), ttl, '1');
  }
}

export async function logoutAllSessions(userId: string, currentJti: string, currentExp: number): Promise<void> {
  await repo.revokeAllUserSessions(userId);
  await repo.revokeAllUserRefreshTokens(userId);
  const ttl = Math.max(0, currentExp - Math.floor(Date.now() / 1000));
  if (ttl > 0) {
    await redis.setex(REDIS_KEYS.revokedToken(currentJti), ttl, '1');
  }
}

// ─── Forgot / Reset Password ──────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const user = await repo.findUserByEmail(email);

  // Always return success to prevent email enumeration
  const message = 'If an account exists for this email, a password reset link has been sent.';

  if (!user || !user.emailVerifiedAt) return { message };

  const { raw, hash } = generateSecureToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await repo.setPasswordResetToken(user.id, hash, expiresAt);
  await sendPasswordResetEmail(user.email, user.firstName ?? '', raw);

  return { message };
}

export async function resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
  const tokenHash = sha256(input.token);
  const user = await repo.findUserByPasswordResetToken(tokenHash);

  if (!user) {
    throw new ValidationError('Password reset link is invalid or has expired.');
  }

  const passwordHash = await hashPassword(input.password);
  await repo.resetPassword(user.id, passwordHash);

  // Invalidate all sessions on password reset for security
  await repo.revokeAllUserSessions(user.id);
  await repo.revokeAllUserRefreshTokens(user.id);

  return { message: 'Password has been reset successfully. Please log in.' };
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<{ message: string }> {
  const user = await repo.findUserById(userId);
  if (!user?.passwordHash) throw new NotFoundError('User');

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Current password is incorrect');

  if (input.currentPassword === input.newPassword) {
    throw new ValidationError('New password must be different from your current password');
  }

  const newHash = await hashPassword(input.newPassword);
  await repo.updatePassword(userId, newHash);

  return { message: 'Password changed successfully.' };
}

// ─── MFA Setup ────────────────────────────────────────────────────────────────

export async function setupMfa(userId: string): Promise<MfaSetupResult> {
  const user = await repo.findUserById(userId);
  if (!user) throw new NotFoundError('User');

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, 'ComplianceCore', secret);
  const qrCodeDataUri = await QRCode.toDataURL(otpauth);

  const backupCodes = generateBackupCodes(10);
  const { hashBackupCode } = await import('../../lib/crypto');
  const hashedBackupCodes = await Promise.all(backupCodes.map(hashBackupCode));

  await repo.upsertMfaCredential({
    userId,
    secretEncrypted: encrypt(secret),
    backupCodesEncrypted: hashedBackupCodes,
  });

  return { secret, qrCodeDataUri, backupCodes };
}

export async function confirmMfaSetup(userId: string, code: string): Promise<{ message: string }> {
  const credential = await repo.findMfaCredential(userId);
  if (!credential) throw new NotFoundError('MFA credential');
  if (credential.isVerified) {
    throw new ConflictError('MFA is already enabled');
  }

  const secret = decrypt(credential.secretEncrypted);
  const isValid = authenticator.check(code, secret);
  if (!isValid) {
    throw new UnauthorizedError('Invalid TOTP code. Ensure your authenticator time is correct.');
  }

  await repo.verifyMfaCredential(credential.id);
  return { message: 'MFA enabled successfully.' };
}

export async function disableMfa(
  userId: string,
  password: string,
): Promise<{ message: string }> {
  const user = await repo.findUserById(userId);
  if (!user?.passwordHash) throw new NotFoundError('User');

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Incorrect password');

  await repo.deleteMfaCredential(userId);
  return { message: 'MFA has been disabled.' };
}

// ─── Session Management ───────────────────────────────────────────────────────

export async function getActiveSessions(
  userId: string,
  currentSessionId: string,
): Promise<SessionInfo[]> {
  const sessions = await repo.findActiveSessions(userId);
  return sessions.map((s) => ({
    id: s.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    lastActiveAt: s.lastActiveAt,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
    isCurrent: s.id === currentSessionId,
  }));
}

export async function revokeSession(
  userId: string,
  sessionId: string,
): Promise<{ message: string }> {
  const sessions = await repo.findActiveSessions(userId);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) throw new NotFoundError('Session');

  await repo.revokeSession(sessionId);
  // Revoke all refresh tokens for that session
  await repo.revokeAllUserRefreshTokens(userId); // Simplified: revoke all
  return { message: 'Session revoked.' };
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

function toPublicUser(user: Awaited<ReturnType<typeof repo.findUserById>> & {}): UserPublic {
  return {
    id: user!.id,
    email: user!.email,
    firstName: user!.firstName,
    lastName: user!.lastName,
    avatarUrl: user!.avatarUrl,
    emailVerifiedAt: user!.emailVerifiedAt,
    isActive: user!.isActive,
    onboardingCompletedAt: user!.onboardingCompletedAt,
    createdAt: user!.createdAt,
  };
}

function buildTokens(
  user: NonNullable<Awaited<ReturnType<typeof repo.findUserById>>>,
  context: {
    tenantId: string | null;
    memberships: { role: string; tenant: { id: string; name: string; slug: string } }[];
  },
) {
  const activeMembership = context.tenantId
    ? context.memberships.find((m) => m.tenant.id === context.tenantId)
    : context.memberships[0];

  const role = (activeMembership?.role ?? null) as import('./auth.types').UserRole | null;
  const permissions = role ? getPermissionsForRole(role) : [];

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role,
    tenantId: activeMembership?.tenant.id ?? null,
    permissions,
    requiresOnboarding: !user.onboardingCompletedAt,
  });

  const { raw: rawRefreshToken } = generateRefreshToken();
  const refreshExpiresAt = new Date(
    Date.now() + env.JWT_REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  return { accessToken, rawRefreshToken, refreshExpiresAt, activeMembership, role };
}

async function issueTokensAndBuildResult(
  user: NonNullable<Awaited<ReturnType<typeof repo.findUserById>>>,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<LoginResult> {
  const memberships = await repo.findUserMemberships(user.id);
  const { accessToken, rawRefreshToken, refreshExpiresAt, activeMembership } = buildTokens(
    user,
    { tenantId: null, memberships },
  );

  const session = await repo.createSession({
    userId: user.id,
    tenantId: activeMembership?.tenant.id ?? null,
    ipAddress,
    userAgent,
    expiresAt: refreshExpiresAt,
  });

  await repo.createRefreshToken({
    sessionId: session.id,
    userId: user.id,
    tokenHash: sha256(rawRefreshToken),
    expiresAt: refreshExpiresAt,
  });

  // Attach raw refresh token to result so the controller can set the cookie
  (session as typeof session & { _rawRefreshToken: string })._rawRefreshToken = rawRefreshToken;

  return {
    accessToken,
    user: toPublicUser(user),
    activeTenant: activeMembership
      ? { id: activeMembership.tenant.id, name: activeMembership.tenant.name, slug: activeMembership.tenant.slug, role: activeMembership.role as import('./auth.types').UserRole }
      : null,
    allTenants: memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      role: m.role as import('./auth.types').UserRole,
    })),
    requiresMfa: false,
    // Store raw token on session object so controller can read it
    ...(session as unknown as { _rawRefreshToken: string }),
  } as LoginResult & { _rawRefreshToken: string };
}
