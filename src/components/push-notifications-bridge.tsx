import * as Notifications from 'expo-notifications';
import {
  router,
  useGlobalSearchParams,
  usePathname,
  type Href,
} from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { supabase } from '../lib/supabase';
import {
  trackNotificationEvent,
} from '../services/notification-analytics-service';
import {
  registerPushNotifications,
  shouldAutoRegisterPushNotifications,
} from '../services/push-notifications-service';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PushNotificationsBridgeProps = {
  enabled: boolean;
};

type NotificationData =
  Record<string, unknown>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Exact local screens that a server-owned notification is allowed to open.
 *
 * This is intentionally an allow-list rather than permitting arbitrary
 * URLs. A malformed/spoofed push notification therefore cannot turn the
 * bridge into an unrestricted browser/deep-link launcher.
 */
const SAFE_EXACT_NOTIFICATION_PATHS =
  new Set<string>([
    '/',
    '/search',
    '/cart',
    '/orders',
    '/account',
    '/notification-settings',

    '/category/restaurants',
    '/category/supermarket',
    '/category/bookstore',
    '/category/personal-care',
    '/category/laundry',
    '/category/request-anything',
  ]);

const SAFE_SLUG_ROUTE_PREFIXES = [
  '/supermarket-category/',
  '/bookstore-category/',
  '/personal-care-category/',
] as const;

const SAFE_UUID_ROUTE_PREFIXES = [
  '/store/',
  '/promo/',
] as const;

function getSingleParam(
  value:
    | string
    | string[]
    | undefined,
): string | null {
  const rawValue =
    Array.isArray(value)
      ? value[0]
      : value;

  if (
    typeof rawValue !==
    'string'
  ) {
    return null;
  }

  const normalized =
    rawValue.trim();

  return normalized || null;
}

function getStringValue(
  data: NotificationData,
  key: string,
): string | null {
  const value = data[key];

  if (
    typeof value !==
    'string'
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
}

function isUuid(
  value: string | null,
) {
  return (
    value !== null &&
    UUID_PATTERN.test(value)
  );
}

function isSafeSlug(
  value: string | null,
) {
  return (
    value !== null &&
    value.length <= 120 &&
    SLUG_PATTERN.test(value)
  );
}

function getRouteSegment(
  pathname: string,
  prefix: string,
): string | null {
  if (
    !pathname.startsWith(prefix)
  ) {
    return null;
  }

  const segment =
    pathname.slice(
      prefix.length,
    );

  if (
    !segment ||
    segment.includes('/')
  ) {
    return null;
  }

  return segment;
}

function splitLocalUrl(
  rawUrl: string,
): {
  pathname: string;
  query: string;
} | null {
  const value =
    rawUrl.trim();

  /**
   * Only app-local paths are accepted.
   *
   * Reject:
   * - https://...
   * - navientynow://...
   * - //example.com
   * - backslash based path tricks
   * - fragments
   */
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('#')
  ) {
    return null;
  }

  const questionMarkIndex =
    value.indexOf('?');

  if (
    questionMarkIndex < 0
  ) {
    return {
      pathname: value,
      query: '',
    };
  }

  return {
    pathname:
      value.slice(
        0,
        questionMarkIndex,
      ),

    query:
      value.slice(
        questionMarkIndex + 1,
      ),
  };
}

function isSafeOrderSuccessQuery(
  query: string,
): boolean {
  if (!query) {
    return false;
  }

  try {
    const searchParams =
      new URLSearchParams(query);

    const keys =
      Array.from(
        searchParams.keys(),
      );

    /**
     * A push notification may target exactly one order OR exactly one
     * service booking.
     */
    if (keys.length !== 1) {
      return false;
    }

    const key = keys[0];

    if (key === 'id') {
      return isUuid(
        searchParams.get('id'),
      );
    }

    if (
      key ===
      'serviceBookingId'
    ) {
      return isUuid(
        searchParams.get(
          'serviceBookingId',
        ),
      );
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Validate a local notification URL against screens that exist in the
 * released Navienty Now client.
 *
 * This lets the future Admin/backend send:
 *
 * {
 *   "type": "navigation",
 *   "url": "/cart"
 * }
 *
 * without making the mobile client accept arbitrary external URLs.
 */
function normalizeSafeNotificationUrl(
  rawUrl: string | null,
): string | null {
  if (!rawUrl) {
    return null;
  }

  const parsed =
    splitLocalUrl(rawUrl);

  if (!parsed) {
    return null;
  }

  const {
    pathname,
    query,
  } = parsed;

  /**
   * Simple exact screens currently do not need notification-controlled
   * query parameters.
   */
  if (
    SAFE_EXACT_NOTIFICATION_PATHS
      .has(pathname)
  ) {
    return query
      ? null
      : pathname;
  }

  if (
    pathname ===
    '/order-success'
  ) {
    return isSafeOrderSuccessQuery(
      query,
    )
      ? rawUrl.trim()
      : null;
  }

  if (query) {
    return null;
  }

  for (
    const prefix of
      SAFE_UUID_ROUTE_PREFIXES
  ) {
    const id =
      getRouteSegment(
        pathname,
        prefix,
      );

    if (isUuid(id)) {
      return pathname;
    }
  }

  for (
    const prefix of
      SAFE_SLUG_ROUTE_PREFIXES
  ) {
    const slug =
      getRouteSegment(
        pathname,
        prefix,
      );

    if (isSafeSlug(slug)) {
      return pathname;
    }
  }

  return null;
}

function buildOrderTrackingUrl(
  orderId: string,
) {
  return (
    '/order-success?id=' +
    encodeURIComponent(
      orderId,
    )
  );
}

function buildServiceBookingTrackingUrl(
  serviceBookingId: string,
) {
  return (
    '/order-success?serviceBookingId=' +
    encodeURIComponent(
      serviceBookingId,
    )
  );
}

/**
 * Convert a push payload into a validated local application URL.
 *
 * Existing order/service notifications remain supported.
 *
 * Future campaigns can use the generic contract:
 *
 * {
 *   type: "navigation",
 *   url: "/category/supermarket"
 * }
 *
 * `route` is also accepted as an alias for `url` so the future Admin does
 * not force another mobile release if it uses that field name.
 */
function resolveNotificationUrl(
  notification:
    Notifications.Notification,
): string | null {
  const rawData =
    notification.request
      .content.data;

  if (
    !rawData ||
    typeof rawData !==
      'object'
  ) {
    return null;
  }

  const data =
    rawData as NotificationData;

  const type =
    getStringValue(
      data,
      'type',
    );

  /**
   * Backward compatibility:
   * existing production order notifications.
   */
  if (
    type ===
    'order_status'
  ) {
    const orderId =
      getStringValue(
        data,
        'orderId',
      );

    if (isUuid(orderId)) {
      return buildOrderTrackingUrl(
        orderId!,
      );
    }
  }

  /**
   * Backward compatibility:
   * existing laundry/service-booking notifications.
   */
  if (
    type ===
    'service_booking_status'
  ) {
    const serviceBookingId =
      getStringValue(
        data,
        'serviceBookingId',
      );

    if (
      isUuid(
        serviceBookingId,
      )
    ) {
      return buildServiceBookingTrackingUrl(
        serviceBookingId!,
      );
    }
  }

  /**
   * Generic future notification contract.
   *
   * We deliberately allow navigation only after the URL passes the strict
   * local route allow-list above.
   */
  const requestedUrl =
    getStringValue(
      data,
      'url',
    ) ??
    getStringValue(
      data,
      'route',
    );

  return normalizeSafeNotificationUrl(
    requestedUrl,
  );
}

function redirectFromNotification(
  notification:
    Notifications.Notification,
): boolean {
  const targetUrl =
    resolveNotificationUrl(
      notification,
    );

  if (!targetUrl) {
    return false;
  }

  router.push(
    targetUrl as Href,
  );

  return true;
}

export default function PushNotificationsBridge({
  enabled,
}: PushNotificationsBridgeProps) {
  const pathname =
    usePathname();

  const params =
    useGlobalSearchParams<{
      id?:
        | string
        | string[];

      serviceBookingId?:
        | string
        | string[];
    }>();

  const currentOrderId =
    getSingleParam(
      params.id,
    );

  const currentServiceBookingId =
    getSingleParam(
      params.serviceBookingId,
    );

  const isTrackingCustomerOrder =
    pathname ===
      '/order-success' &&
    (
      isUuid(currentOrderId) ||
      isUuid(
        currentServiceBookingId,
      )
    );

  const autoRegistrationEnabled =
    shouldAutoRegisterPushNotifications();

  /**
   * Notification response routing stays enabled in every native build.
   *
   * It does not request notification permission and does not register a
   * push token by itself.
   *
   * Handles:
   * - app already open
   * - background app
   * - cold start after tapping a notification
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const lastResponse =
      Notifications
        .getLastNotificationResponse();

    if (
      lastResponse?.notification
    ) {
      void trackNotificationEvent(
        lastResponse.notification.request.content.data,
        'opened',
        {
          actionIdentifier:
            lastResponse.actionIdentifier,
          launch: 'cold-start',
        },
      );

      redirectFromNotification(
        lastResponse.notification,
      );

      /**
       * Never replay the same notification navigation during a later React
       * remount/application launch.
       */
      Notifications
        .clearLastNotificationResponse();
    }

    const responseSubscription =
      Notifications
        .addNotificationResponseReceivedListener(
          (response) => {
            void trackNotificationEvent(
              response.notification.request.content.data,
              'opened',
              {
                actionIdentifier:
                  response.actionIdentifier,
                launch: 'response-listener',
              },
            );

            redirectFromNotification(
              response.notification,
            );

            Notifications
              .clearLastNotificationResponse();
          },
        );

    const receivedSubscription =
      Notifications
        .addNotificationReceivedListener(
          (notification) => {
            void trackNotificationEvent(
              notification.request.content.data,
              'received_foreground',
              {
                appState:
                  AppState.currentState,
              },
            );
          },
        );

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, [enabled]);

  /**
   * Silently register/refresh an existing permission and push token.
   *
   * This path NEVER opens the operating-system notification permission
   * dialog.
   */
  useEffect(() => {
    if (
      !enabled ||
      !autoRegistrationEnabled
    ) {
      return;
    }

    let disposed = false;

    async function registerExistingPermission() {
      try {
        await registerPushNotifications({
          requestPermission: false,
        });
      } catch (error) {
        if (!disposed) {
          console.warn(
            'Unable to refresh push notification registration:',
            error,
          );
        }
      }
    }

    void registerExistingPermission();

    /**
     * Notification permission can change while the user is in the operating
     * system Settings app. Reconcile again whenever Navienty Now returns to
     * the foreground so a revoked permission disables this installation's
     * remembered subscription, and a re-enabled permission registers it again.
     */
    const appStateSubscription =
      AppState.addEventListener(
        'change',
        (state) => {
          if (
            state === 'active' &&
            !disposed
          ) {
            void registerExistingPermission();
          }
        },
      );

    /**
     * Expo can rotate the underlying APNs/FCM device token while the app is
     * running. Re-register immediately so the Expo token stored in Supabase
     * always represents the current installation.
     */
    const tokenSubscription =
      Notifications
        .addPushTokenListener(
          (devicePushToken) => {
            void registerPushNotifications({
              requestPermission:
                false,

              devicePushToken,
            }).catch(
              (error) => {
                if (!disposed) {
                  console.warn(
                    'Unable to refresh rolled push token:',
                    error,
                  );
                }
              },
            );
          },
        );

    /**
     * Push subscriptions are owned by auth.uid().
     *
     * Re-register after EVERY auth transition, including SIGNED_OUT.
     *
     * On SIGNED_OUT, registerPushNotifications() will call
     * ensureAppSession() once notification permission already exists,
     * creating/restoring the anonymous Navienty identity and moving the
     * device token away from the previous permanent user.
     *
     * This prevents the common account-switching problem where a phone can
     * remain attached to the previous customer's push subscription.
     */
    const {
      data: authListener,
    } =
      supabase.auth
        .onAuthStateChange(
          () => {
            if (disposed) {
              return;
            }

            /**
             * Do not call another Supabase Auth operation synchronously from
             * inside onAuthStateChange. Queue it after the current auth event
             * has finished.
             */
            setTimeout(() => {
              if (!disposed) {
                void registerExistingPermission();
              }
            }, 0);
          },
        );

    return () => {
      disposed = true;

      appStateSubscription.remove();

      tokenSubscription.remove();

      authListener.subscription
        .unsubscribe();
    };
  }, [
    enabled,
    autoRegistrationEnabled,
  ]);

  /**
   * Contextual notification permission request.
   *
   * Navienty Now does not ask for push permission immediately on first app
   * launch. The request happens once the customer reaches a real order or
   * service-booking tracking screen where notifications provide clear value.
   */
  useEffect(() => {
    if (
      !enabled ||
      !autoRegistrationEnabled ||
      !isTrackingCustomerOrder
    ) {
      return;
    }

    void registerPushNotifications({
      requestPermission: true,
    }).catch((error) => {
      console.warn(
        'Unable to enable order push notifications:',
        error,
      );
    });
  }, [
    enabled,
    autoRegistrationEnabled,
    isTrackingCustomerOrder,
  ]);

  return null;
}