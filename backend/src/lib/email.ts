import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

async function send(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
  } catch (err) {
    logger.error({ err, to, subject }, 'Failed to send email');
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
  sendRawEmail,
};
