import Constants, {
  ExecutionEnvironment,
} from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  ensureAppSession,
} from './anonymous-auth-service';
import {
  registerPushSubscription,
} from './push-subscriptions-service';

/**
 * Stable notification channel IDs.
 *
 * IMPORTANT:
 * These IDs are part of the mobile/backend contract.
 * Do not rename them after release unless there is a migration plan,
 * because Android users can configure every channel independently.
 */
export const GENERAL_NOTIFICATION_CHANNEL_ID =
  'general';

export const ORDER_NOTIFICATION_CHANNEL_ID =
  'orders';

export const OFFERS_NOTIFICATION_CHANNEL_ID =
  'offers';

export const ACCOUNT_NOTIFICATION_CHANNEL_ID =
  'account';

export const PUSH_NOTIFICATION_CHANNEL_IDS = {
  general:
    GENERAL_NOTIFICATION_CHANNEL_ID,
  orders:
    ORDER_NOTIFICATION_CHANNEL_ID,
  offers:
    OFFERS_NOTIFICATION_CHANNEL_ID,
  account:
    ACCOUNT_NOTIFICATION_CHANNEL_ID,
} as const;

export type PushNotificationChannelId =
  (typeof PUSH_NOTIFICATION_CHANNEL_IDS)[keyof typeof PUSH_NOTIFICATION_CHANNEL_IDS];

type PushRegistrationOptions = {
  requestPermission?: boolean;
  devicePushToken?:
    Notifications.DevicePushToken;
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
  return (
    Constants.executionEnvironment ===
    ExecutionEnvironment.StoreClient
  );
}

export function isNotificationTestBuild() {
  const appVariant =
    Constants.expoConfig?.extra
      ?.appVariant;

  return (
    __DEV__ ||
    (
      typeof appVariant ===
        'string' &&
      appVariant
        .trim()
        .toLowerCase() ===
        'development'
    )
  );
}

export function shouldAutoRegisterPushNotifications() {
  const configuredValue =
    Constants.expoConfig?.extra
      ?.pushAutoRegister;

  if (configuredValue === false) {
    return false;
  }

  if (
    typeof configuredValue ===
      'string' &&
    configuredValue
      .trim()
      .toLowerCase() ===
      'false'
  ) {
    return false;
  }

  return true;
}

function getProjectId():
  string | null {
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

function getAppVersion():
  string | null {
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

/**
 * Create all notification channels the released application may need.
 *
 * We create these on every native launch because setNotificationChannelAsync
 * is idempotent. Creating them now means future Admin/Backend campaigns can
 * target the correct channel without requiring a new mobile binary.
 */
export async function ensureNotificationChannels() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Promise.all([
    Notifications.setNotificationChannelAsync(
      GENERAL_NOTIFICATION_CHANNEL_ID,
      {
        name: 'Navienty Now',
        description:
          'التحديثات العامة والمعلومات المهمة من Navienty Now.',
        importance:
          Notifications
            .AndroidImportance
            .DEFAULT,
        sound: 'default',
      },
    ),

    Notifications.setNotificationChannelAsync(
      ORDER_NOTIFICATION_CHANNEL_ID,
      {
        name: 'تحديثات الطلبات',
        description:
          'تأكيد الطلب، التحضير، التوصيل، والإلغاء.',
        importance:
          Notifications
            .AndroidImportance
            .HIGH,
        sound: 'default',
      },
    ),

    Notifications.setNotificationChannelAsync(
      OFFERS_NOTIFICATION_CHANNEL_ID,
      {
        name: 'العروض والمميزات',
        description:
          'العروض، المكافآت، والفرص المخصصة لك.',
        importance:
          Notifications
            .AndroidImportance
            .DEFAULT,
        sound: 'default',
      },
    ),

    Notifications.setNotificationChannelAsync(
      ACCOUNT_NOTIFICATION_CHANNEL_ID,
      {
        name: 'الحساب والدفع',
        description:
          'التحديثات المهمة المتعلقة بحسابك وعمليات الدفع.',
        importance:
          Notifications
            .AndroidImportance
            .DEFAULT,
        sound: 'default',
      },
    ),
  ]);
}

/**
 * Backward-compatible helper for any existing imports.
 *
 * The old implementation created only the orders channel.
 * It now guarantees that the complete notification channel contract exists.
 */
export async function ensureOrderNotificationChannel() {
  await ensureNotificationChannels();
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

  /**
   * Android 13+ needs at least one notification channel to exist before the
   * notification permission flow can be presented correctly.
   *
   * Create the complete set before reading/requesting permission.
   */
  await ensureNotificationChannels();

  const existingPermissions =
    await Notifications
      .getPermissionsAsync();

  let permissionStatus =
    existingPermissions.status;

  if (
    String(permissionStatus)
      .toLowerCase() !==
      'granted' &&
    options.requestPermission ===
      true &&
    existingPermissions.canAskAgain !==
      false
  ) {
    const requestedPermissions =
      await Notifications
        .requestPermissionsAsync();

    permissionStatus =
      requestedPermissions.status;
  }

  if (
    String(permissionStatus)
      .toLowerCase() !==
    'granted'
  ) {
    return {
      status:
        'permission-not-granted',
      expoPushToken: null,
    };
  }

  /**
   * Local notifications remain useful in Expo Go, but production remote
   * push registration should be tested in a Development Build/TestFlight/
   * release build.
   */
  if (isRunningInExpoGo()) {
    return {
      status: 'unsupported',
      expoPushToken: null,
    };
  }

  const projectId =
    getProjectId();

  if (!projectId) {
    return {
      status:
        'project-id-missing',
      expoPushToken: null,
    };
  }

  /**
   * Make sure the RPC below always has an authenticated Supabase identity.
   *
   * Navienty Now supports anonymous app sessions before a customer links a
   * permanent identity, so registration works immediately after install.
   */
  await ensureAppSession();

  const expoPushToken = (
    await Notifications
      .getExpoPushTokenAsync({
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
 * Register/refresh the current installation with Navienty Now.
 *
 * By default this NEVER displays the operating-system permission prompt.
 *
 * requestPermission=true should only be used from a contextual customer
 * flow, such as tracking an active order/service booking.
 */
export async function registerPushNotifications(
  options: PushRegistrationOptions = {},
): Promise<PushRegistrationResult> {
  /**
   * Device token rollover must use the token Expo supplied immediately.
   * Do not merge this operation with a generic in-flight registration.
   */
  if (options.devicePushToken) {
    return registerPushNotificationsInternal(
      options,
    );
  }

  /**
   * A contextual permission request must not be swallowed by a silent
   * registration which happened to start immediately beforehand.
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
 * Developer smoke test for:
 *
 * - notification permission
 * - foreground presentation
 * - Android general channel
 * - notification tap routing
 *
 * This is a LOCAL notification. Remote delivery/APNs/FCM still needs to be
 * tested separately from a Development Build/TestFlight/release build.
 */
export async function scheduleLocalNotificationTest():
  Promise<LocalNotificationTestResult> {
  if (!isSupportedPlatform()) {
    return 'unsupported';
  }

  await ensureNotificationChannels();

  const existingPermissions =
    await Notifications
      .getPermissionsAsync();

  let permissionStatus =
    existingPermissions.status;

  if (
    String(permissionStatus)
      .toLowerCase() !==
      'granted' &&
    existingPermissions.canAskAgain !==
      false
  ) {
    const requestedPermissions =
      await Notifications
        .requestPermissionsAsync();

    permissionStatus =
      requestedPermissions.status;
  }

  if (
    String(permissionStatus)
      .toLowerCase() !==
    'granted'
  ) {
    return 'permission-not-granted';
  }

  await Notifications
    .scheduleNotificationAsync({
      content: {
        title: 'Navienty Now',
        body:
          'الإشعارات المحلية شغالة بنجاح ✅',
        sound: 'default',

        /**
         * Use the same generic navigation contract that future Admin
         * notifications can use.
         *
         * Tapping this test notification should safely return to Home.
         */
        data: {
          type: 'navigation',
          url: '/',
        },
      },

      trigger:
        Platform.OS === 'android'
          ? {
              type:
                Notifications
                  .SchedulableTriggerInputTypes
                  .TIME_INTERVAL,
              seconds: 1,
              channelId:
                GENERAL_NOTIFICATION_CHANNEL_ID,
            }
          : null,
    });

  return 'scheduled';
}