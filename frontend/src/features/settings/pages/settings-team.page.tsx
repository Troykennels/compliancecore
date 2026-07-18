import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  UserPlus, MoreHorizontal, Trash2, ChevronDown, CheckCircle2, Clock, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { settingsApi } from '../api/settings.api';
import { ROLE_LABELS, type MemberRole } from '../types/settings.types';
import { InviteMemberModal } from '../components/invite-member-modal';
import { SettingsLayout } from '../components/settings-layout';
import { useCurrentUser, useUserRole } from '@/stores/auth.store';

const ROLE_BADGE: Record<MemberRole, string> = {
  owner:              'bg-indigo-100 text-indigo-700',
  admin:              'bg-violet-100 text-violet-700',
  compliance_manager: 'bg-sky-100 text-sky-700',
  control_owner:      'bg-amber-100 text-amber-700',
  auditor:            'bg-slate-100 text-slate-600',
  viewer:             'bg-slate-100 text-slate-500',
};

const ASSIGNABLE_ROLES: MemberRole[] = [
  'admin', 'compliance_manager', 'control_owner', 'auditor', 'viewer',
];

export function SettingsTeamPage(): JSX.Element {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const currentUser = useCurrentUser();
  const myRole = useUserRole();
  const canManage = myRole === 'owner' || myRole === 'admin';

  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['settings', 'team'],
    queryFn: () => settingsApi.listMembers().then((r) => r.data.data.members),
  });

  const { mutate: updateRole } = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      settingsApi.updateMemberRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'team'] });
      toast.success('Role updated.');
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to update role.');
    },
  });

  const { mutate: removeMember, isPending: isRemoving } = useMutation({
    mutationFn: (membershipId: string) => settingsApi.removeMember(membershipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'team'] });
      toast.success('Member removed.');
      setConfirmRemoveId(null);
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to remove member.');
    },
  });

  return (
    <SettingsLayout>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Team Members</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Manage who has access to your organisation.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-slate-500">
            <AlertTriangle className="h-8 w-8 text-slate-300" />
            <p className="text-sm">Failed to load team members.</p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-slate-500">Member</th>
                <th className="px-6 py-3 text-left font-medium text-slate-500">Role</th>
                <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                <th className="px-6 py-3 text-left font-medium text-slate-500">Joined</th>
                {canManage && (
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data ?? []).map((member) => {
                const isMe = member.userId === currentUser?.id;
                return (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 flex-shrink-0">
                          {(member.firstName?.[0] ?? member.email[0]).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">
                            {member.firstName && member.lastName
                              ? `${member.firstName} ${member.lastName}`
                              : member.email}
                            {isMe && (
                              <span className="ml-1.5 text-xs text-slate-400">(you)</span>
                            )}
                          </div>
                          {(member.firstName || member.lastName) && (
                            <div className="text-xs text-slate-400">{member.email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {canManage && !isMe && member.role !== 'owner' ? (
                        <div className="relative inline-block">
                          <select
                            value={member.role}
                            onChange={(e) =>
                              updateRole({ id: member.id, role: e.target.value })
                            }
                            className="appearance-none rounded-md bg-transparent py-1 pl-2.5 pr-7 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        </div>
                      ) : (
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', ROLE_BADGE[member.role])}>
                          {ROLE_LABELS[member.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {member.emailVerifiedAt ? (
                        <div className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Active
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <Clock className="h-3.5 w-3.5" /> Pending
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {member.joinedAt
                        ? new Date(member.joinedAt).toLocaleDateString()
                        : '—'}
                    </td>
                    {canManage && (
                      <td className="px-4 py-4 text-right">
                        {!isMe && (
                          <div className="relative inline-block">
                            <button
                              onClick={() => setMenuOpenId(menuOpenId === member.id ? null : member.id)}
                              className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {menuOpenId === member.id && (
                              <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                                <button
                                  onClick={() => { setConfirmRemoveId(member.id); setMenuOpenId(null); }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="h-4 w-4" /> Remove
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      {confirmRemoveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmRemoveId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Remove Member?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will revoke their access to your organisation immediately.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmRemoveId(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => removeMember(confirmRemoveId)}
                disabled={isRemoving}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isRemoving ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
