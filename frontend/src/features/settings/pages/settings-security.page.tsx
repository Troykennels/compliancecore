import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Shield, Smartphone, LogOut, Loader2, AlertTriangle, RefreshCw, Monitor,
} from 'lucide-react';
import { SettingsLayout } from '../components/settings-layout';
import { MfaSetup } from '../components/mfa-setup';
import { authApi } from '@/features/auth/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgFormat } from '@/lib/org-format';
import { PATHS } from '@/routes/paths';

// Security settings surface account-level MFA and session management, which are
// handled by the auth module API (/api/auth/sessions, /api/auth/change-password).

export function SettingsSecurityPage(): JSX.Element {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const fmt = useOrgFormat();

  const [showSessions, setShowSessions] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // ── Account state (drives the 2FA enabled/disabled view) ───────────────────
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me().then((r) => r.data.data),
  });

  // ── Active sessions ────────────────────────────────────────────────────────
  const sessionsQuery = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => authApi.getSessions().then((r) => r.data.data),
    enabled: showSessions,
  });

  const revokeSession = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => {
      toast.success('Session revoked.');
      sessionsQuery.refetch();
    },
    onError: () => toast.error('Failed to revoke session.'),
  });

  // ── Sign out everywhere ────────────────────────────────────────────────────
  const logoutAll = useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSuccess: () => {
      clearAuth();
      navigate(PATHS.LOGIN);
    },
    onError: () => toast.error('Failed to sign out of all sessions.'),
  });

  function handleSignOutAll() {
    if (window.confirm('Sign out from all sessions? You will be logged out now.')) {
      logoutAll.mutate();
    }
  }

  // ── Change password ────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success('Password changed.');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      toast.error(err.response?.data?.error?.message ?? 'Failed to change password.');
    },
  });

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    changePassword.mutate();
  }

  const inputCls =
    'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600';

  return (
    <SettingsLayout>
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Security</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Manage authentication and access security settings.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {/* MFA enrolment. The setup flow renders inline below the row, so
                the QR code and backup codes have room to breathe. */}
            <SecurityItem
              icon={Smartphone}
              title="Two-Factor Authentication"
              description="Add an extra layer of protection to your account with TOTP-based 2FA."
              action={
                <MfaSetup
                  enabled={meQuery.data?.mfaEnabled ?? false}
                  onChanged={() => void meQuery.refetch()}
                />
              }
            />

            {/* Active Sessions */}
            <SecurityItem
              icon={Shield}
              title="Active Sessions"
              description="View and revoke active sessions across your devices."
              action={
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowSessions((v) => !v)}
                >
                  {showSessions ? 'Hide Sessions' : 'View Sessions'}
                </button>
              }
            />

            {showSessions && (
              <div className="px-6 py-5">
                {sessionsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  </div>
                ) : sessionsQuery.isError ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-6 text-center text-slate-500">
                    <AlertTriangle className="h-7 w-7 text-slate-300" />
                    <p className="text-sm">Failed to load sessions.</p>
                    <button
                      onClick={() => sessionsQuery.refetch()}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Retry
                    </button>
                  </div>
                ) : !sessionsQuery.data?.length ? (
                  <p className="py-4 text-center text-sm text-slate-400">No active sessions.</p>
                ) : (
                  <ul className="space-y-2">
                    {sessionsQuery.data.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3"
                      >
                        <Monitor className="h-4 w-4 shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {s.userAgent ?? 'Unknown device'}
                            {s.isCurrent && (
                              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                This device
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {s.ipAddress ?? 'Unknown IP'} · Last active{' '}
                            {fmt.formatDateTime(s.lastActiveAt)}
                          </p>
                        </div>
                        {!s.isCurrent && (
                          <button
                            type="button"
                            onClick={() => revokeSession.mutate(s.id)}
                            disabled={revokeSession.isPending}
                            className="shrink-0 rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Sign Out All */}
            <SecurityItem
              icon={LogOut}
              title="Sign Out Everywhere"
              description="Sign out from all devices and browsers. You will need to sign in again."
              action={
                <button
                  type="button"
                  onClick={handleSignOutAll}
                  disabled={logoutAll.isPending}
                  className="flex items-center gap-1.5 rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  {logoutAll.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sign Out All
                </button>
              }
            />
          </div>
        </section>

        {/* Password */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Password</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Change Password</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Use a strong password that you don&apos;t use elsewhere.
                </p>
              </div>
              {!showPasswordForm && (
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(true)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Change Password
                </button>
              )}
            </div>

            {showPasswordForm && (
              <form onSubmit={handleChangePassword} className="mt-5 max-w-md space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Current password</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">New password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Confirm new password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={changePassword.isPending}
                    className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Update Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </SettingsLayout>
  );
}

interface SecurityItemProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action: React.ReactNode;
}

function SecurityItem({ icon: Icon, title, description, action }: SecurityItemProps): JSX.Element {
  return (
    <div className="flex items-center gap-4 px-6 py-5">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
        <Icon className="h-5 w-5 text-slate-500" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  );
}
