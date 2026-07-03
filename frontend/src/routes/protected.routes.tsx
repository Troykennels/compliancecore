import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { PATHS } from './paths';

export function ProtectedRoute(): JSX.Element {
  const { isAuthenticated, isInitialising, user } = useAuthStore();
  const location = useLocation();

  if (isInitialising) {
    // Show a blank screen while the initial token refresh check completes.
    // A full-page skeleton is handled in App.tsx before routes render.
    return <></>;
  }

  if (!isAuthenticated) {
    return <Navigate to={PATHS.LOGIN} state={{ from: location }} replace />;
  }

  // Redirect to onboarding if the user hasn't completed it
  if (!user?.onboardingCompletedAt && location.pathname !== PATHS.ONBOARDING) {
    return <Navigate to={PATHS.ONBOARDING} replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute(): JSX.Element {
  const { isAuthenticated, isInitialising } = useAuthStore();
  const location = useLocation();

  if (isInitialising) return <></>;

  if (isAuthenticated) {
    const from = (location.state as { from?: Location })?.from?.pathname ?? PATHS.DASHBOARD;
    return <Navigate to={from} replace />;
  }

  return <Outlet />;
}
