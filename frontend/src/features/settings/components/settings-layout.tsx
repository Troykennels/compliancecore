import { Link, useLocation } from 'react-router-dom';
import {
  Building2, Users, Shield, Key, Bell, Webhook, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PATHS } from '@/routes/paths';
import { useUserRole } from '@/stores/auth.store';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  requiresRole?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Organisation',   path: PATHS.SETTINGS_ORG,           icon: Building2 },
  { label: 'Team',           path: PATHS.SETTINGS_TEAM,          icon: Users },
  { label: 'Security',       path: PATHS.SETTINGS_SECURITY,      icon: Shield },
  { label: 'SSO',            path: PATHS.SETTINGS_SSO,           icon: Lock,    requiresRole: ['owner', 'admin'] },
  { label: 'API Keys',       path: PATHS.SETTINGS_API_KEYS,      icon: Key,     requiresRole: ['owner', 'admin'] },
  { label: 'Webhooks',       path: PATHS.SETTINGS_WEBHOOKS,      icon: Webhook, requiresRole: ['owner', 'admin'] },
  { label: 'Notifications',  path: PATHS.SETTINGS_NOTIFICATIONS, icon: Bell },
];

interface Props {
  children: React.ReactNode;
}

export function SettingsLayout({ children }: Props): JSX.Element {
  const { pathname } = useLocation();
  const role = useUserRole();

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      !item.requiresRole ||
      (role && item.requiresRole.includes(role)),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your organisation's settings, team, and integrations.
          </p>
        </div>

        <div className="flex gap-8">
          {/* Left Nav */}
          <aside className="w-56 flex-shrink-0">
            <nav className="space-y-0.5">
              {visibleItems.map((item) => {
                const isActive = pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Page Content */}
          <main className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
