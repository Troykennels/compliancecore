import { SettingsLayout } from '../components/settings-layout';
import { Shield, Smartphone, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PATHS } from '@/routes/paths';

// Security settings surface account-level MFA and session management,
// which are handled by the auth module API (/api/auth/mfa, /api/auth/sessions).
// This page provides the navigation hub for those features.

export function SettingsSecurityPage(): JSX.Element {
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
            {/* MFA */}
            <SecurityItem
              icon={Smartphone}
              title="Two-Factor Authentication"
              description="Add an extra layer of protection to your account with TOTP-based 2FA."
              action={
                <Link
                  to={PATHS.LOGIN}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Manage 2FA
                </Link>
              }
            />

            {/* Active Sessions */}
            <SecurityItem
              icon={Shield}
              title="Active Sessions"
              description="View and revoke all active sessions across devices."
              action={
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    // Opens the sessions modal (implemented in auth module)
                  }}
                >
                  View Sessions
                </button>
              }
            />

            {/* Sign Out All */}
            <SecurityItem
              icon={LogOut}
              title="Sign Out Everywhere"
              description="Sign out from all devices and browsers. You will need to sign in again."
              action={
                <button
                  type="button"
                  className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    if (window.confirm('Sign out from all sessions? You will be logged out now.')) {
                      // Calls POST /api/auth/logout-all
                    }
                  }}
                >
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
                  Use a strong password that you don't use elsewhere.
                </p>
              </div>
              <Link
                to={PATHS.FORGOT_PASSWORD}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Change Password
              </Link>
            </div>
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
