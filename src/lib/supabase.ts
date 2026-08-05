import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    createClient,
    processLock,
} from '@supabase/supabase-js';
import {
    AppState,
    Platform,
} from 'react-native';
import 'react-native-url-polyfill/auto';

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
       * Expo Router renders web routes in a Node.js
       * environment where `window` does not exist.
       *
       * AsyncStorage must therefore be provided only
       * on Android and iOS. On the browser, Supabase
       * uses its normal browser storage.
       */
      ...(Platform.OS !== 'web'
        ? {
            storage: AsyncStorage,
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
