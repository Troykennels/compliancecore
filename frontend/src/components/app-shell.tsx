import React, { useState, Suspense } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShieldCheck, FileText, AlertTriangle,
  BarChart2, Settings, LogOut,
  ChevronDown, Building2, GitBranch, Calendar, Clock, ChevronsLeft,
  ChevronsRight, FileArchive, CheckSquare, ShieldAlert, ListChecks, Sparkles, PieChart,
  CreditCard, Loader2, ScrollText, Flame, Store, ClipboardCheck, GraduationCap,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/features/auth/api/auth.api';
import { PATHS } from '@/routes/paths';
import { NotificationBell } from '@/features/notifications/components/notification-bell';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

interface NavGroup {
  heading?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard',         to: PATHS.DASHBOARD,          icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  },
  {
    heading: 'Compliance',
    items: [
      { label: 'Compliance Score',  to: PATHS.COMPLIANCE_SCORE,   icon: <BarChart2 className="h-4 w-4" /> },
      { label: 'Calendar',          to: PATHS.CALENDAR,           icon: <Calendar className="h-4 w-4" /> },
      { label: 'Expiry Tracker',    to: PATHS.EXPIRY,             icon: <Clock className="h-4 w-4" /> },
    ],
  },
  {
    heading: 'Governance',
    items: [
      { label: 'Controls',          to: PATHS.CONTROLS,           icon: <ShieldCheck className="h-4 w-4" /> },
      { label: 'Policies',          to: PATHS.POLICIES,           icon: <ScrollText className="h-4 w-4" /> },
      { label: 'Risk Register',     to: PATHS.RISKS,              icon: <Flame className="h-4 w-4" /> },
      { label: 'Vendors',           to: PATHS.VENDORS,            icon: <Store className="h-4 w-4" /> },
      { label: 'Evidence Hub',      to: PATHS.EVIDENCE,           icon: <FileArchive className="h-4 w-4" /> },
    ],
  },
  {
    heading: 'Organization',
    items: [
      { label: 'Branches',          to: PATHS.BRANCHES,           icon: <GitBranch className="h-4 w-4" /> },
      { label: 'Departments',       to: PATHS.DEPARTMENTS,        icon: <Building2 className="h-4 w-4" /> },
    ],
  },
  {
    heading: 'Assurance',
    items: [
      { label: 'Audits',            to: PATHS.AUDITS,             icon: <ClipboardCheck className="h-4 w-4" /> },
      { label: 'Training',          to: PATHS.TRAINING,           icon: <GraduationCap className="h-4 w-4" /> },
    ],
  },
  {
    heading: 'Workflows',
    items: [
      { label: 'Tasks',             to: PATHS.TASKS,              icon: <CheckSquare className="h-4 w-4" /> },
      { label: 'Approvals',         to: PATHS.APPROVALS,          icon: <ListChecks className="h-4 w-4" /> },
      { label: 'Signatures',        to: PATHS.SIGNATURES,         icon: <ShieldAlert className="h-4 w-4" /> },
      { label: 'Escalations',       to: PATHS.ESCALATIONS,        icon: <AlertTriangle className="h-4 w-4" /> },
    ],
  },
  {
    heading: 'AI',
    items: [
      { label: 'AI Tools',          to: PATHS.AI_TOOLS,           icon: <Sparkles className="h-4 w-4" /> },
    ],
  },
  {
    heading: 'Reports',
    items: [
      { label: 'Executive Dashboard', to: PATHS.REPORTS,      icon: <PieChart className="h-4 w-4" /> },
    ],
  },
  {
    heading: 'Billing',
    items: [
      { label: 'Billing Overview',  to: PATHS.BILLING,                 icon: <CreditCard className="h-4 w-4" /> },
      { label: 'Plans & Upgrade',   to: PATHS.BILLING_PLANS,           icon: <ShieldCheck className="h-4 w-4" /> },
      { label: 'Invoices',          to: PATHS.BILLING_INVOICES,        icon: <FileText className="h-4 w-4" /> },
    ],
  },
];

function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-8 w-8 rounded-full object-cover" />;
  }
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
      {initials}
    </div>
  );
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, activeTenant, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    navigate(PATHS.LOGIN);
  }

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'User';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-slate-200 bg-white transition-all duration-200 shrink-0 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {/* Logo / brand */}
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3.5 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold text-slate-900">ComplianceCore</span>
            </div>
          )}
          {collapsed && (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 mx-auto">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Org name */}
        {!collapsed && activeTenant && (
          <div className="border-b border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-xs font-medium text-slate-600 truncate">{activeTenant.name}</span>
              <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 ml-auto" />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.heading && !collapsed && (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.heading}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      } ${collapsed ? 'justify-center' : ''}`
                    }
                  >
                    {item.icon}
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Settings + User */}
        <div className="border-t border-slate-100 px-2 py-3 space-y-1 shrink-0">
          <NavLink
            to={PATHS.SETTINGS}
            title={collapsed ? 'Settings' : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <Settings className="h-4 w-4" />
            {!collapsed && <span>Settings</span>}
          </NavLink>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Log out' : undefined}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Log out</span>}
          </button>
          {!collapsed && (
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 mt-1">
              <UserAvatar name={displayName} avatarUrl={user?.avatarUrl} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">{displayName}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-5 py-2.5 shrink-0">
          <NotificationBell />
          <UserAvatar name={displayName} avatarUrl={user?.avatarUrl} />
        </header>

        {/* Page content. overflow-y-auto so pages that don't manage their own
            scroll still scroll. The inner Suspense keeps the sidebar/topbar
            mounted while a lazy page chunk loads (no full-screen white flash —
            only the content area shows the spinner). */}
        <main className="flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
