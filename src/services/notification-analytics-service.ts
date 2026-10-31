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

    const parsedOutboxId =
      typeof parsed.outboxId === 'string'
        ? parsed.outboxId
        : null;

    const parsedCampaignId =
      typeof parsed.campaignId === 'string'
        ? parsed.campaignId.trim()
        : '';

    const parsedOpenedAt =
      parsed.openedAt;

    if (
      !isUuid(parsedOutboxId) ||
      !parsedCampaignId ||
      parsed.category !== 'offers' ||
      typeof parsedOpenedAt !== 'number' ||
      !Number.isFinite(parsedOpenedAt)
    ) {
      await AsyncStorage.removeItem(
        NOTIFICATION_ATTRIBUTION_STORAGE_KEY,
      );
      return null;
    }

    if (
      Date.now() - parsedOpenedAt >
      ATTRIBUTION_WINDOW_MS
    ) {
      await AsyncStorage.removeItem(
        NOTIFICATION_ATTRIBUTION_STORAGE_KEY,
      );
      return null;
    }

    return {
      outboxId: parsedOutboxId,
      campaignId: parsedCampaignId,
      category: 'offers',
      openedAt: parsedOpenedAt,
    };
  } catch {
    await AsyncStorage.removeItem(
      NOTIFICATION_ATTRIBUTION_STORAGE_KEY,
    );
    return null;
  }
}

/**
 * Save opens to disk BEFORE attempting the network request.  Previously a
 * network/auth failure during a cold-start notification tap silently lost
 * the event forever, so first_opened_at and the open-rate report undercounted.
 *
 * The server enforces ownership and dedupes events by notification/user/type.
 * Retain unacknowledged opens for up to 7 days, at most 100, so a transient
 * failure cannot grow local storage indefinitely.
 */
const PENDING_NOTIFICATION_OPENS_KEY =
  '@navienty-now/pending-notification-opens-v1';
const PENDING_OPEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_OPEN_MAX_ITEMS = 100;
const PENDING_OPEN_MAX_FLUSH_PER_RUN = 25;

type PendingNotificationOpen = {
  outboxId: string;
  metadata: Record<string, unknown>;
  queuedAt: number;
};

let pendingOpenQueueLock: Promise<unknown> = Promise.resolve();

function withPendingOpenQueueLock<T>(task: () => Promise<T>): Promise<T> {
  const next = pendingOpenQueueLock.then(task, task);
  pendingOpenQueueLock = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function readPendingNotificationOpens(): Promise<PendingNotificationOpen[]> {
  const raw = await AsyncStorage.getItem(PENDING_NOTIFICATION_OPENS_KEY);
  if (!raw) return [];

  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];

    const now = Date.now();
    return value.filter((item): item is PendingNotificationOpen => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<PendingNotificationOpen>;
      return (
        isUuid(typeof candidate.outboxId === 'string' ? candidate.outboxId : null) &&
        typeof candidate.queuedAt === 'number' &&
        Number.isFinite(candidate.queuedAt) &&
        candidate.queuedAt <= now &&
        now - candidate.queuedAt <= PENDING_OPEN_MAX_AGE_MS &&
        candidate.metadata !== null &&
        typeof candidate.metadata === 'object' &&
        !Array.isArray(candidate.metadata)
      );
    }).slice(-PENDING_OPEN_MAX_ITEMS);
  } catch {
    return [];
  }
}

async function enqueueNotificationOpen(
  outboxId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await withPendingOpenQueueLock(async () => {
    const pending = await readPendingNotificationOpens();
    if (pending.some((event) => event.outboxId === outboxId)) return;

    pending.push({ outboxId, metadata, queuedAt: Date.now() });
    await AsyncStorage.setItem(
      PENDING_NOTIFICATION_OPENS_KEY,
      JSON.stringify(pending.slice(-PENDING_OPEN_MAX_ITEMS)),
    );
  });
}

async function removePendingNotificationOpen(outboxId: string): Promise<void> {
  await withPendingOpenQueueLock(async () => {
    const pending = await readPendingNotificationOpens();
    await AsyncStorage.setItem(
      PENDING_NOTIFICATION_OPENS_KEY,
      JSON.stringify(pending.filter((event) => event.outboxId !== outboxId)),
    );
  });
}

let inFlightOpenFlush: Promise<void> | null = null;

/**
 * Retry on app startup and when returning to the foreground.  Sequential,
 * single-flight flushing avoids duplicate sends and lost AsyncStorage updates.
 * RPC false means the server did not acknowledge this user's open; retain the
 * event to retry instead of pretending that it was measured.
 */
export function flushPendingNotificationOpens(): Promise<void> {
  if (inFlightOpenFlush) return inFlightOpenFlush;

  const work = (async () => {
    const attempted = new Set<string>();

    while (attempted.size < PENDING_OPEN_MAX_FLUSH_PER_RUN) {
      const next = await withPendingOpenQueueLock(async () => {
        const pending = await readPendingNotificationOpens();
        return pending.find((event) => !attempted.has(event.outboxId));
      });
      if (!next) return;

      attempted.add(next.outboxId);
      await ensureAppSession();

      const { data: tracked, error } = await supabase.rpc(
        'track_my_notification_event',
        {
          p_outbox_id: next.outboxId,
          p_event_type: 'opened',
          p_metadata: next.metadata,
        },
      );

      if (error) throw error;
      if (tracked === true) {
        await removePendingNotificationOpen(next.outboxId);
      } else {
        console.warn('Notification open was not acknowledged:', next.outboxId);
      }
    }
  })().catch((error) => {
    // Keep the durable queue for the next app launch/foreground transition.
    console.warn('Unable to flush pending notification opens:', error);
  });

  inFlightOpenFlush = work.finally(() => {
    inFlightOpenFlush = null;
  });
  return inFlightOpenFlush;
}

export async function trackNotificationEvent(
  rawData: unknown,
  eventType: NotificationClientEvent,
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  const data = getNotificationData(rawData);
  if (!data) return false;

  const outboxId = getString(data, 'notificationOutboxId');
  if (!isUuid(outboxId)) return false;

  if (eventType === 'opened') {
    try {
      await rememberAttribution(data);
    } catch (error) {
      console.warn('Unable to remember notification attribution:', error);
    }

    try {
      await enqueueNotificationOpen(outboxId, metadata);
      await flushPendingNotificationOpens();
      // True means safely queued; a failed network request stays pending.
      return true;
    } catch (error) {
      console.warn('Unable to queue notification open:', error);
      return false;
    }
  }

  // Foreground delivery is a diagnostic event, not a tap/open.
  try {
    await ensureAppSession();
    const { data: tracked, error } = await supabase.rpc(
      'track_my_notification_event',
      {
        p_outbox_id: outboxId,
        p_event_type: eventType,
        p_metadata: metadata,
      },
    );
    if (error) {
      console.warn('Unable to track notification event:', error);
      return false;
    }
    return tracked === true;
  } catch (error) {
    console.warn('Unable to track notification event:', error);
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
