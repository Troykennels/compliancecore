import { hasPermission } from '@/config/role-permissions';
import { PageHeader } from '@/components/page-header';
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
  { label: 'API keys',       path: PATHS.SETTINGS_API_KEYS,      icon: Key,     requiresRole: ['owner', 'admin'] },
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
    (item) => (item.path===PATHS.SETTINGS_SECURITY || hasPermission(role??undefined,item.path===PATHS.SETTINGS_TEAM?'team:read':item.path===PATHS.SETTINGS_ORG?'org:read':'settings:read')) && (!item.requiresRole || Boolean(role && item.requiresRole.includes(role))),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="mb-6"><PageHeader eyebrow="Settings" title={NAV_ITEMS.find(item => pathname === item.path)?.label ?? 'Settings'} description="Your account and authorised organisation settings." /></div>

        <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
          {/* Left Nav */}
          <aside className="w-full shrink-0 lg:w-56">
            <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:block lg:space-y-0.5" aria-label="Settings pages">
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
          <section className="min-w-0 flex-1">
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
