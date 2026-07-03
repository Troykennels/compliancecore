import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { PATHS } from '@/routes/paths';
import { authApi } from '../api/auth.api';
import type { LoginRequest } from '../types/auth.types';

interface UseLoginReturn {
  login: (data: LoginRequest) => Promise<{ requiresMfa: boolean; mfaChallengeToken?: string }>;
  isLoading: boolean;
  error: string | null;
}

export function useLogin(): UseLoginReturn {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const mutation = useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data).then((r) => r.data.data),
    onSuccess: (data) => {
      if (data.requiresMfa) return; // caller handles MFA redirect

      setAuth(data.user, data.accessToken, data.activeTenant, data.allTenants);

      if (!data.user.onboardingCompletedAt) {
        navigate(PATHS.ONBOARDING, { replace: true });
      } else {
        navigate(PATHS.DASHBOARD, { replace: true });
      }
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      const message = err.response?.data?.error?.message ?? 'Login failed. Please try again.';
      toast.error(message);
    },
  });

  return {
    login: async (data) => {
      const result = await mutation.mutateAsync(data);
      return {
        requiresMfa: result.requiresMfa,
        mfaChallengeToken: result.mfaChallengeToken,
      };
    },
    isLoading: mutation.isPending,
    error: mutation.error
      ? (mutation.error as { response?: { data?: { error?: { message: string } } } }).response?.data
          ?.error?.message ?? 'Login failed'
      : null,
  };
}

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearAuth();
      navigate(PATHS.LOGIN, { replace: true });
    },
  });
}
