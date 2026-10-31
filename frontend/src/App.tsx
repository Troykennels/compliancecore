import { useEffect, useState, lazy, Suspense } from 'react';
import { isAxiosError } from 'axios';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from './stores/auth.store';
import { setAccessToken, getAccessToken, getAuthRevision } from './lib/api-client';
import { queryClient } from './lib/query-client';
import { ErrorBoundary } from './components/error-boundary';
import { authApi } from './features/auth/api/auth.api';
import { ProtectedRoute, PublicOnlyRoute } from './routes/protected.routes';
import { AppShell } from './components/app-shell';
import { PATHS } from './routes/paths';

// Route-level code-splitting: each page is its own lazy chunk so the initial
// bundle (login) no longer pulls in the entire app + recharts. Pages are named
// exports, so map them to a default for React.lazy.
const lazyPage = <T extends Record<string, React.ComponentType<unknown>>>(
  loader: () => Promise<T>,
  name: keyof T,
) => lazy(() => loader().then((m) => ({ default: m[name] })));

const GuidePage = lazyPage(() => import('./features/guide/guide.page'), 'GuidePage');
const ComplianceJourneyPage = lazyPage(() => import('./features/journey/compliance-journey.page'), 'ComplianceJourneyPage');
const LoginPage = lazyPage(() => import('./features/auth/pages/login.page'), 'LoginPage');
const RegisterPage = lazyPage(() => import('./features/auth/pages/register.page'), 'RegisterPage');
const ForgotPasswordPage = lazyPage(() => import('./features/auth/pages/forgot-password.page'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyPage(() => import('./features/auth/pages/reset-password.page'), 'ResetPasswordPage');
const OnboardingPage = lazyPage(() => import('./features/organizations/pages/onboarding.page'), 'OnboardingPage');
const EmailVerificationPage = lazyPage(() => import('./features/auth/pages/email-verification.page'), 'EmailVerificationPage');
const BranchesPage = lazyPage(() => import('./features/branches/pages/branches.page'), 'BranchesPage');
const ControlsPage = lazyPage(() => import('./features/controls/pages/controls.page'), 'ControlsPage');
const PoliciesPage = lazyPage(() => import('./features/policies/pages/policies.page'), 'PoliciesPage');
const PolicyTemplatesPage = lazyPage(() => import('./features/policies/pages/policy-templates.page'), 'PolicyTemplatesPage');
const RisksPage = lazyPage(() => import('./features/risks/pages/risks.page'), 'RisksPage');
const VendorsPage = lazyPage(() => import('./features/vendors/pages/vendors.page'), 'VendorsPage');
const IncidentsPage = lazyPage(() => import('./features/incidents/pages/incidents.page'), 'IncidentsPage');
const PrivacyPage = lazyPage(() => import('./features/privacy/privacy.page'), 'PrivacyPage');
const AuditsPage = lazyPage(() => import('./features/audits/pages/audits.page'), 'AuditsPage');
const MspPortfolioPage = lazyPage(() => import('./features/msp/portfolio.page'), 'MspPortfolioPage');
const AuditRoomPage = lazyPage(() => import('./features/audits/pages/audit-room.page'), 'AuditRoomPage');
const TrainingPage = lazyPage(() => import('./features/training/pages/training.page'), 'TrainingPage');
const FrameworksPage = lazyPage(() => import('./features/frameworks/pages/frameworks.page'), 'FrameworksPage');
const AnalyticsPage = lazyPage(() => import('./features/analytics/pages/analytics.page'), 'AnalyticsPage');
const IntegrationsPage = lazyPage(() => import('./features/integrations/pages/integrations.page'), 'IntegrationsPage');
const DepartmentsPage = lazyPage(() => import('./features/departments/pages/departments.page'), 'DepartmentsPage');
const SettingsOrgPage = lazyPage(() => import('./features/settings/pages/settings-org.page'), 'SettingsOrgPage');
const SettingsTeamPage = lazyPage(() => import('./features/settings/pages/settings-team.page'), 'SettingsTeamPage');
const SettingsSecurityPage = lazyPage(() => import('./features/settings/pages/settings-security.page'), 'SettingsSecurityPage');
const SettingsSsoPage = lazyPage(() => import('./features/settings/pages/settings-sso.page'), 'SettingsSsoPage');
const SettingsApiKeysPage = lazyPage(() => import('./features/settings/pages/settings-api-keys.page'), 'SettingsApiKeysPage');
const SettingsWebhooksPage = lazyPage(() => import('./features/settings/pages/settings-webhooks.page'), 'SettingsWebhooksPage');
const SettingsNotificationsPage = lazyPage(() => import('./features/settings/pages/settings-notifications.page'), 'SettingsNotificationsPage');
const SettingsBillingPage = lazyPage(() => import('./features/settings/pages/settings-billing.page'), 'SettingsBillingPage');
const EvidencePage = lazyPage(() => import('./features/evidence/pages/evidence.page'), 'EvidencePage');
const EvidenceDetailPage = lazyPage(() => import('./features/evidence/pages/evidence-detail.page'), 'EvidenceDetailPage');
const EvidenceSharedPage = lazyPage(() => import('./features/evidence/pages/evidence-shared.page'), 'EvidenceSharedPage');
const CalendarPage = lazyPage(() => import('./features/calendar/pages/calendar.page'), 'CalendarPage');
const ExpiryPage = lazyPage(() => import('./features/expiry/pages/expiry.page'), 'ExpiryPage');
const NotificationsPage = lazyPage(() => import('./features/notifications/pages/notifications.page'), 'NotificationsPage');
const ScorePage = lazyPage(() => import('./features/compliance-score/pages/score.page'), 'ScorePage');
const DashboardPage = lazyPage(() => import('./features/dashboard/pages/dashboard.page'), 'DashboardPage');
const ApprovalsPage = lazyPage(() => import('./features/approvals/pages/approvals.page'), 'ApprovalsPage');
const ApprovalDetailPage = lazyPage(() => import('./features/approvals/pages/approval-detail.page'), 'ApprovalDetailPage');
const SignaturesPage = lazyPage(() => import('./features/signatures/pages/signatures.page'), 'SignaturesPage');
const TasksPage = lazyPage(() => import('./features/tasks/pages/tasks.page'), 'TasksPage');
const TaskDetailPage = lazyPage(() => import('./features/tasks/pages/task-detail.page'), 'TaskDetailPage');
const EscalationsPage = lazyPage(() => import('./features/escalations/pages/escalations.page'), 'EscalationsPage');
const AiToolsPage = lazyPage(() => import('./features/ai/pages/ai-tools.page'), 'AiToolsPage');
const ExecutiveDashboardPage = lazyPage(() => import('./features/reports/pages/executive-dashboard.page'), 'ExecutiveDashboardPage');
const BillingOverviewPage = lazyPage(() => import('./features/billing/pages/billing-overview.page'), 'BillingOverviewPage');
const BillingPlansPage = lazyPage(() => import('./features/billing/pages/billing-plans.page'), 'BillingPlansPage');
const BillingInvoicesPage = lazyPage(() => import('./features/billing/pages/billing-invoices.page'), 'BillingInvoicesPage');
const BillingPaymentMethodsPage = lazyPage(() => import('./features/billing/pages/billing-payment-methods.page'), 'BillingPaymentMethodsPage');
const BillingAdminPage = lazyPage(() => import('./features/billing/pages/billing-admin.page'), 'BillingAdminPage');

// Attempt a silent token refresh on every app load.
// If the httpOnly refresh cookie is present and valid, restores auth state.
function AuthInitialiser({ children }: { children: React.ReactNode }): JSX.Element {
  const { setAuth, clearAuth } = useAuthStore();
  const [connectionError,setConnectionError]=useState(false);

  useEffect(() => {
    const initialRevision=getAuthRevision();
    let refreshToken:string|null=null;
    authApi
      .refresh()
      .then(async (refreshRes) => {
        const newToken = refreshRes.data.data.accessToken;
        if(useAuthStore.getState().isAuthenticated||getAccessToken()!==newToken)return;
        refreshToken=newToken;
        setAccessToken(newToken);
        const meRes = await authApi.me();
        if(useAuthStore.getState().isAuthenticated||getAccessToken()!==newToken)return;
        const u = meRes.data.data;
        setAuth(
          {
            id: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            avatarUrl: u.avatarUrl,
            emailVerifiedAt: u.emailVerifiedAt,
            isActive: u.isActive,
            onboardingCompletedAt: u.onboardingCompletedAt,
            // Carried through deliberately. Dropping these made the flags true
            // on login and undefined after any reload, so the owner-only
            // navigation appeared once and then silently disappeared.
            isSuperadmin: u.isSuperadmin,
            mfaEnabled: u.mfaEnabled,
          },
          newToken,
          u.tenants[0] ?? null,
          u.tenants,
        );
      })
      .catch((error:unknown) => {
        if(!isAxiosError(error)||![401,403].includes(error.response?.status??0)){
          if(!useAuthStore.getState().isAuthenticated)setConnectionError(true);
          return;
        }
        // A slow startup refresh must not undo a newer explicit sign-in.
        if(!useAuthStore.getState().isAuthenticated&&(getAuthRevision()===initialRevision||(refreshToken!==null&&getAccessToken()===refreshToken)))clearAuth();
      }).finally(()=>useAuthStore.getState().setInitialised());
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if(connectionError)return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div role="alert" className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-xl font-semibold text-slate-900">Connection interrupted</h1><p className="mt-3 text-sm leading-6 text-slate-600">We could not restore your session because the server could not be reached. Check your connection and try again.</p><button onClick={()=>window.location.reload()} className="mt-5 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Try again</button></div></main>;
  return <>{children}</>;
}

export default function App(): JSX.Element {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthInitialiser>
          {/* Inside the router (it navigates) and outside Routes (it must run on
              every authenticated page, not per-route). */}
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public-only: redirect to dashboard if already logged in */}
            <Route element={<PublicOnlyRoute />}>
              <Route path={PATHS.LOGIN} element={<LoginPage />} />
              <Route path={PATHS.REGISTER} element={<RegisterPage />} />
              <Route path={PATHS.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
              <Route path={PATHS.RESET_PASSWORD} element={<ResetPasswordPage />} />
            </Route>

            {/* Always accessible (no auth required) */}
            <Route path={PATHS.VERIFY_EMAIL} element={<EmailVerificationPage />} />
            <Route path="/evidence/shared/:token" element={<EvidenceSharedPage />} />

            {/* Protected: redirect to login if not authenticated */}
            <Route element={<ProtectedRoute />}>
              {/* Onboarding stands alone (no app shell): the user has no tenant yet. */}
              <Route path={PATHS.ONBOARDING} element={<OnboardingPage />} />
              {/* App shell wraps all authenticated pages (sidebar + topbar) */}
              <Route element={<AppShell />}>
                <Route path={PATHS.DASHBOARD}    element={<DashboardPage />} />
                <Route path="/journey" element={<ComplianceJourneyPage />} />
                <Route path={PATHS.MSP_PORTFOLIO} element={<MspPortfolioPage />} />
                <Route path={PATHS.GUIDE} element={<GuidePage />} />
                <Route path={PATHS.CONTROLS}     element={<ControlsPage />} />
                <Route path={PATHS.FRAMEWORKS}   element={<FrameworksPage />} />
                <Route path={PATHS.EVIDENCE}     element={<EvidencePage />} />
                <Route path="/evidence/:id"      element={<EvidenceDetailPage />} />
                <Route path={PATHS.POLICIES}     element={<PoliciesPage />} />
                <Route path={PATHS.POLICY_TEMPLATES} element={<PolicyTemplatesPage />} />
                <Route path={PATHS.RISKS}        element={<RisksPage />} />
                <Route path={PATHS.VENDORS}      element={<VendorsPage />} />
                <Route path={PATHS.AUDITS}       element={<AuditsPage />} />
                <Route path="/audits/:id" element={<AuditRoomPage />} />
                <Route path={PATHS.TRAINING}     element={<TrainingPage />} />
                <Route path={PATHS.INCIDENTS}    element={<IncidentsPage />} />
                <Route path={PATHS.PRIVACY_ROPA} element={<PrivacyPage />} />
                <Route path={PATHS.PRIVACY_DSAR} element={<PrivacyPage />} />
                <Route path={PATHS.PRIVACY_DPIA} element={<PrivacyPage />} />
                <Route path={PATHS.ANALYTICS}    element={<AnalyticsPage />} />
                <Route path={PATHS.REPORTS}      element={<ExecutiveDashboardPage />} />

                {/* Billing (Phase 13) */}
                <Route path={PATHS.BILLING}                  element={<BillingOverviewPage />} />
                <Route path={PATHS.BILLING_PLANS}            element={<BillingPlansPage />} />
                <Route path={PATHS.BILLING_INVOICES}         element={<BillingInvoicesPage />} />
                <Route path={PATHS.BILLING_PAYMENT_METHODS}  element={<BillingPaymentMethodsPage />} />
                <Route path={PATHS.BILLING_ADMIN}            element={<BillingAdminPage />} />
                <Route path={PATHS.INTEGRATIONS} element={<IntegrationsPage />} />

                {/* Phase 9 modules */}
                <Route path={PATHS.CALENDAR}         element={<CalendarPage />} />
                <Route path={PATHS.EXPIRY}           element={<ExpiryPage />} />
                <Route path={PATHS.NOTIFICATIONS}    element={<NotificationsPage />} />
                <Route path={PATHS.COMPLIANCE_SCORE} element={<ScorePage />} />

                {/* Phase 11 — AI Tools */}
                <Route path={PATHS.AI_TOOLS} element={<AiToolsPage />} />

                {/* Phase 10 modules */}
                <Route path={PATHS.APPROVALS}              element={<ApprovalsPage />} />
                <Route path="/approvals/:id"               element={<ApprovalDetailPage />} />
                <Route path={PATHS.SIGNATURES}             element={<SignaturesPage />} />
                <Route path={PATHS.TASKS}                  element={<TasksPage />} />
                <Route path="/tasks/:id"                   element={<TaskDetailPage />} />
                <Route path={PATHS.ESCALATIONS}            element={<EscalationsPage />} />

                {/* Organization Structure */}
                <Route path={PATHS.BRANCHES}    element={<BranchesPage />} />
                <Route path={PATHS.DEPARTMENTS} element={<DepartmentsPage />} />

                {/* Settings */}
                <Route path={PATHS.SETTINGS} element={<Navigate to={PATHS.SETTINGS_ORG} replace />} />
                <Route path={PATHS.SETTINGS_ORG}           element={<SettingsOrgPage />} />
                <Route path={PATHS.SETTINGS_TEAM}          element={<SettingsTeamPage />} />
                <Route path={PATHS.SETTINGS_SECURITY}      element={<SettingsSecurityPage />} />
                <Route path={PATHS.SETTINGS_SSO}           element={<SettingsSsoPage />} />
                <Route path={PATHS.SETTINGS_API_KEYS}      element={<SettingsApiKeysPage />} />
                <Route path={PATHS.SETTINGS_WEBHOOKS}      element={<SettingsWebhooksPage />} />
                <Route path={PATHS.SETTINGS_NOTIFICATIONS} element={<SettingsNotificationsPage />} />
                <Route path={PATHS.SETTINGS_BILLING}       element={<SettingsBillingPage />} />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to={PATHS.DASHBOARD} replace />} />
            <Route path="*" element={<Navigate to={PATHS.DASHBOARD} replace />} />
          </Routes>
          </Suspense>
        </AuthInitialiser>
      </BrowserRouter>

      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Shown while a lazily-loaded route chunk is being fetched.
function RouteFallback(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );
}

