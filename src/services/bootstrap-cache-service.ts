import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppBootstrap } from './bootstrap-service';

/**
 * Public bootstrap metadata only. The app-launch gate still independently
 * checks maintenance mode and minimum supported app version via the network.
 *
 * A short TTL prevents long-lived stale areas/payment methods from being used
 * when the bootstrap endpoint is temporarily unavailable.
 */
const BOOTSTRAP_CACHE_KEY =
  '@navienty-now/app-bootstrap/v1';
const BOOTSTRAP_CACHE_VERSION = 1;
const BOOTSTRAP_CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const BOOTSTRAP_CLOCK_SKEW_MS = 5 * 60 * 1000;

type CachedBootstrap = {
  version: 1;
  savedAt: number;
  bootstrap: AppBootstrap;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Never hydrate unvalidated JSON from device storage into Home state.
 * Keep validation tolerant of optional backend fields.
 */
export function isUsableAppBootstrap(value: unknown): value is AppBootstrap {
  if (!isRecord(value) || !isRecord(value.settings)) return false;
  const settings = value.settings;
  if (
    typeof settings.app_name !== 'string' ||
    typeof settings.currency_symbol !== 'string' ||
    !Array.isArray(value.cities) ||
    !Array.isArray(value.store_categories) ||
    !Array.isArray(value.payment_methods)
  ) {
    return false;
  }

  const citiesValid = value.cities.every(
    (city: unknown) =>
      isRecord(city) &&
      typeof city.id === 'string' &&
      typeof city.name_ar === 'string' &&
      Array.isArray(city.areas) &&
      city.areas.every(
        (area: unknown) =>
          isRecord(area) &&
          typeof area.id === 'string' &&
          typeof area.name_ar === 'string',
      ),
  );

  const categoriesValid = value.store_categories.every(
    (category: unknown) =>
      isRecord(category) &&
      typeof category.slug === 'string' &&
      typeof category.name_ar === 'string',
  );

  const paymentsValid = value.payment_methods.every(
    (payment: unknown) =>
      isRecord(payment) &&
      typeof payment.code === 'string' &&
      typeof payment.name_ar === 'string',
  );

  return citiesValid && categoriesValid && paymentsValid;
}

function isFreshTimestamp(savedAt: number): boolean {
  const now = Date.now();
  return (
    Number.isFinite(savedAt) &&
    savedAt > 0 &&
    savedAt <= now + BOOTSTRAP_CLOCK_SKEW_MS &&
    now - savedAt <= BOOTSTRAP_CACHE_MAX_AGE_MS
  );
}

async function removeInvalidCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BOOTSTRAP_CACHE_KEY);
  } catch {
    // Storage errors must not cause another Home startup failure.
  }
}

export async function readCachedAppBootstrap(): Promise<AppBootstrap | null> {
  try {
    const serialized = await AsyncStorage.getItem(BOOTSTRAP_CACHE_KEY);
    if (!serialized) return null;

    const record: unknown = JSON.parse(serialized);
    if (
      !isRecord(record) ||
      record.version !== BOOTSTRAP_CACHE_VERSION ||
      typeof record.savedAt !== 'number' ||
      !isFreshTimestamp(record.savedAt) ||
      !isUsableAppBootstrap(record.bootstrap)
    ) {
      void removeInvalidCache();
      return null;
    }

    return record.bootstrap;
  } catch {
    // Failed cache reads are treated as misses; network remains the source.
    return null;
  }
}

export async function writeCachedAppBootstrap(
  bootstrap: AppBootstrap,
): Promise<void> {
  if (!isUsableAppBootstrap(bootstrap)) return;

  const payload: CachedBootstrap = {
    version: BOOTSTRAP_CACHE_VERSION,
    savedAt: Date.now(),
    bootstrap,
  };

  try {
    await AsyncStorage.setItem(
      BOOTSTRAP_CACHE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    // Optional cache writes must never block a successful bootstrap.
  }
}
