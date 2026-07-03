import { prisma } from '../../config/database';
import type { User, TenantMembership, Session, RefreshToken, MfaCredential } from '@prisma/client';

// ─── User ─────────────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
  });
}

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { id, deletedAt: null } });
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  emailVerificationTokenHash: string;
  emailVerificationExpiresAt: Date;
}): Promise<User> {
  return prisma.user.create({ data });
}

export async function setEmailVerified(userId: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    },
  });
}

export async function findUserByVerificationToken(tokenHash: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { gt: new Date() },
      deletedAt: null,
    },
  });
}

export async function setPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt },
  });
}

export async function findUserByPasswordResetToken(tokenHash: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { gt: new Date() },
      deletedAt: null,
    },
  });
}

export async function resetPassword(userId: string, passwordHash: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

// ─── Tenant Memberships ───────────────────────────────────────────────────────

export async function findUserMemberships(
  userId: string,
): Promise<(TenantMembership & { tenant: { id: string; name: string; slug: string } })[]> {
  return prisma.tenantMembership.findMany({
    where: { userId, isActive: true, deletedAt: null },
    include: { tenant: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function findMembership(
  userId: string,
  tenantId: string,
): Promise<TenantMembership | null> {
  return prisma.tenantMembership.findFirst({
    where: { userId, tenantId, isActive: true, deletedAt: null },
  });
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(data: {
  userId: string;
  tenantId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
}): Promise<Session> {
  return prisma.session.create({ data });
}

export async function touchSession(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { lastActiveAt: new Date() },
  });
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function findActiveSessions(userId: string): Promise<Session[]> {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: 'desc' },
  });
}

// ─── Refresh Tokens ───────────────────────────────────────────────────────────

export async function createRefreshToken(data: {
  sessionId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<RefreshToken> {
  return prisma.refreshToken.create({ data });
}

export async function findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
  return prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}

// Refresh token rotation: revoke old token, create new one in same session.
export async function rotateRefreshToken(
  oldTokenId: string,
  newData: { tokenHash: string; expiresAt: Date },
): Promise<RefreshToken> {
  const old = await prisma.refreshToken.findUniqueOrThrow({ where: { id: oldTokenId } });

  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: oldTokenId },
      data: { usedAt: new Date(), revokedAt: new Date() },
    });

    return tx.refreshToken.create({
      data: {
        sessionId: old.sessionId,
        userId: old.userId,
        tokenHash: newData.tokenHash,
        expiresAt: newData.expiresAt,
      },
    });
  });
}

export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ─── MFA ─────────────────────────────────────────────────────────────────────

export async function findMfaCredential(userId: string): Promise<MfaCredential | null> {
  return prisma.mfaCredential.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function upsertMfaCredential(data: {
  userId: string;
  secretEncrypted: string;
  backupCodesEncrypted: string[];
}): Promise<MfaCredential> {
  const existing = await prisma.mfaCredential.findFirst({ where: { userId: data.userId } });

  if (existing) {
    return prisma.mfaCredential.update({
      where: { id: existing.id },
      data: {
        secretEncrypted: data.secretEncrypted,
        backupCodesEncrypted: data.backupCodesEncrypted,
        isVerified: false,
      },
    });
  }

  return prisma.mfaCredential.create({ data: { ...data, isVerified: false } });
}

export async function verifyMfaCredential(credentialId: string): Promise<MfaCredential> {
  return prisma.mfaCredential.update({
    where: { id: credentialId },
    data: { isVerified: true, lastUsedAt: new Date() },
  });
}

export async function touchMfaCredential(credentialId: string): Promise<void> {
  await prisma.mfaCredential.update({
    where: { id: credentialId },
    data: { lastUsedAt: new Date() },
  });
}

export async function deleteMfaCredential(userId: string): Promise<void> {
  await prisma.mfaCredential.deleteMany({ where: { userId } });
}

export async function updateMfaBackupCodes(
  credentialId: string,
  backupCodesEncrypted: string[],
): Promise<void> {
  await prisma.mfaCredential.update({
    where: { id: credentialId },
    data: { backupCodesEncrypted },
  });
}
