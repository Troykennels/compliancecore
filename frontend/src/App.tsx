import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuthStore } from './stores/auth.store';
import { setAccessToken } from './lib/api-client';
import { authApi } from './features/auth/api/auth.api';
import { ProtectedRoute, PublicOnlyRoute } from './routes/protected.routes';
import { AppShell } from './components/app-shell';
import { PATHS } from './routes/paths';
import { LoginPage } from './features/auth/pages/login.page';
import { RegisterPage } from './features/auth/pages/register.page';
import { ForgotPasswordPage } from './features/auth/pages/forgot-password.page';
import { ResetPasswordPage } from './features/auth/pages/reset-password.page';
import { OnboardingPage } from './features/organizations/pages/onboarding.page';
import { EmailVerificationPage } from './features/auth/pages/email-verification.page';
import { BranchesPage } from './features/branches/pages/branches.page';
import { DepartmentsPage } from './features/departments/pages/departments.page';
import { SettingsOrgPage } from './features/settings/pages/settings-org.page';
import { SettingsTeamPage } from './features/settings/pages/settings-team.page';
import { SettingsSecurityPage } from './features/settings/pages/settings-security.page';
import { SettingsSsoPage } from './features/settings/pages/settings-sso.page';
import { SettingsApiKeysPage } from './features/settings/pages/settings-api-keys.page';
import { SettingsWebhooksPage } from './features/settings/pages/settings-webhooks.page';
import { SettingsNotificationsPage } from './features/settings/pages/settings-notifications.page';
import { SettingsBillingPage } from './features/settings/pages/settings-billing.page';
import { EvidencePage } from './features/evidence/pages/evidence.page';
import { EvidenceDetailPage } from './features/evidence/pages/evidence-detail.page';
import { EvidenceSharedPage } from './features/evidence/pages/evidence-shared.page';
import { CalendarPage } from './features/calendar/pages/calendar.page';
import { ExpiryPage } from './features/expiry/pages/expiry.page';
import { NotificationsPage } from './features/notifications/pages/notifications.page';
import { ScorePage } from './features/compliance-score/pages/score.page';
import { DashboardPage } from './features/dashboard/pages/dashboard.page';
import { ApprovalsPage } from './features/approvals/pages/approvals.page';
import { ApprovalDetailPage } from './features/approvals/pages/approval-detail.page';
import { SignaturesPage } from './features/signatures/pages/signatures.page';
import { TasksPage } from './features/tasks/pages/tasks.page';
import { TaskDetailPage } from './features/tasks/pages/task-detail.page';
import { EscalationsPage } from './features/escalations/pages/escalations.page';
import { AiToolsPage } from './features/ai/pages/ai-tools.page';
import { ExecutiveDashboardPage } from './features/reports/pages/executive-dashboard.page';
import { BillingOverviewPage } from './features/billing/pages/billing-overview.page';
import { BillingPlansPage } from './features/billing/pages/billing-plans.page';
import { BillingInvoicesPage } from './features/billing/pages/billing-invoices.page';
import { BillingPaymentMethodsPage } from './features/billing/pages/billing-payment-methods.page';
import { BillingAdminPage } from './features/billing/pages/billing-admin.page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

// Attempt a silent token refresh on every app load.
// If the httpOnly refresh cookie is present and valid, restores auth state.
function AuthInitialiser({ children }: { children: React.ReactNode }): JSX.Element {
  const { setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    authApi
      .refresh()
      .then(async (refreshRes) => {
        const newToken = refreshRes.data.data.accessToken;
        setAccessToken(newToken);
        const meRes = await authApi.me();
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
          },
          newToken,
          u.tenants[0] ?? null,
          u.tenants,
        );
      })
      .catch(() => {
        clearAuth();
      });
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

export default function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthInitialiser>
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
                <Route path={PATHS.CONTROLS}     element={<PlaceholderPage title="Controls" />} />
                <Route path={PATHS.FRAMEWORKS}   element={<PlaceholderPage title="Frameworks" />} />
                <Route path={PATHS.EVIDENCE}     element={<EvidencePage />} />
                <Route path="/evidence/:id"      element={<EvidenceDetailPage />} />
                <Route path={PATHS.POLICIES}     element={<PlaceholderPage title="Policies" />} />
                <Route path={PATHS.RISKS}        element={<PlaceholderPage title="Risk Register" />} />
                <Route path={PATHS.VENDORS}      element={<PlaceholderPage title="Vendors" />} />
                <Route path={PATHS.AUDITS}       element={<PlaceholderPage title="Audits" />} />
                <Route path={PATHS.TRAINING}     element={<PlaceholderPage title="Training" />} />
                <Route path={PATHS.INCIDENTS}    element={<PlaceholderPage title="Incidents" />} />
                <Route path={PATHS.ANALYTICS}    element={<PlaceholderPage title="Analytics" />} />
                <Route path={PATHS.REPORTS}      element={<ExecutiveDashboardPage />} />

                {/* Billing (Phase 13) */}
                <Route path={PATHS.BILLING}                  element={<BillingOverviewPage />} />
                <Route path={PATHS.BILLING_PLANS}            element={<BillingPlansPage />} />
                <Route path={PATHS.BILLING_INVOICES}         element={<BillingInvoicesPage />} />
                <Route path={PATHS.BILLING_PAYMENT_METHODS}  element={<BillingPaymentMethodsPage />} />
                <Route path={PATHS.BILLING_ADMIN}            element={<BillingAdminPage />} />
                <Route path={PATHS.INTEGRATIONS} element={<PlaceholderPage title="Integrations" />} />

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
        </AuthInitialiser>
      </BrowserRouter>

      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}

// Temporary placeholder — each feature module implements its own page
function PlaceholderPage({ title }: { title: string }): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-slate-400">{title} — coming soon</p>
    </div>
  );
}
