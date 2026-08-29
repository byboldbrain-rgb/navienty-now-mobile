import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';

export type BehavioralEventName =
  | 'search_performed'
  | 'search_zero_results'
  | 'search_result_clicked'
  | 'cart_item_added'
  | 'for_you_clicked'
  | 'recently_viewed_clicked'
  | 'reorder_completed';

export type BehavioralEventProperties =
  Record<
    string,
    | string
    | number
    | boolean
    | null
    | undefined
  >;

export type TrackBehaviorEventInput = {
  eventName: BehavioralEventName;
  correlationId?: string | null;
  searchSessionId?: string | null;
  serviceAreaId?: string | null;
  properties?: BehavioralEventProperties;
};

const CLIENT_SESSION_STORAGE_KEY =
  'navienty-now-analytics-client-session-v1';

const MAX_PROPERTY_KEY_LENGTH = 64;
const MAX_PROPERTY_STRING_LENGTH = 180;
const MAX_PROPERTIES = 28;

let cachedClientSessionId:
  string | null = null;

function createRandomId(
  prefix: string,
): string {
  const timePart =
    Date.now().toString(36);

  const randomPart =
    Math.random()
      .toString(36)
      .slice(2, 12);

  const extraPart =
    Math.random()
      .toString(36)
      .slice(2, 8);

  return [
    prefix,
    timePart,
    randomPart,
    extraPart,
  ].join('_');
}

export function createAnalyticsCorrelationId(
  prefix = 'evt',
): string {
  return createRandomId(prefix);
}

/**
 * Search text can accidentally contain personal data.
 *
 * Keep enough semantic value for product analytics while masking the two most
 * common accidental PII forms before the query reaches the analytics table.
 */
export function sanitizeSearchQueryForAnalytics(
  value: string,
): string {
  return value
    .trim()
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      '[email]',
    )
    .replace(
      /(?:\+?20[\s.-]?)?(?:0?1[0125])[\s.-]?\d{4}[\s.-]?\d{4}\b/g,
      '[phone]',
    )
    .replace(/\s+/g, ' ')
    .slice(
      0,
      MAX_PROPERTY_STRING_LENGTH,
    );
}

function normalizeEventText(
  value:
    | string
    | null
    | undefined,
  maxLength =
    MAX_PROPERTY_STRING_LENGTH,
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const normalized =
    value
      .trim()
      .replace(/\s+/g, ' ');

  if (!normalized) {
    return null;
  }

  return normalized.slice(
    0,
    maxLength,
  );
}

function sanitizePropertyKey(
  key: string,
): string | null {
  const normalized =
    key
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9_]+/g,
        '_',
      )
      .replace(
        /^_+|_+$/g,
        '',
      )
      .slice(
        0,
        MAX_PROPERTY_KEY_LENGTH,
      );

  if (!normalized) {
    return null;
  }

  /*
   * Defense-in-depth: these keys should never be placed in analytics metadata.
   */
  const blockedFragments = [
    'phone',
    'email',
    'address',
    'password',
    'token',
    'receipt',
    'prescription',
    'card_number',
    'payment_proof',
  ];

  if (
    blockedFragments.some(
      (fragment) =>
        normalized.includes(
          fragment,
        ),
    )
  ) {
    return null;
  }

  return normalized;
}

function sanitizeProperties(
  properties:
    | BehavioralEventProperties
    | undefined,
): Record<
  string,
  string | number | boolean | null
> {
  if (!properties) {
    return {};
  }

  const result: Record<
    string,
    string | number | boolean | null
  > = {};

  const entries =
    Object.entries(properties)
      .slice(
        0,
        MAX_PROPERTIES,
      );

  for (
    const [
      rawKey,
      rawValue,
    ] of entries
  ) {
    const key =
      sanitizePropertyKey(
        rawKey,
      );

    if (!key) {
      continue;
    }

    if (
      rawValue === null ||
      rawValue === undefined
    ) {
      result[key] = null;
      continue;
    }

    if (
      typeof rawValue ===
        'boolean'
    ) {
      result[key] = rawValue;
      continue;
    }

    if (
      typeof rawValue ===
        'number'
    ) {
      result[key] =
        Number.isFinite(rawValue)
          ? rawValue
          : 0;

      continue;
    }

    result[key] =
      rawValue
        .trim()
        .replace(/\s+/g, ' ')
        .slice(
          0,
          MAX_PROPERTY_STRING_LENGTH,
        );
  }

  return result;
}

async function getClientSessionId():
  Promise<string> {
  if (cachedClientSessionId) {
    return cachedClientSessionId;
  }

  try {
    const stored =
      await AsyncStorage.getItem(
        CLIENT_SESSION_STORAGE_KEY,
      );

    if (
      stored &&
      stored.trim().length >= 8
    ) {
      cachedClientSessionId =
        stored.trim().slice(
          0,
          120,
        );

      return cachedClientSessionId;
    }
  } catch {
    // Generate a new local identifier below.
  }

  const next =
    createRandomId('client');

  cachedClientSessionId =
    next;

  try {
    await AsyncStorage.setItem(
      CLIENT_SESSION_STORAGE_KEY,
      next,
    );
  } catch {
    // Session analytics can still work in-memory.
  }

  return next;
}

function getPlatform():
  | 'ios'
  | 'android'
  | 'web'
  | 'unknown' {
  if (
    Platform.OS === 'ios' ||
    Platform.OS === 'android' ||
    Platform.OS === 'web'
  ) {
    return Platform.OS;
  }

  return 'unknown';
}

/**
 * Analytics must never block product behavior.
 *
 * This function intentionally resolves quietly on auth/network/RLS failures.
 * The caller should normally invoke it with `void trackBehaviorEvent(...)`.
 */
export async function trackBehaviorEvent(
  input: TrackBehaviorEventInput,
): Promise<void> {
  try {
    const [
      sessionResult,
      clientSessionId,
    ] = await Promise.all([
      supabase.auth.getSession(),
      getClientSessionId(),
    ]);

    const userId =
      sessionResult.data
        .session?.user.id ??
      null;

    if (!userId) {
      return;
    }

    const correlationId =
      normalizeEventText(
        input.correlationId,
        160,
      );

    const searchSessionId =
      normalizeEventText(
        input.searchSessionId,
        160,
      );

    const serviceAreaId =
      normalizeEventText(
        input.serviceAreaId,
        160,
      );

    const {
      error,
    } = await (
      supabase as any
    )
      .schema('now')
      .from('analytics_events')
      .insert({
        event_name:
          input.eventName,

        actor_user_id:
          userId,

        client_session_id:
          clientSessionId,

        correlation_id:
          correlationId,

        search_session_id:
          searchSessionId,

        service_area_id:
          serviceAreaId,

        source: 'mobile',

        platform:
          getPlatform(),

        properties:
          sanitizeProperties(
            input.properties,
          ),
      });

    if (
      error &&
      __DEV__
    ) {
      console.warn(
        'Behavior analytics insert failed.',
        input.eventName,
        error.message,
      );
    }
  } catch (error) {
    if (__DEV__) {
      console.warn(
        'Behavior analytics logging failed.',
        input.eventName,
        error,
      );
    }
  }
}
