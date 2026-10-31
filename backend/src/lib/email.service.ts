import { sendRawEmail } from './email';
import { env } from '../config/env';
const APP_URL = process.env.APP_URL ?? env.FRONTEND_URL;

export interface SendEmailOptions {
  to:      string | string[];
  subject: string;
  html:    string;
  text?:   string;
  replyTo?:string;
}


function stripHtml(html: string): string { return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
function escapeHtml(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!)); }
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  await Promise.all(recipients.map(to => sendRawEmail({ to, subject: options.subject, html: options.html, text: options.text ?? stripHtml(options.html), replyTo: options.replyTo, throwOnError: true })));
}

function base(body: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
<tr><td style="background:#1E293B;padding:20px 28px;">
  <span style="color:#ffffff;font-size:18px;font-weight:700;">ComplianceCore</span>
  <span style="color:#64748B;font-size:13px;margin-left:8px;">GRC Platform</span>
</td></tr>
<tr><td style="padding:28px;">${body}</td></tr>
<tr><td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;">
  <p style="margin:0;font-size:11px;color:#94a3b8;">This email was sent by ComplianceCore. Do not reply to this email.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function btn(href: string, label: string, color = '#3B82F6'): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#ffffff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;margin-top:16px;">${escapeHtml(label)}</a>`;
}

export const emailTemplates = {
  taskAssigned(data: {
    recipientName: string;
    taskTitle: string;
    dueDate?: string;
    assignedBy: string;
    taskId: string;
  }) {
    const url = `${APP_URL}/tasks/${data.taskId}`;
    return {
      subject: `Task assigned to you: ${data.taskTitle}`,
      html: base(`
        <h2 style="margin:0 0 16px;color:#0F172A;font-size:20px;">You have a new task</h2>
        <p style="color:#475569;margin:0 0 16px;">Hi ${escapeHtml(data.recipientName)},</p>
        <p style="color:#475569;margin:0 0 16px;"><strong style="color:#0F172A;">${escapeHtml(data.assignedBy)}</strong> assigned you a task:</p>
        <div style="background:#f8fafc;border-left:4px solid #3B82F6;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
          <strong style="color:#0F172A;">${escapeHtml(data.taskTitle)}</strong>
          ${data.dueDate ? `<br><span style="color:#64748B;font-size:13px;">Due: ${escapeHtml(data.dueDate)}</span>` : ''}
        </div>
        ${btn(url, 'View Task')}
      `),
    };
  },

  approvalRequested(data: {
    recipientName: string;
    requestTitle: string;
    requestedBy: string;
    requestId: string;
    deadline?: string;
    stepName?: string;
  }) {
    const url = `${APP_URL}/approvals/${data.requestId}`;
    return {
      subject: `Approval needed: ${data.requestTitle}`,
      html: base(`
        <h2 style="margin:0 0 16px;color:#0F172A;font-size:20px;">Your approval is required</h2>
        <p style="color:#475569;margin:0 0 16px;">Hi ${escapeHtml(data.recipientName)},</p>
        <p style="color:#475569;margin:0 0 16px;"><strong style="color:#0F172A;">${escapeHtml(data.requestedBy)}</strong> needs your approval for:</p>
        <div style="background:#f8fafc;border-left:4px solid #8B5CF6;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
          <strong style="color:#0F172A;">${escapeHtml(data.requestTitle)}</strong>
          ${data.stepName ? `<br><span style="color:#64748B;font-size:13px;">Step: ${escapeHtml(data.stepName)}</span>` : ''}
          ${data.deadline ? `<br><span style="color:#EF4444;font-size:13px;">Deadline: ${escapeHtml(data.deadline)}</span>` : ''}
        </div>
        ${btn(url, 'Review & Decide', '#8B5CF6')}
      `),
    };
  },

  approvalDecided(data: {
    recipientName: string;
    requestTitle: string;
    decision: string;
    decidedBy: string;
    comments?: string;
    requestId: string;
  }) {
    const url = `${APP_URL}/approvals/${data.requestId}`;
    const isApproved = data.decision === 'approved';
    const color = isApproved ? '#22C55E' : data.decision === 'changes_requested' ? '#F59E0B' : '#EF4444';
    const label = isApproved ? 'Approved' : data.decision === 'changes_requested' ? 'Changes Requested' : 'Rejected';
    return {
      subject: `Approval ${label}: ${data.requestTitle}`,
      html: base(`
        <h2 style="margin:0 0 16px;color:#0F172A;font-size:20px;">Approval Update</h2>
        <p style="color:#475569;margin:0 0 16px;">Hi ${escapeHtml(data.recipientName)},</p>
        <p style="color:#475569;margin:0 0 16px;">Your approval request has been <strong style="color:${color};">${label}</strong> by <strong style="color:#0F172A;">${escapeHtml(data.decidedBy)}</strong>.</p>
        <div style="background:#f8fafc;border-left:4px solid ${color};padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
          <strong style="color:#0F172A;">${escapeHtml(data.requestTitle)}</strong>
          ${data.comments ? `<br><em style="color:#64748B;">"${escapeHtml(data.comments)}"</em>` : ''}
        </div>
        ${btn(url, 'View Request', '#1E293B')}
      `),
    };
  },

  escalationAlert(data: {
    recipientName: string;
    entityTitle: string;
    message: string;
    entityUrl: string;
  }) {
    return {
      subject: `Escalation Alert: ${data.entityTitle}`,
      html: base(`
        <h2 style="margin:0 0 16px;color:#EF4444;font-size:20px;">Escalation Alert</h2>
        <p style="color:#475569;margin:0 0 16px;">Hi ${escapeHtml(data.recipientName)},</p>
        <p style="color:#475569;margin:0 0 16px;">${escapeHtml(data.message)}</p>
        <div style="background:#FEF2F2;border-left:4px solid #EF4444;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
          <strong style="color:#0F172A;">${escapeHtml(data.entityTitle)}</strong>
        </div>
        ${btn(data.entityUrl, 'View Item', '#EF4444')}
      `),
    };
  },

  signatureRequested(data: {
    recipientName: string;
    documentTitle: string;
    requestedBy: string;
    signUrl: string;
  }) {
    return {
      subject: `Signature required: ${data.documentTitle}`,
      html: base(`
        <h2 style="margin:0 0 16px;color:#0F172A;font-size:20px;">Your signature is required</h2>
        <p style="color:#475569;margin:0 0 16px;">Hi ${escapeHtml(data.recipientName)},</p>
        <p style="color:#475569;margin:0 0 16px;"><strong style="color:#0F172A;">${escapeHtml(data.requestedBy)}</strong> requests your digital signature on:</p>
        <div style="background:#f8fafc;border-left:4px solid #10B981;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
          <strong style="color:#0F172A;">${escapeHtml(data.documentTitle)}</strong>
        </div>
        ${btn(data.signUrl, 'Sign Document', '#10B981')}
      `),
    };
  },
};
