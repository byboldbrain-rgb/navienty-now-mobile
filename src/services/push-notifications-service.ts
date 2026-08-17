import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  ensureAppSession,
} from './anonymous-auth-service';
import {
  registerPushSubscription,
} from './push-subscriptions-service';

export const ORDER_NOTIFICATION_CHANNEL_ID =
  'orders';

type PushRegistrationOptions = {
  requestPermission?: boolean;
  devicePushToken?: Notifications.DevicePushToken;
};

export type PushRegistrationResult =
  | {
      status: 'registered';
      expoPushToken: string;
    }
  | {
      status:
        | 'unsupported'
        | 'permission-not-granted'
        | 'project-id-missing';
      expoPushToken: null;
    };

let registrationPromise:
  | Promise<PushRegistrationResult>
  | null = null;

function isSupportedPlatform() {
  return (
    Platform.OS === 'android' ||
    Platform.OS === 'ios'
  );
}

function getProjectId(): string | null {
  const configuredProjectId =
    Constants.expoConfig?.extra?.eas
      ?.projectId ??
    Constants.easConfig?.projectId ??
    null;

  if (
    typeof configuredProjectId !==
    'string'
  ) {
    return null;
  }

  const normalizedProjectId =
    configuredProjectId.trim();

  return normalizedProjectId || null;
}

function getAppVersion(): string | null {
  const configuredVersion =
    Constants.expoConfig?.version;

  if (
    typeof configuredVersion !==
    'string'
  ) {
    return null;
  }

  const normalizedVersion =
    configuredVersion.trim();

  return normalizedVersion || null;
}

export async function ensureOrderNotificationChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    ORDER_NOTIFICATION_CHANNEL_ID,
    {
      name: 'تحديثات الطلبات',
      description:
        'تأكيد الطلب، التحضير، التوصيل، والإلغاء.',
      importance:
        Notifications.AndroidImportance.HIGH,
      sound: 'default',
    },
  );
}

async function registerPushNotificationsInternal(
  options: PushRegistrationOptions,
): Promise<PushRegistrationResult> {
  if (!isSupportedPlatform()) {
    return {
      status: 'unsupported',
      expoPushToken: null,
    };
  }

  await ensureOrderNotificationChannel();

  const existingPermissions =
    await Notifications.getPermissionsAsync();

  let permissionStatus =
    existingPermissions.status;

  if (
    permissionStatus !== 'granted' &&
    options.requestPermission === true &&
    existingPermissions.canAskAgain !== false
  ) {
    const requestedPermissions =
      await Notifications.requestPermissionsAsync();

    permissionStatus =
      requestedPermissions.status;
  }

  if (permissionStatus !== 'granted') {
    return {
      status: 'permission-not-granted',
      expoPushToken: null,
    };
  }

  const projectId = getProjectId();

  if (!projectId) {
    return {
      status: 'project-id-missing',
      expoPushToken: null,
    };
  }

  /**
   * Ensure the database RPC below always runs with the current permanent or
   * anonymous Supabase identity. This also makes notification registration
   * safe after a fresh install before the normal root bootstrap finishes.
   */
  await ensureAppSession();

  const expoPushToken = (
    await Notifications.getExpoPushTokenAsync({
      projectId,
      ...(options.devicePushToken
        ? {
            devicePushToken:
              options.devicePushToken,
          }
        : {}),
    })
  ).data.trim();

  if (!expoPushToken) {
    throw new Error(
      'Expo returned an empty push token.',
    );
  }

  await registerPushSubscription({
    expoPushToken,
    projectId,
    appVersion: getAppVersion(),
  });

  return {
    status: 'registered',
    expoPushToken,
  };
}

/**
 * Register the current installation with Navienty Now.
 *
 * By default this never opens a system permission prompt. Pass
 * requestPermission=true only from a contextual customer flow such as an
 * active order / service-booking screen.
 */
export async function registerPushNotifications(
  options: PushRegistrationOptions = {},
): Promise<PushRegistrationResult> {
  /**
   * Device-token rollover must use the token supplied by Expo immediately,
   * so it must not share the generic in-flight registration promise.
   */
  if (options.devicePushToken) {
    return registerPushNotificationsInternal(
      options,
    );
  }

  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise =
    registerPushNotificationsInternal(
      options,
    );

  try {
    return await registrationPromise;
  } finally {
    registrationPromise = null;
  }
}
