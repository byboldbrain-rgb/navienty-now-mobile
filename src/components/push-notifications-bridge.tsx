import * as Notifications from 'expo-notifications';
import {
  router,
  useGlobalSearchParams,
  usePathname,
} from 'expo-router';
import { useEffect } from 'react';

import { supabase } from '../lib/supabase';
import {
  registerPushNotifications,
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

function getSingleParam(
  value:
    | string
    | string[]
    | undefined,
): string | null {
  const rawValue = Array.isArray(value)
    ? value[0]
    : value;

  if (typeof rawValue !== 'string') {
    return null;
  }

  const normalized = rawValue.trim();

  return normalized || null;
}

function getStringValue(
  data: NotificationData,
  key: string,
): string | null {
  const value = data[key];

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function isUuid(value: string | null) {
  return (
    value !== null &&
    UUID_PATTERN.test(value)
  );
}

function redirectFromNotification(
  notification: Notifications.Notification,
): boolean {
  const rawData =
    notification.request.content.data;

  if (
    !rawData ||
    typeof rawData !== 'object'
  ) {
    return false;
  }

  const data =
    rawData as NotificationData;

  const type = getStringValue(
    data,
    'type',
  );

  if (type === 'order_status') {
    const orderId = getStringValue(
      data,
      'orderId',
    );

    if (!isUuid(orderId)) {
      return false;
    }

    router.push({
      pathname: '/order-success',
      params: {
        id: orderId!,
      },
    });

    return true;
  }

  if (
    type ===
    'service_booking_status'
  ) {
    const serviceBookingId =
      getStringValue(
        data,
        'serviceBookingId',
      );

    if (!isUuid(serviceBookingId)) {
      return false;
    }

    router.push({
      pathname: '/order-success',
      params: {
        serviceBookingId:
          serviceBookingId!,
      },
    });

    return true;
  }

  /**
   * Deliberately ignore arbitrary `url` values even if a notification
   * contains one. Navigation is derived only from server-owned event types
   * and validated UUIDs, so a malformed/spoofed notification cannot turn
   * this observer into an unrestricted deep-link launcher.
   */
  return false;
}

export default function PushNotificationsBridge({
  enabled,
}: PushNotificationsBridgeProps) {
  const pathname = usePathname();

  const params =
    useGlobalSearchParams<{
      id?: string | string[];
      serviceBookingId?:
        | string
        | string[];
    }>();

  const currentOrderId =
    getSingleParam(params.id);

  const currentServiceBookingId =
    getSingleParam(
      params.serviceBookingId,
    );

  const isTrackingCustomerOrder =
    pathname === '/order-success' &&
    (
      isUuid(currentOrderId) ||
      isUuid(currentServiceBookingId)
    );

  useEffect(() => {
    if (!enabled) {
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

    /**
     * If the customer already granted notification permission in a previous
     * session, silently refresh ownership/app-version metadata on launch.
     * This does not display a permission prompt.
     */
    void registerExistingPermission();

    const lastResponse =
      Notifications.getLastNotificationResponse();

    if (lastResponse?.notification) {
      redirectFromNotification(
        lastResponse.notification,
      );

      Notifications.clearLastNotificationResponse();
    }

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(
        (response) => {
          redirectFromNotification(
            response.notification,
          );
        },
      );

    const tokenSubscription =
      Notifications.addPushTokenListener(
        (devicePushToken) => {
          void registerPushNotifications({
            requestPermission: false,
            devicePushToken,
          }).catch((error) => {
            if (!disposed) {
              console.warn(
                'Unable to refresh rolled push token:',
                error,
              );
            }
          });
        },
      );

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!session || disposed) {
            return;
          }

          /**
           * A token can survive an anonymous -> permanent account upgrade.
           * Re-register it so the server atomically moves token ownership to
           * the current auth.uid(). Schedule outside the auth callback to
           * avoid blocking Supabase Auth internals.
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

      responseSubscription.remove();
      tokenSubscription.remove();
      authListener.subscription
        .unsubscribe();
    };
  }, [enabled]);

  useEffect(() => {
    if (
      !enabled ||
      !isTrackingCustomerOrder
    ) {
      return;
    }

    /**
     * Ask for notification permission only when the customer has a real
     * order/service booking to track. This gives the system prompt clear
     * context instead of interrupting a first-time visitor on the Home page.
     */
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
    isTrackingCustomerOrder,
  ]);

  return null;
}
