import { QueryClient } from '@tanstack/react-query';

// Single shared TanStack Query client. Exported from its own module (rather than
// created inline in App.tsx) so non-React code — e.g. the auth store on logout /
// tenant switch — can clear the cache and prevent one user's/tenant's data from
// bleeding into the next session on a shared device.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});
