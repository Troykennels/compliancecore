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

// ─── Transport selection ─────────────────────────────────────────────────────
// Brevo's HTTP API is used whenever BREVO_API_KEY is set, because managed hosts
// commonly block outbound SMTP. This deployment proved it: with entirely valid
// credentials, a verified sender and IP restrictions disabled, every send from
// Railway failed with `ETIMEDOUT Connection timeout` — the TCP connection to
// port 587 never opened. Port 443 is not blocked anywhere.
const useHttpApi = Boolean(env.BREVO_API_KEY);

// EMAIL_FROM is an RFC 5322 address ("Name <a@b.c>"); the HTTP API wants the
// name and address as separate fields.
function parseFrom(): { name: string; email: string } {
  const m = env.EMAIL_FROM.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, '') || 'ComplianceCore', email: m[2] };
  return { name: 'ComplianceCore', email: env.EMAIL_FROM.trim() };
}

async function sendViaHttpApi(
  to: string,
  subject: string,
  html: string,
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>,
  replyTo?: string,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'api-key': env.BREVO_API_KEY as string,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: parseFrom(),
        to: [{ email: to }],
        subject,
        htmlContent: html,
        ...(replyTo && { replyTo: { email: replyTo } }),
        // Brevo takes attachments base64-encoded rather than as raw bytes.
        ...(attachments?.length && {
          attachment: attachments.map((a) => ({
            name: a.filename,
            content: a.content.toString('base64'),
          })),
        }),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Brevo API ${res.status}: ${body.slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function send(to: string, subject: string, html: string): Promise<void> {
  try {
    if (useHttpApi) {
      await sendViaHttpApi(to, subject, html);
    } else {
      await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
    }
    logger.info({ to, subject, transport: useHttpApi ? 'http' : 'smtp' }, 'Email sent');
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

/**
 * What the mail transport is actually configured to do, for diagnosis.
 *
 * Every send is best-effort and swallows its own errors, which is right — a
 * failed email must not fail a registration — but it also means a completely
 * broken mail setup is invisible unless somebody reads the logs. Boot-time
 * logging and the owner-only test endpoint both use this.
 */
export function emailTransportStatus(): {
  transport: 'brevo-http' | 'smtp';
  from: string;
  ready: boolean;
  warning: string | null;
} {
  const from = env.EMAIL_FROM;

  if (useHttpApi) {
    return { transport: 'brevo-http', from, ready: true, warning: null };
  }

  return {
    transport: 'smtp',
    from,
    ready: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
    // Named explicitly because this exact configuration has already cost this
    // deployment a full day: valid credentials, verified sender, and every
    // send still timing out because the platform blocks outbound port 587.
    warning:
      'Sending over SMTP. Managed hosts (Railway, Render, Fly) commonly block outbound '
      + 'port 587, in which case every email fails with ETIMEDOUT and nothing arrives. '
      + 'Set BREVO_API_KEY to send over HTTPS instead.',
  };
}

/**
 * Sends a real email and REPORTS THE FAILURE, unlike every other send here.
 *
 * Used only by the owner-only diagnostic endpoint. Its whole purpose is to
 * surface the provider's own message — "sender not verified", "invalid API
 * key", "connection timeout" — which is the one piece of information that
 * identifies the problem, and which the fire-and-forget path deliberately
 * hides.
 */
export async function sendDiagnosticEmail(to: string): Promise<void> {
  const status = emailTransportStatus();
  const html = `
    <p>This is a ComplianceCore test email.</p>
    <p>If you are reading it, outbound email is working.</p>
    <table style="border-collapse:collapse">
      <tr><td><strong>Transport</strong></td><td>${status.transport}</td></tr>
      <tr><td><strong>From</strong></td><td>${status.from}</td></tr>
      <tr><td><strong>Sent</strong></td><td>${new Date().toISOString()}</td></tr>
    </table>`;

  // Deliberately NOT wrapped in the swallowing `send`.
  if (useHttpApi) {
    await sendViaHttpApi(to, 'ComplianceCore email test', html);
  } else {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject: 'ComplianceCore email test', html });
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
  /** Defaults to EMAIL_REPLY_TO. Pass explicitly to override per message. */
  replyTo?: string;
}): Promise<void> {
  const replyTo = opts.replyTo ?? env.EMAIL_REPLY_TO;
  try {
    if (useHttpApi) {
      await sendViaHttpApi(opts.to, opts.subject, opts.html, opts.attachments, replyTo);
    } else {
      await transporter.sendMail({
        from: env.EMAIL_FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        ...(replyTo && { replyTo }),
        attachments: opts.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
    }
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
