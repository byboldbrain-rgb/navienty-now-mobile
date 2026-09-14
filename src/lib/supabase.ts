import {
    createClient,
    processLock,
} from '@supabase/supabase-js';
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
      lock: processLock,
    },
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
