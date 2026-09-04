import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../lib/supabase';
import {
    ensureAppSession,
} from './anonymous-auth-service';

const NOTIFICATION_ATTRIBUTION_STORAGE_KEY =
  '@navienty-now/notification-attribution-v1';

const ATTRIBUTION_WINDOW_MS =
  24 * 60 * 60 * 1000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NotificationData =
  Record<string, unknown>;

export type NotificationClientEvent =
  | 'received_foreground'
  | 'opened';

export type NotificationConversionInput = {
  type:
    | 'order_created'
    | 'service_booking_created';
  resourceId: string;
  valueEgp?: number | null;
};

type RememberedAttribution = {
  outboxId: string;
  campaignId: string;
  category: 'offers';
  openedAt: number;
};

function getString(
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

function getNotificationData(
  rawData: unknown,
): NotificationData | null {
  if (
    !rawData ||
    typeof rawData !== 'object' ||
    Array.isArray(rawData)
  ) {
    return null;
  }

  return rawData as NotificationData;
}

function isUuid(
  value: string | null,
): value is string {
  return (
    value !== null &&
    UUID_PATTERN.test(value)
  );
}

async function rememberAttribution(
  data: NotificationData,
) {
  const outboxId =
    getString(
      data,
      'notificationOutboxId',
    );

  const campaignId =
    getString(
      data,
      'campaignId',
    );

  const category =
    getString(
      data,
      'notificationCategory',
    );

  if (
    !isUuid(outboxId) ||
    !campaignId ||
    category !== 'offers'
  ) {
    return;
  }

  const attribution: RememberedAttribution = {
    outboxId,
    campaignId,
    category: 'offers',
    openedAt: Date.now(),
  };

  await AsyncStorage.setItem(
    NOTIFICATION_ATTRIBUTION_STORAGE_KEY,
    JSON.stringify(attribution),
  );
}

async function readAttribution(): Promise<RememberedAttribution | null> {
  const stored = await AsyncStorage.getItem(
    NOTIFICATION_ATTRIBUTION_STORAGE_KEY,
  );

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      stored,
    ) as Partial<RememberedAttribution>;

    if (
      !isUuid(
        typeof parsed.outboxId === 'string'
          ? parsed.outboxId
          : null,
      ) ||
      typeof parsed.campaignId !== 'string' ||
      !parsed.campaignId.trim() ||
      parsed.category !== 'offers' ||
      typeof parsed.openedAt !== 'number' ||
      !Number.isFinite(parsed.openedAt)
    ) {
      await AsyncStorage.removeItem(
        NOTIFICATION_ATTRIBUTION_STORAGE_KEY,
      );
      return null;
    }

    if (
      Date.now() - parsed.openedAt >
      ATTRIBUTION_WINDOW_MS
    ) {
      await AsyncStorage.removeItem(
        NOTIFICATION_ATTRIBUTION_STORAGE_KEY,
      );
      return null;
    }

    return {
      outboxId: parsed.outboxId,
      campaignId:
        parsed.campaignId.trim(),
      category: 'offers',
      openedAt: parsed.openedAt,
    };
  } catch {
    await AsyncStorage.removeItem(
      NOTIFICATION_ATTRIBUTION_STORAGE_KEY,
    );
    return null;
  }
}

export async function trackNotificationEvent(
  rawData: unknown,
  eventType: NotificationClientEvent,
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  const data = getNotificationData(
    rawData,
  );

  if (!data) {
    return false;
  }

  const outboxId =
    getString(
      data,
      'notificationOutboxId',
    );

  if (!isUuid(outboxId)) {
    return false;
  }

  if (eventType === 'opened') {
    try {
      await rememberAttribution(data);
    } catch (error) {
      console.warn(
        'Unable to remember notification attribution:',
        error,
      );
    }
  }

  try {
    await ensureAppSession();

    const {
      data: tracked,
      error,
    } = await supabase.rpc(
      'track_my_notification_event',
      {
        p_outbox_id: outboxId,
        p_event_type: eventType,
        p_metadata: metadata,
      },
    );

    if (error) {
      console.warn(
        'Unable to track notification event:',
        error,
      );
      return false;
    }

    return tracked === true;
  } catch (error) {
    console.warn(
      'Unable to track notification event:',
      error,
    );
    return false;
  }
}

export async function trackRememberedNotificationConversion(
  input: NotificationConversionInput,
): Promise<boolean> {
  let attribution: RememberedAttribution | null = null;

  try {
    attribution = await readAttribution();
  } catch (error) {
    console.warn(
      'Unable to read notification attribution:',
      error,
    );
    return false;
  }

  if (!attribution) {
    return false;
  }

  const resourceId =
    input.resourceId.trim();

  if (!UUID_PATTERN.test(resourceId)) {
    return false;
  }

  const valueEgp =
    typeof input.valueEgp === 'number' &&
    Number.isFinite(input.valueEgp)
      ? Math.max(0, input.valueEgp)
      : null;

  try {
    await ensureAppSession();

    const {
      data: tracked,
      error,
    } = await supabase.rpc(
      'track_my_notification_conversion',
      {
        p_outbox_id:
          attribution.outboxId,
        p_conversion_type:
          input.type,
        p_resource_id:
          resourceId,
        p_value_egp:
          valueEgp,
      },
    );

    if (error) {
      console.warn(
        'Unable to track notification conversion:',
        error,
      );
      return false;
    }

    /**
     * One notification open is attributed to the first completed conversion.
     * If the server rejects the attribution as ineligible, clear it as well so
     * a stale or account-switched campaign cannot be retried indefinitely.
     */
    await AsyncStorage.removeItem(
      NOTIFICATION_ATTRIBUTION_STORAGE_KEY,
    );

    return tracked === true;
  } catch (error) {
    console.warn(
      'Unable to track notification conversion:',
      error,
    );
    return false;
  }
}
