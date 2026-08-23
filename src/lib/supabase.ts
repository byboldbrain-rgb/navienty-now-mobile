import { createClient } from '@supabase/supabase-js';
import {
    AppState,
    Platform,
} from 'react-native';
import 'react-native-url-polyfill/auto';

import { secureAuthStorage } from './secure-auth-storage';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  process.env
    .EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL.',
  );
}

if (!supabasePublishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    db: {
      schema: 'now',
    },

    auth: {
      /*
       * Native sessions are persisted through SecureStore-backed chunked
       * storage. Existing AsyncStorage sessions migrate lazily on first read
       * so an app update does not sign current customers out.
       *
       * Expo Router also renders web routes in environments where the native
       * SecureStore API is unavailable. On web, omit the custom adapter and
       * let Supabase use its normal browser storage behavior.
       */
      ...(Platform.OS !== 'web'
        ? {
            storage:
              secureAuthStorage,
          }
        : {}),

      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

/**
 * Public storefront data must not wait for persisted Auth state to hydrate.
 *
 * These reads use database functions/tables that are explicitly available to
 * the anon role and remain protected by their grants and RLS policies. Passing
 * a null access token keeps this client independent from the native Auth
 * storage/refresh lifecycle while the main client continues to own sessions.
 */
export const publicSupabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    db: {
      schema: 'now',
      timeout: 12_000,
    },
    accessToken: async () => null,
  },
);

if (Platform.OS !== 'web') {
  AppState.addEventListener(
    'change',
    (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    },
  );
}
