import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/features/auth/api/auth.api';
import { PATHS } from '@/routes/paths';

/**
 * Signs the user out after a period of inactivity.
 *
 * Without this, the refresh cookie silently restores a session for its full
 * seven-day life: reopening the tab lands you straight in the app with no
 * credential prompt. Convenient, but on a shared or unattended machine it means
 * anyone who opens the browser has the previous user's compliance data — and
 * every framework this product sells against expects an idle timeout. PCI DSS
 * 8.2.8 puts it at 15 minutes; ISO 27001 A.8.1 and SOC 2 CC6.1 expect a defined
 * period. 30 minutes is the default here as a workable balance; tighten it with
 * VITE_IDLE_TIMEOUT_MINUTES where a stricter regime applies.
 *
 * Activity is tracked with passive listeners and a ref rather than state, so a
 * moving mouse never triggers a React render.
 */

const IDLE_MINUTES = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES ?? 30);
const WARN_SECONDS = 60;

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'focus'] as const;

export function IdleTimeout(): JSX.Element | null {
  const navigate = useNavigate();
  const { isAuthenticated, clearAuth } = useAuthStore();
  const lastActivity = useRef(Date.now());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const signOut = useCallback(async () => {
    // Revoke server-side too, so the refresh cookie cannot resurrect the session.
    try { await authApi.logout(); } catch { /* logging out locally matters more */ }
    clearAuth();
    navigate(PATHS.LOGIN, { replace: true });
  }, [clearAuth, navigate]);

  const markActive = useCallback(() => {
    lastActivity.current = Date.now();
    setSecondsLeft((current) => (current === null ? null : null)); // dismiss any warning
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, markActive, { passive: true });
    }

    const idleMs = IDLE_MINUTES * 60_000;
    const warnMs = WARN_SECONDS * 1_000;

    const tick = setInterval(() => {
      const idleFor = Date.now() - lastActivity.current;

      if (idleFor >= idleMs) {
        void signOut();
        return;
      }
      // Inside the final minute, count down visibly rather than logging the user
      // out mid-sentence with no explanation.
      const remaining = idleMs - idleFor;
      setSecondsLeft(remaining <= warnMs ? Math.ceil(remaining / 1000) : null);
    }, 1_000);

    return () => {
      clearInterval(tick);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, markActive);
    };
  }, [isAuthenticated, markActive, signOut]);

  if (!isAuthenticated || secondsLeft === null) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-900">
          You will be signed out in <strong>{secondsLeft}s</strong> for inactivity.
        </p>
        <button
          type="button"
          onClick={markActive}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
        >
          Stay signed in
        </button>
      </div>
    </div>
  );
}
