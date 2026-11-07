import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { type PropsWithChildren, useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { appQueryClient } from '../lib/app-query-client';
import { resilientAsyncStorage } from '../lib/resilient-storage';

const persister = createAsyncStoragePersister({
  storage: resilientAsyncStorage,
  key: 'NAVIENTY_PUBLIC_QUERY_CACHE_V1',
  throttleTime: 2_000,
});

const persistOptions = {
  persister,
  maxAge: 2 * 60 * 60_000,
  buster: 'public-catalog-v1',
  dehydrateOptions: {
    // Never persist authentication, orders, addresses, or customer-specific data.
    // Public supermarket queries opt in explicitly via query.meta.persist.
    shouldDehydrateQuery: (query: { state: { status: string }; meta?: Record<string, unknown> }) =>
      query.state.status === 'success' && query.meta?.persist === true,
  },
};

export default function AppQueryProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => {
      subscription.remove();
      focusManager.setFocused(undefined);
    };
  }, []);

  return (
    <PersistQueryClientProvider client={appQueryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
