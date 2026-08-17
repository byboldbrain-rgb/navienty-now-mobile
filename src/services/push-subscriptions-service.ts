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

  return data === true;
}
