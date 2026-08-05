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
import { revokeUserTokens } from '../../lib/token-revocation';
import * as repo from './auth.repository';
import type {
  LoginResult, MfaSetupResult, SessionInfo, UserPublic, TenantSummary, UserRole,
} from './auth.types';
import type { RegisterInput, LoginInput, ResetPasswordInput, ChangePasswordInput } from './auth.schema';

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(input: RegisterInput): Promise<{ message: string }> {
  // Identical response whether or not the address exists, so this endpoint
  // cannot be used to discover who has an account.
  const SAME_ANSWER = {
    message: 'If this email is not registered, you will receive a verification link.',
  };

  const existing = await repo.findUserByEmail(input.email);
  if (existing) {
    // An existing but UNVERIFIED account gets its link re-sent.
    //
    // This used to return the success message and send nothing at all, which
    // is a trap rather than a safeguard: the person whose first verification
    // email went missing signs up again with the same address, is told to
    // check their inbox, and waits forever. Every retry is a silent no-op, and
    // they cannot use a different address because they want THAT one.
    //
    // Re-sending leaks nothing new — the response is unchanged, and the mail
    // goes only to the address itself, which is where a verification link was
    // already sent when the account was created.
    if (!existing.emailVerifiedAt) {
      const { raw, hash } = generateSecureToken();
      await repo.setEmailVerificationToken(
        existing.id,
        hash,
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      );
      void sendVerificationEmail(existing.email, existing.firstName ?? '', raw);
      logger.info({ userId: existing.id }, 'Re-sent verification for existing unverified account');
    }
    return SAME_ANSWER;
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

  // Deliberately not awaited. The account is already committed, and the send is
  // best-effort (sendVerificationEmail swallows its own errors and never
  // rejects, so this cannot become an unhandled rejection). Awaiting it made
  // registration hang for as long as the SMTP handshake took — up to minutes on
  // an unreachable host — which read to users as "registration fails sometimes".
  // Users who never receive the mail can request a resend.
  void sendVerificationEmail(input.email, input.firstName, verificationToken);

  return { message: 'Account created. Please check your email to verify your address.' };
}

// ─── Email Verification ────────────────────────────────────────────────────────

/**
 * Issues a fresh verification link.
 *
 * There was no way to do this. Registration sends the mail fire-and-forget and
 * swallows any failure, so anyone whose email did not arrive — a transient
 * provider error, a spam filter, a typo they want to retry past — was stuck
 * permanently: unable to verify, unable to log in, and unable to re-register
 * because the address was already taken.
 *
 * The response is identical whether or not the address exists, for the same
 * reason register's is: this endpoint is unauthenticated, so a different answer
 * would confirm which addresses hold accounts.
 */
export async function resendVerificationEmail(email: string): Promise<{ message: string }> {
  const SAME_ANSWER = {
    message: 'If that address needs verifying, a new link is on its way.',
  };

  const user = await repo.findUserByEmail(email);
  if (!user || user.emailVerifiedAt) return SAME_ANSWER;

  // A new token each time, so an older link that may have leaked stops working.
  const { raw, hash } = generateSecureToken();
  await repo.setEmailVerificationToken(
    user.id,
    hash,
    new Date(Date.now() + 24 * 60 * 60 * 1000),
  );

  void sendVerificationEmail(user.email, user.firstName ?? '', raw);
  logger.info({ userId: user.id }, 'Verification email resent');

  return SAME_ANSWER;
}

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
  // Best-effort, same reasoning as registration: never block the response on SMTP.
  void sendWelcomeEmail(user.email, user.firstName ?? '');

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

  // Preserve the session's active tenant across refresh. If that tenant is no
  // longer a valid membership (e.g. the user was removed), fall back to the
  // first available membership.
  const session = stored.sessionId ? await repo.findSessionById(stored.sessionId) : null;
  const stillMember = memberships.some((m) => m.tenant.id === session?.tenantId);
  const activeTenantId = stillMember ? session!.tenantId : (memberships[0]?.tenant.id ?? null);

  const { accessToken, rawRefreshToken: newRawToken, refreshExpiresAt } = buildTokens(
    user,
    { tenantId: activeTenantId, memberships },
  );

  await repo.rotateRefreshToken(stored.id, { tokenHash: sha256(newRawToken), expiresAt: refreshExpiresAt });
  await repo.touchSession(stored.sessionId);

  return { accessToken, rawRefreshToken: newRawToken };
}

// ─── Switch Tenant ────────────────────────────────────────────────────────────

/**
 * Moves the caller's session to another organisation they belong to.
 *
 * Membership is re-checked here rather than trusted from the client: the tenant
 * id ends up inside a signed access token that every downstream module uses to
 * pick a schema, so accepting an unverified id would be a direct cross-tenant
 * data leak.
 *
 * The session row is updated too, not just the token. Without that, the next
 * silent refresh would read the old session and quietly drop the user back into
 * the previous organisation.
 */
export async function switchTenant(
  userId: string,
  targetTenantId: string,
  rawRefreshToken: string | undefined,
): Promise<{ accessToken: string; activeTenant: TenantSummary }> {
  const memberships = await repo.findUserMemberships(userId);
  const target = memberships.find((m) => m.tenant.id === targetTenantId);
  if (!target) {
    throw new ForbiddenError('You do not have access to that organization.');
  }

  const user = await repo.findUserById(userId);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }

  // Persist the choice on the session behind the refresh cookie, so it survives
  // token refresh and page reloads. The refresh token itself is deliberately NOT
  // rotated: switching organisation is not a re-authentication, and issuing a
  // new cookie here would race the silent-refresh interceptor and trip the
  // token-reuse detector that revokes every session for the user.
  if (rawRefreshToken) {
    const stored = await repo.findRefreshToken(sha256(rawRefreshToken));
    if (stored?.sessionId) {
      await repo.setSessionTenant(stored.sessionId, targetTenantId);
    }
  }

  const { accessToken } = buildTokens(user, { tenantId: targetTenantId, memberships });

  return {
    accessToken,
    activeTenant: {
      id: target.tenant.id,
      name: target.tenant.name,
      slug: target.tenant.slug,
      role: target.role as UserRole,
    },
  };
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
  // Blacklisting only the caller's own jti made "log out everywhere" log out
  // exactly one device — the one you were already using. Every OTHER live
  // access token, including the stolen one that made you press the button,
  // kept working.
  await revokeUserTokens(userId, 'logged out of all sessions');
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

  // Unverified accounts are NOT excluded.
  //
  // They used to be, silently, which created a second dead end for the exact
  // person most likely to be here: someone whose verification email never
  // arrived, trying password reset as a way in. They got the same reassuring
  // "a link has been sent" and nothing ever came.
  //
  // It weakens nothing. The reset link goes to the address itself, so using it
  // proves control of that inbox — the very thing verification establishes.
  // resetPassword therefore also marks the address verified.
  if (!user) return { message };

  const { raw, hash } = generateSecureToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await repo.setPasswordResetToken(user.id, hash, expiresAt);
  // Best-effort and not awaited: the token is already persisted, the response is
  // deliberately identical either way (anti-enumeration), and this endpoint is
  // unauthenticated — blocking it on an SMTP handshake ties up request handlers.
  void sendPasswordResetEmail(user.email, user.firstName ?? '', raw);

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

  // Completing a reset proves control of the mailbox, which is exactly what
  // verification establishes — so an account that was never verified becomes
  // verified here rather than leaving the person able to sign in nowhere.
  if (!user.emailVerifiedAt) {
    await repo.setEmailVerified(user.id);
    logger.info({ userId: user.id }, 'Email verified via completed password reset');
  }

  // Invalidate all sessions on password reset for security. The refresh tokens
  // were already revoked here; the access tokens were not, so anyone holding
  // one kept up to 15 more minutes of access to an account that had just been
  // recovered from them.
  await repo.revokeAllUserSessions(user.id);
  await repo.revokeAllUserRefreshTokens(user.id);
  await revokeUserTokens(user.id, 'password reset');

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

  // Changing your password is the standard response to "someone else may be in
  // my account", and it used to revoke nothing: an attacker holding a stolen
  // refresh token kept rotating it indefinitely, and their access token stayed
  // valid. resetPassword already did this; this path did not.
  await repo.revokeAllUserSessions(userId);
  await repo.revokeAllUserRefreshTokens(userId);
  await revokeUserTokens(userId, 'password changed');

  return {
    message: 'Password changed. You have been signed out on all other devices.',
  };
}

// ─── MFA Setup ────────────────────────────────────────────────────────────────

export async function setupMfa(userId: string): Promise<MfaSetupResult> {
  const user = await repo.findUserById(userId);
  if (!user) throw new NotFoundError('User');

  // Re-enrolling resets the stored credential to unverified, and login only
  // demands a second factor when a VERIFIED credential exists — so calling this
  // on an account that already has MFA turned it off, silently, with nothing
  // more than a bearer token. Disabling MFA correctly requires the password;
  // this path bypassed that entirely and was the quieter way to do the same
  // thing. Re-enrolment now has to go through disable first, which does ask.
  const existing = await repo.findMfaCredential(userId);
  if (existing?.isVerified) {
    throw new ConflictError(
      'Two-factor authentication is already enabled. Disable it first to enrol a new device.',
    );
  }

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
  // Revoke only the refresh tokens for this session so the user's other
  // sessions remain active.
  await repo.revokeRefreshTokensBySession(sessionId);
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
    isSuperadmin: user!.isSuperadmin,
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
    isSuperadmin: user.isSuperadmin,
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
