import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';

type SupportedPushPlatform =
  | 'android'
  | 'ios';

export type RegisterPushSubscriptionInput = {
  expoPushToken: string;
  projectId?: string | null;
  appVersion?: string | null;
  platform?: SupportedPushPlatform;
};

const REMEMBERED_PUSH_TOKEN_STORAGE_KEY =
  '@navienty-now/remembered-expo-push-token-v1';

function normalizeNullableText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function resolvePushPlatform(
  platform?: SupportedPushPlatform,
): SupportedPushPlatform {
  if (platform) {
    return platform;
  }

  if (
    Platform.OS === 'android' ||
    Platform.OS === 'ios'
  ) {
    return Platform.OS;
  }

  throw new Error(
    'Push notifications are only supported on Android and iOS.',
  );
}

export async function getRememberedPushSubscriptionToken():
  Promise<string | null> {
  try {
    const value =
      await AsyncStorage.getItem(
        REMEMBERED_PUSH_TOKEN_STORAGE_KEY,
      );

    return normalizeNullableText(value);
  } catch {
    return null;
  }
}

async function rememberPushSubscriptionToken(
  expoPushToken: string,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      REMEMBERED_PUSH_TOKEN_STORAGE_KEY,
      expoPushToken,
    );
  } catch (error) {
    console.warn(
      'Unable to persist the Expo push token locally:',
      error,
    );
  }
}

async function forgetPushSubscriptionToken(
  expoPushToken: string,
): Promise<void> {
  try {
    const rememberedToken =
      await getRememberedPushSubscriptionToken();

    if (
      rememberedToken !==
      expoPushToken
    ) {
      return;
    }

    await AsyncStorage.removeItem(
      REMEMBERED_PUSH_TOKEN_STORAGE_KEY,
    );
  } catch (error) {
    console.warn(
      'Unable to clear the remembered Expo push token:',
      error,
    );
  }
}

export async function registerPushSubscription(
  input: RegisterPushSubscriptionInput,
): Promise<string> {
  const expoPushToken =
    input.expoPushToken.trim();

  if (!expoPushToken) {
    throw new Error(
      'Push token is required.',
    );
  }

  const previousToken =
    await getRememberedPushSubscriptionToken();

  const {
    data,
    error,
  } = await supabase.rpc(
    'upsert_customer_push_subscription',
    {
      p_expo_push_token:
        expoPushToken,
      p_platform:
        resolvePushPlatform(
          input.platform,
        ),
      p_project_id:
        normalizeNullableText(
          input.projectId,
        ),
      p_app_version:
        normalizeNullableText(
          input.appVersion,
        ),
    },
  );

  if (error) {
    throw new Error(
      `Push subscription registration failed: ${error.message}`,
    );
  }

  if (
    typeof data !== 'string' ||
    !data.trim()
  ) {
    throw new Error(
      'Push subscription registration returned an invalid ID.',
    );
  }

  await rememberPushSubscriptionToken(
    expoPushToken,
  );

  /**
   * If Expo changed the token for this installation, retire the previous
   * token owned by the same authenticated user. The backend also handles
   * DeviceNotRegistered receipts, but proactive cleanup avoids duplicate
   * sends during a token rollover.
   */
  if (
    previousToken &&
    previousToken !== expoPushToken
  ) {
    try {
      await disablePushSubscription(
        previousToken,
      );
    } catch (error) {
      console.warn(
        'Unable to retire the previous Expo push token:',
        error,
      );
    }
  }

  return data;
}

export async function disablePushSubscription(
  expoPushToken: string,
): Promise<boolean> {
  const normalizedToken =
    expoPushToken.trim();

  if (!normalizedToken) {
    return false;
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    'disable_customer_push_subscription',
    {
      p_expo_push_token:
        normalizedToken,
    },
  );

  if (error) {
    throw new Error(
      `Push subscription disable failed: ${error.message}`,
    );
  }

  /**
   * Clear the local installation marker whenever the owner-scoped RPC
   * completed successfully. A false result can simply mean the row was
   * already inactive or now belongs to a different auth identity; keeping the
   * stale local marker would otherwise cause a disable RPC on every foreground.
   */
  await forgetPushSubscriptionToken(
    normalizedToken,
  );

  return data === true;
}
