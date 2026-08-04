import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShieldCheck, FileText, AlertTriangle,
  BarChart2, Settings, LogOut,
  ChevronDown, Building2, GitBranch, Calendar, Clock, ChevronsLeft,
  ChevronsRight, FileArchive, CheckSquare, ShieldAlert, ListChecks, Sparkles, PieChart,
  CreditCard, Loader2, ScrollText, Flame, Store, ClipboardCheck, GraduationCap,
  Library, TrendingUp, Plug, Siren, Menu, X, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { EntitlementBanner } from '@/components/entitlement-banner';
import { authApi } from '@/features/auth/api/auth.api';
import { PATHS } from '@/routes/paths';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { cn } from '@/lib/utils';

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
      { label: 'Frameworks',        to: PATHS.FRAMEWORKS,         icon: <Library className="h-4 w-4" /> },
      { label: 'Controls',          to: PATHS.CONTROLS,           icon: <ShieldCheck className="h-4 w-4" /> },
      { label: 'Policies',          to: PATHS.POLICIES,           icon: <ScrollText className="h-4 w-4" /> },
      { label: 'Risk Register',     to: PATHS.RISKS,              icon: <Flame className="h-4 w-4" /> },
      { label: 'Incidents',         to: PATHS.INCIDENTS,          icon: <Siren className="h-4 w-4" /> },
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
      { label: 'Analytics',           to: PATHS.ANALYTICS,    icon: <TrendingUp className="h-4 w-4" /> },
    ],
  },
  {
    heading: 'Platform',
    items: [
      { label: 'Integrations',        to: PATHS.INTEGRATIONS, icon: <Plug className="h-4 w-4" /> },
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

// Owner-only navigation. Kept out of NAV_GROUPS so it is never rendered for a
// normal customer: /billing/admin exposes every tenant's billing, and until now
// it had a route but no link, so even the platform owner could only reach it by
// typing the URL. Hiding the link is presentation only — requireSuperadmin on
// the API is what actually enforces access.
const OWNER_NAV_GROUP: NavGroup = {
  heading: 'Platform Owner',
  items: [
    { label: 'Billing Admin', to: PATHS.BILLING_ADMIN, icon: <Building2 className="h-4 w-4" /> },
  ],
};

const COLLAPSE_KEY = 'cc:nav-collapsed';

function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-7 w-7 text-2xs' : 'h-8 w-8 text-xs';
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={cn(dim, 'rounded-full object-cover')} />;
  }
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div
      // Decorative: the name is always rendered next to it or available as a
      // label, so announcing the initials twice adds nothing.
      aria-hidden="true"
      className={cn(
        dim,
        'flex shrink-0 items-center justify-center rounded-full bg-brand-600 font-semibold text-white ring-2 ring-white',
      )}
    >
      {initials}
    </div>
  );
}

export function AppShell() {
  // Restore the rail state across sessions — someone who collapsed it wants it
  // collapsed tomorrow too.
  const [collapsed, setCollapsed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(COLLAPSE_KEY) === '1',
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { user, activeTenant, allTenants, clearAuth, switchTenant } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const orgMenuRef = useRef<HTMLDivElement>(null);

  // Only worth a dropdown when there is somewhere else to go.
  const canSwitch = allTenants.length > 1;

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  // Navigating on a phone should dismiss the drawer, otherwise the page you
  // just chose is hidden behind it.
  useEffect(() => {
    setMobileOpen(false);
    setOrgMenuOpen(false);
  }, [location.pathname]);

  // The drawer is a modal layer: it must not scroll the page behind it.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [mobileOpen]);

  // Escape closes whatever overlay is open, innermost first.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (orgMenuOpen) setOrgMenuOpen(false);
      else if (mobileOpen) setMobileOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [orgMenuOpen, mobileOpen]);

  // Clicking away from the organisation menu closes it — the previous version
  // stayed open until you clicked the trigger again.
  useEffect(() => {
    if (!orgMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!orgMenuRef.current?.contains(e.target as Node)) setOrgMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [orgMenuOpen]);

  const handleSwitchTenant = useCallback(
    async (tenantId: string) => {
      setOrgMenuOpen(false);
      if (tenantId === activeTenant?.id) return;
      setSwitching(true);
      try {
        await switchTenant(tenantId);
        // Land on the dashboard: the previous page may have been a detail route
        // whose record belongs to the organisation we just left.
        navigate(PATHS.DASHBOARD);
      } catch {
        toast.error('Could not switch organization.');
      } finally {
        setSwitching(false);
      }
    },
    [activeTenant?.id, switchTenant, navigate],
  );

  // Append the owner group only for a platform superadmin, so customers never
  // see a link into cross-tenant billing.
  const navGroups = user?.isSuperadmin ? [...NAV_GROUPS, OWNER_NAV_GROUP] : NAV_GROUPS;

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    navigate(PATHS.LOGIN);
  }

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'User';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium',
      'transition-colors duration-150',
      isActive
        ? 'bg-brand-50 text-brand-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      collapsed && 'lg:justify-center lg:px-0',
    );

  /** The rail contents, shared by the desktop sidebar and the mobile drawer. */
  const sidebarBody = (
    <>
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-3">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 shadow-xs',
            collapsed && 'lg:mx-auto',
          )}
        >
          <ShieldCheck className="h-4 w-4 text-white" strokeWidth={2.25} />
        </div>
        <span
          className={cn(
            'text-sm font-semibold tracking-tight text-slate-900',
            collapsed && 'lg:hidden',
          )}
        >
          ComplianceCore
        </span>

        {/* Collapse toggle — desktop only; the drawer has its own close button. */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'ml-auto hidden rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 lg:block',
            collapsed && 'lg:hidden',
          )}
          aria-label="Collapse sidebar"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        {/* Close, drawer only. */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Organisation switcher */}
      {activeTenant && (
        <div ref={orgMenuRef} className={cn('relative border-b border-slate-200 p-2', collapsed && 'lg:hidden')}>
          <button
            type="button"
            onClick={() => canSwitch && setOrgMenuOpen((o) => !o)}
            disabled={!canSwitch || switching}
            aria-haspopup={canSwitch ? 'menu' : undefined}
            aria-expanded={canSwitch ? orgMenuOpen : undefined}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
              canSwitch ? 'hover:bg-slate-100' : 'cursor-default',
              'disabled:opacity-60',
            )}
            title={canSwitch ? 'Switch organization' : activeTenant.name}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-800">
                {activeTenant.name}
              </span>
              <span className="block truncate text-2xs text-slate-400">
                {canSwitch ? `${allTenants.length} organizations` : 'Organization'}
              </span>
            </span>
            {switching
              ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
              : canSwitch && (
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200',
                    orgMenuOpen && 'rotate-180',
                  )}
                />
              )}
          </button>

          {orgMenuOpen && canSwitch && (
            <ul
              role="menu"
              className="absolute left-2 right-2 top-full z-30 mt-1 max-h-72 animate-scale-in overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
            >
              {allTenants.map((t) => {
                const isCurrent = t.id === activeTenant.id;
                return (
                  <li key={t.id} role="none">
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => handleSwitchTenant(t.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                        isCurrent ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{t.name}</span>
                        <span className="block truncate text-2xs font-normal uppercase tracking-wide text-slate-400">
                          {t.role.replace(/_/g, ' ')}
                        </span>
                      </span>
                      {isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-2 py-3">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.heading && (
              <p className={cn('eyebrow mb-1 px-2.5', collapsed && 'lg:sr-only')}>{group.heading}</p>
            )}
            {/* A hairline stands in for the heading when the rail is collapsed,
                so the groups stay distinguishable without their labels. */}
            {group.heading && collapsed && (
              <div className="mx-auto mb-2 hidden h-px w-5 bg-slate-200 lg:block" aria-hidden="true" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  // Closing on a pathname change is not enough: tapping the
                  // entry for the page you are already on changes nothing, so
                  // the drawer would sit there over the content you asked for.
                  onClick={() => setMobileOpen(false)}
                  className={navLinkClass}
                >
                  {({ isActive }) => (
                    <>
                      {/* Active marker on the rail edge — reads instantly in
                          peripheral vision, and works when collapsed. */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-600 transition-opacity duration-150',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className={cn('shrink-0', isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')}>
                        {item.icon}
                      </span>
                      <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Settings, sign out, identity */}
      <div className="shrink-0 space-y-0.5 border-t border-slate-200 p-2">
        <NavLink
          to={PATHS.SETTINGS}
          title={collapsed ? 'Settings' : undefined}
          onClick={() => setMobileOpen(false)}
          className={navLinkClass}
        >
          <Settings className="h-4 w-4 shrink-0 text-slate-400" />
          <span className={cn(collapsed && 'lg:hidden')}>Settings</span>
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? 'Log out' : undefined}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900',
            collapsed && 'lg:justify-center lg:px-0',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0 text-slate-400" />
          <span className={cn(collapsed && 'lg:hidden')}>Log out</span>
        </button>

        <div className={cn('mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2', collapsed && 'lg:justify-center lg:px-0')}>
          <UserAvatar name={displayName} avatarUrl={user?.avatarUrl} size="sm" />
          <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
            <p className="truncate text-xs font-semibold text-slate-900">{displayName}</p>
            <p className="truncate text-2xs text-slate-500">{user?.email}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-50">
      {/* Lets a keyboard user reach the page without tabbing the whole rail —
          around 40 stops on this navigation. */}
      <a
        href="#main-content"
        className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop rail */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-slate-200 bg-white lg:flex',
          'transition-[width] duration-200 ease-out',
          collapsed ? 'w-[3.75rem]' : 'w-60',
        )}
      >
        {sidebarBody}
      </aside>

      {/* Expand affordance when collapsed — the toggle inside the rail is
          hidden at that width, so without this there is no way back out. */}
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="absolute bottom-4 left-3 z-20 hidden rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 shadow-sm transition-colors hover:text-slate-700 lg:block"
          aria-label="Expand sidebar"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      )}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-[17rem] max-w-[85vw] animate-slide-in-left flex-col border-r border-slate-200 bg-white shadow-2xl"
          >
            {sidebarBody}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="-ml-1 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* On a phone the rail is hidden, so the header carries the context of
              which organisation you are acting in. Getting this wrong in a
              multi-tenant tool means editing the wrong company's records. */}
          <span className="min-w-0 truncate text-sm font-semibold text-slate-800 lg:hidden">
            {activeTenant?.name ?? 'ComplianceCore'}
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <NotificationBell />
            <div className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <button
              type="button"
              onClick={() => navigate(PATHS.SETTINGS)}
              className="flex items-center gap-2 rounded-full p-0.5 transition-opacity hover:opacity-80"
              aria-label="Account settings"
              title={displayName}
            >
              <UserAvatar name={displayName} avatarUrl={user?.avatarUrl} />
            </button>
          </div>
        </header>

        {/* Subscription state. Outside <main> so it stays visible while a page
            scrolls, and renders nothing at all on a healthy subscription. */}
        <EntitlementBanner />

        {/* Page content. overflow-y-auto so pages that don't manage their own
            scroll still scroll. The inner Suspense keeps the sidebar/topbar
            mounted while a lazy page chunk loads (no full-screen white flash —
            only the content area shows the spinner). */}
        <main id="main-content" className="flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center" role="status">
                <span className="sr-only">Loading page</span>
                <Loader2 className="h-7 w-7 animate-spin text-brand-600" aria-hidden="true" />
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
