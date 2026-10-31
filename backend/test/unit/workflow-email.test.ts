import { beforeEach, describe, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/email', () => ({ sendRawEmail: transport }));
vi.mock('../../src/config/env', () => ({ env: { FRONTEND_URL: 'https://compliance.example.invalid' } }));
import { sendEmail, emailTemplates } from '../../src/lib/email.service';
beforeEach(() => { vi.clearAllMocks(); transport.mockResolvedValue(undefined); });

describe('workflow email delivery', () => {
  it('uses the configured shared transport for each recipient and retains plain text', async () => {
    await sendEmail({ to: ['first@example.invalid', 'second@example.invalid'], subject: 'Review', html: '<p>Review this record</p>' });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ to: 'first@example.invalid', text: 'Review this record', throwOnError: true }));
  });
  it('links to the configured app and treats user-supplied HTML as text', () => {
    const template = emailTemplates.taskAssigned({ recipientName: '<img src=x>', taskTitle: 'Access & accounts <script>unsafe</script>', assignedBy: 'Manager', taskId: 'fixture-task' });
    expect(template.html).toContain('https://compliance.example.invalid/tasks/fixture-task');
    expect(template.html).not.toContain('http://localhost:5173');
    expect(template.html).toContain('&lt;img src=x&gt;');
    expect(template.html).not.toContain('<script>unsafe</script>');
    expect(template.subject).toContain('Access & accounts');
  });
  it('reports a failed delivery to workflow callers that may handle or retry it', async () => {
    transport.mockRejectedValue(new Error('Transport unavailable'));
    await expect(sendEmail({ to: 'owner@example.invalid', subject: 'Review', html: '<p>Review</p>' })).rejects.toThrow('Transport unavailable');
  });
});
