import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/lib/prisma', () => ({ withTenantSchema: vi.fn() }));
vi.mock('../../src/middleware/audit.middleware', () => ({ setAuditSessionVars: vi.fn() }));
vi.mock('../../src/lib/active-member', () => ({ assertActiveMembers: vi.fn() }));
import { assertRoomAction, participantSchema, requestSchema, decisionSchema } from '../../src/modules/audits/audit-room.service';
import { preferencesSchema } from '../../src/modules/notifications/notification-preferences';

describe('audit room boundaries', () => {
  it('allows an assigned control owner to submit evidence but not review or manage it', () => {
    expect(() => assertRoomAction('control_owner', 'submit', true)).not.toThrow();
    expect(() => assertRoomAction('control_owner', 'comment', true)).not.toThrow();
    expect(() => assertRoomAction('control_owner', 'submit', false)).toThrow();
    expect(() => assertRoomAction('control_owner', 'decide', true)).toThrow();
    expect(() => assertRoomAction('control_owner', 'manage', true)).toThrow();
  });
  it('lets auditors review and comment while reserving administration for managers', () => {
    expect(() => assertRoomAction('auditor', 'decide', false)).not.toThrow();
    expect(() => assertRoomAction('auditor', 'comment', false)).not.toThrow();
    expect(() => assertRoomAction('auditor', 'manage', false)).toThrow();
    expect(() => assertRoomAction('auditor', 'submit', false)).toThrow();
    for (const role of ['viewer', 'msp_analyst', 'msp_admin', null]) expect(() => assertRoomAction(role, 'comment', false)).toThrow();
  });
  it('requires real, ordered access dates and meaningful request/decision text', () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    expect(participantSchema.safeParse({ userId, accessFrom: '2026-11-02', accessUntil: '2026-11-01' }).success).toBe(false);
    expect(participantSchema.safeParse({ userId, accessFrom: '2026-02-30', accessUntil: '2026-11-01' }).success).toBe(false);
    expect(requestSchema.safeParse({ reference: ' ', title: ' ' }).success).toBe(false);
    expect(decisionSchema.safeParse({ status: 'accepted', note: ' ' }).success).toBe(false);
  });
});

describe('notification preference contract', () => {
  it('rejects duplicate types and email switches for unavailable delivery types', () => {
    const p = { notificationType: 'task_assigned', inApp: true, email: false };
    expect(preferencesSchema.safeParse({ preferences: [p, p] }).success).toBe(false);
    expect(preferencesSchema.safeParse({ preferences: [{ ...p, notificationType: 'system', email: true }] }).success).toBe(false);
    expect(preferencesSchema.safeParse({ preferences: [{ ...p, notificationType: 'system' }] }).success).toBe(true);
    expect(preferencesSchema.safeParse({ preferences: [{ ...p, email: true }] }).success).toBe(true);
  });
});
