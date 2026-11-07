import { QueryCache, QueryClient } from '@tanstack/react-query';
import { logMobileClientError } from '../services/mobile-error-telemetry-service';
import { isRetryablePublicQueryError } from './user-facing-error';

const loggedQueryErrors = new Map<string, number>();
const ERROR_REPORT_COOLDOWN_MS = 60_000;

export const appQueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only public catalog queries are migrated so far. Avoid accidentally
      // sending future personal/account query errors via this reporting path.
      if (query.queryKey[0] !== 'public') return;
      const now = Date.now();
      const fingerprint = query.queryHash;
      const lastReported = loggedQueryErrors.get(fingerprint) ?? 0;
      if (now - lastReported < ERROR_REPORT_COOLDOWN_MS) return;
      loggedQueryErrors.set(fingerprint, now);
      void logMobileClientError({ source: 'manual', error });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 2 * 60 * 60_000,
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) =>
        failureCount < 2 && isRetryablePublicQueryError(error),
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
    },
  },
});
