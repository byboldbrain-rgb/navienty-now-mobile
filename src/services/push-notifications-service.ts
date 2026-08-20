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

export function isRunningInExpoGo() {
  return Constants.expoGoConfig !== null;
}

export function isNotificationTestBuild() {
  const appVariant =
    Constants.expoConfig?.extra?.appVariant;

  return (
    __DEV__ ||
    (typeof appVariant === 'string' &&
      appVariant.trim().toLowerCase() ===
        'development')
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
    String(permissionStatus).toLowerCase() !== 'granted' &&
    options.requestPermission === true &&
    existingPermissions.canAskAgain !== false
  ) {
    const requestedPermissions =
      await Notifications.requestPermissionsAsync();

    permissionStatus =
      requestedPermissions.status;
  }

  if (
    String(permissionStatus).toLowerCase() !== 'granted'
  ) {
    return {
      status: 'permission-not-granted',
      expoPushToken: null,
    };
  }

  /**
   * Local notifications remain available in Expo Go, but remote push token
   * registration does not. Stop here after permission handling so Expo Go
   * can still be used to verify the local notification UX without logging a
   * misleading token-registration error.
   */
  if (isRunningInExpoGo()) {
    return {
      status: 'unsupported',
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

  /**
   * A contextual permission request must never be swallowed by a silent
   * launch-time registration that happened to start a few milliseconds
   * earlier. Wait for the silent attempt, reuse it if it registered, then
   * run the permission-aware attempt if permission is still missing.
   */
  if (
    options.requestPermission === true
  ) {
    const existingAttempt =
      registrationPromise;

    if (existingAttempt) {
      const existingResult =
        await existingAttempt;

      if (
        existingResult.status ===
        'registered'
      ) {
        return existingResult;
      }
    }

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

export type LocalNotificationTestResult =
  | 'scheduled'
  | 'permission-not-granted'
  | 'unsupported';

/**
 * Developer smoke test for the notification presentation layer.
 *
 * This intentionally uses a local notification, so it works in Expo Go and
 * does not depend on FCM/APNs credentials. Remote delivery is validated
 * separately from a development build.
 */
export async function scheduleLocalNotificationTest():
  Promise<LocalNotificationTestResult> {
  if (!isSupportedPlatform()) {
    return 'unsupported';
  }

  await ensureOrderNotificationChannel();

  const existingPermissions =
    await Notifications.getPermissionsAsync();

  let permissionStatus =
    existingPermissions.status;

  if (
    String(permissionStatus).toLowerCase() !== 'granted' &&
    existingPermissions.canAskAgain !== false
  ) {
    const requestedPermissions =
      await Notifications.requestPermissionsAsync();

    permissionStatus =
      requestedPermissions.status;
  }

  if (
    String(permissionStatus).toLowerCase() !== 'granted'
  ) {
    return 'permission-not-granted';
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Navienty Now',
      body: 'الإشعارات المحلية شغالة بنجاح ✅',
      sound: 'default',
      data: {
        type: 'local_notification_test',
      },
    },
    trigger: null,
  });

  return 'scheduled';
}
