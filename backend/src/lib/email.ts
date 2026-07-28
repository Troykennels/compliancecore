import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

// Explicit timeouts. Nodemailer's defaults are 2 min to connect and 10 min on
// the socket, so an SMTP host that is unreachable, misconfigured, or simply
// slow leaves the caller hanging for minutes. Every send here is best-effort
// (see `send` below), so failing fast is strictly better than blocking.
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  connectionTimeout: 10_000,
  greetingTimeout:   10_000,
  socketTimeout:     20_000,
});

async function send(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
    logger.info({ to, subject }, 'Email sent');
  } catch (err) {
    // The reason goes in the MESSAGE, not just the structured field. Hosted log
    // viewers commonly surface only pino's `msg`, so "Failed to send email" on
    // its own is undebuggable — the SMTP response code and text are exactly
    // what identifies an auth failure, a blocked IP or an unverified sender.
    const e = err as { message?: string; responseCode?: number; response?: string; code?: string };
    logger.error(
      { err, to, subject },
      `Failed to send email to ${to}: ${e.code ?? ''} ${e.responseCode ?? ''} ${e.response ?? e.message ?? 'unknown error'}`.replace(/\s+/g, ' ').trim(),
    );
    // Do not throw — email failures should not fail the HTTP request.
    // The user can request a resend.
  }
}

export async function sendVerificationEmail(
  to: string,
  firstName: string,
  rawToken: string,
): Promise<void> {
  const link = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
  await send(
    to,
    'Verify your ComplianceCore email address',
    `
    <p>Hi ${firstName || 'there'},</p>
    <p>Please verify your email address to activate your ComplianceCore account.</p>
    <p><a href="${link}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Verify Email</a></p>
    <p>This link expires in 24 hours.</p>
    <p>If you did not create a ComplianceCore account, you can safely ignore this email.</p>
    `,
  );
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  rawToken: string,
): Promise<void> {
  const link = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;
  await send(
    to,
    'Reset your ComplianceCore password',
    `
    <p>Hi ${firstName || 'there'},</p>
    <p>We received a request to reset your password.</p>
    <p><a href="${link}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
    <p>This link expires in 1 hour. If you did not request a password reset, no action is needed.</p>
    `,
  );
}

export async function sendMfaBackupCodesEmail(
  to: string,
  firstName: string,
  codes: string[],
): Promise<void> {
  const codeList = codes.map((c) => `<li style="font-family:monospace;">${c}</li>`).join('');
  await send(
    to,
    'Your ComplianceCore MFA backup codes',
    `
    <p>Hi ${firstName || 'there'},</p>
    <p>Here are your one-time backup codes for ComplianceCore. Each code can be used once.</p>
    <ul>${codeList}</ul>
    <p>Store these in a safe place. You can use them to access your account if you lose your authenticator device.</p>
    `,
  );
}

export async function sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  await send(
    to,
    'Welcome to ComplianceCore',
    `
    <p>Hi ${firstName || 'there'},</p>
    <p>Your email has been verified. You're all set to start building your compliance programme.</p>
    <p><a href="${env.FRONTEND_URL}/onboarding" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Get Started</a></p>
    `,
  );
}

export async function sendTeamInvitationEmail(
  to: string,
  inviterEmail: string,
  role: string,
  inviteToken: string,
  tenantId: string,
): Promise<void> {
  const link = `${env.FRONTEND_URL}/invite/accept?token=${inviteToken}&tenant=${tenantId}`;
  await send(
    to,
    `You've been invited to join ComplianceCore`,
    `
    <p>${inviterEmail} has invited you to join their organisation on ComplianceCore as a <strong>${role.replace(/_/g, ' ')}</strong>.</p>
    <p><a href="${link}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invitation</a></p>
    <p>This invitation link expires in 7 days. If you did not expect this invitation, you can safely ignore it.</p>
    `,
  );
}

export async function sendExpiryReminderEmail(
  to: string,
  ownerName: string,
  itemName: string,
  daysUntil: number,
  expiryDate: string,
): Promise<void> {
  const link = `${env.FRONTEND_URL}/expiry`;
  const when = daysUntil <= 0
    ? 'today'
    : `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
  await send(
    to,
    `Reminder: ${itemName} expires ${when}`,
    `
    <p>Hi ${ownerName || 'there'},</p>
    <p><strong>${itemName}</strong> is due to expire ${when} (${expiryDate}).</p>
    <p><a href="${link}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">View Expiry Tracker</a></p>
    <p>Please renew or update this item before it expires to stay compliant.</p>
    `,
  );
}

export async function sendRawEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}): Promise<void> {
  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
  } catch (err) {
    logger.error({ err, to: opts.to, subject: opts.subject }, 'Failed to send raw email');
  }
}

// Named export object for use in service files that need multiple email functions
export const email = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendMfaBackupCodesEmail,
  sendWelcomeEmail,
  sendTeamInvitation: (params: {
    to: string;
    inviterName: string;
    role: string;
    inviteToken: string;
    tenantId: string;
  }) => sendTeamInvitationEmail(params.to, params.inviterName, params.role, params.inviteToken, params.tenantId),
  sendExpiryReminder: (params: {
    to: string;
    ownerName: string;
    itemName: string;
    daysUntil: number;
    expiryDate: string;
  }) => sendExpiryReminderEmail(params.to, params.ownerName, params.itemName, params.daysUntil, params.expiryDate),
  sendRawEmail,
};
