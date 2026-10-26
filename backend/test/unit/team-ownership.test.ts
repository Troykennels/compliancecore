import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findMembership: vi.fn(), countActiveOwners: vi.fn(), updateMemberRole: vi.fn(), deactivateMember: vi.fn(), revoke: vi.fn() }));
vi.mock('../../src/modules/settings/settings.repository', () => ({ settingsRepository: mocks }));
vi.mock('../../src/lib/prisma', () => ({ prisma: {} }));
vi.mock('../../src/lib/token-revocation', () => ({ revokeUserTokens: mocks.revoke }));
vi.mock('../../src/lib/email', () => ({ email: {} }));
vi.mock('../../src/middleware/audit.middleware', () => ({ setAuditSessionVars: vi.fn() }));
import { settingsService } from '../../src/modules/settings/settings.service';
const actor = (role: string) => ({ id: 'actor', email: 'actor@example.invalid', role, tenantId: 'tenant-a' });
beforeEach(() => { vi.resetAllMocks(); mocks.findMembership.mockResolvedValue({ role: 'owner', userId: 'target' }); mocks.countActiveOwners.mockResolvedValue(2); });
describe('Team ownership boundaries', () => {
 for (const role of ['admin', 'compliance_manager', 'control_owner', 'auditor', 'viewer', 'msp_admin', 'msp_analyst']) {
  it(role + ' cannot demote an existing co-owner', async () => { await expect(settingsService.team.updateMemberRole('tenant-a', 'member', {role:'viewer'}, actor(role))).rejects.toThrow('Only an owner'); expect(mocks.updateMemberRole).not.toHaveBeenCalled(); expect(mocks.revoke).not.toHaveBeenCalled(); });
  it(role + ' cannot remove an existing co-owner', async () => { await expect(settingsService.team.removeMember('tenant-a', 'member', actor(role))).rejects.toThrow('Only an owner'); expect(mocks.deactivateMember).not.toHaveBeenCalled(); });
 }
 it('owner cannot demote the last owner', async () => { mocks.countActiveOwners.mockResolvedValue(1); await expect(settingsService.team.updateMemberRole('tenant-a','member',{role:'viewer'},actor('owner'))).rejects.toThrow('last owner'); expect(mocks.updateMemberRole).not.toHaveBeenCalled(); });
 it('owner cannot remove the last owner', async () => { mocks.countActiveOwners.mockResolvedValue(1); await expect(settingsService.team.removeMember('tenant-a','member',actor('owner'))).rejects.toThrow('last owner'); expect(mocks.deactivateMember).not.toHaveBeenCalled(); });
 it('authorised co-owner demotion revokes old sessions', async () => { await settingsService.team.updateMemberRole('tenant-a','member',{role:'viewer'},actor('owner')); expect(mocks.updateMemberRole).toHaveBeenCalledWith('member','viewer'); expect(mocks.revoke).toHaveBeenCalledWith('target','role changed to viewer'); });
 it('authorised co-owner removal revokes sessions', async () => { await settingsService.team.removeMember('tenant-a','member',actor('owner')); expect(mocks.deactivateMember).toHaveBeenCalledWith('member'); expect(mocks.revoke).toHaveBeenCalledWith('target','removed from organisation'); });
 it('cannot act on a membership outside the tenant', async () => { mocks.findMembership.mockResolvedValue(null); await expect(settingsService.team.removeMember('tenant-a','foreign',actor('owner'))).rejects.toThrow('not found'); expect(mocks.deactivateMember).not.toHaveBeenCalled(); });
 it('administrator cannot promote a normal member to owner', async () => { mocks.findMembership.mockResolvedValue({role:'viewer',userId:'target'}); await expect(settingsService.team.updateMemberRole('tenant-a','member',{role:'owner'},actor('admin'))).rejects.toThrow('Only owners'); expect(mocks.updateMemberRole).not.toHaveBeenCalled(); });
});
