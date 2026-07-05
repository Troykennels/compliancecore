import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${env.VITE_API_URL}/api`,
  withCredentials: true, // send httpOnly refresh token cookie
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ─── Request Interceptor: attach access token ──────────────────────────────

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor: silent token refresh on 401 ────────────────────

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)));
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Never attempt a silent refresh for auth endpoints themselves (login,
    // register, refresh, mfa, forgot/reset password) or for public endpoints
    // like the shared-evidence link — there a 401 is meaningful (e.g. "password
    // required") and the calling page must surface it inline.
    const url = originalRequest.url ?? '';
    const isPublicEndpoint = url.includes('/auth/') || url.includes('/evidence/shared/');

    // Only try to refresh when there is actually a (now-expired) session to
    // refresh. A logged-out visitor has no access token, so a 401 must simply
    // propagate — otherwise the refresh fails and hard-redirects public/share
    // pages to /login.
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isPublicEndpoint &&
      getAccessToken()
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${env.VITE_API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const newToken: string = data.data.accessToken;
        setAccessToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAccessToken();
        // Redirect to login — import is dynamic to avoid circular deps
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── In-memory token storage (cleared on tab close) ───────────────────────

let _accessToken: string | null = null;

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setAccessToken(token: string): void {
  _accessToken = token;
}

export function clearAccessToken(): void {
  _accessToken = null;
}
