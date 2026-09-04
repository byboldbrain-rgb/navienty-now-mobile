import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StoreSummary } from './catalog-service';

const HOME_PUBLIC_CACHE_VERSION = 1;
const HOME_PUBLIC_CACHE_MAX_AGE_MS =
  30 * 60 * 1000;
const HOME_PUBLIC_CACHE_CLOCK_SKEW_MS =
  5 * 60 * 1000;
const HOME_PUBLIC_CACHE_PREFIX =
  '@navienty-now/home-public/v1';

type CachedHomeStores = {
  version: 1;
  savedAt: number;
  stores: StoreSummary[];
};

type CachedHomeSuggestions = {
  version: 1;
  savedAt: number;
  storeIdsKey: string;
  suggestions: string[];
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isString(
  value: unknown,
): value is string {
  return typeof value === 'string';
}

function isNullableString(
  value: unknown,
): value is string | null {
  return value === null || isString(value);
}

function isFiniteNumber(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value)
  );
}

function isNullableFiniteNumber(
  value: unknown,
): value is number | null {
  return (
    value === null ||
    isFiniteNumber(value)
  );
}

function isStoreSummary(
  value: unknown,
): value is StoreSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.slug) &&
    isString(value.categoryId) &&
    isString(value.categorySlug) &&
    isString(value.categoryName) &&
    isString(value.categorySubtitle) &&
    isString(value.name) &&
    isString(value.description) &&
    isString(value.icon) &&
    isNullableString(value.logoUrl) &&
    isNullableString(value.coverImageUrl) &&
    isFiniteNumber(value.rating) &&
    isFiniteNumber(value.ratingCount) &&
    isString(value.deliveryTime) &&
    isFiniteNumber(value.deliveryFee) &&
    isFiniteNumber(value.minimumOrder) &&
    isNullableFiniteNumber(
      value.estimatedDeliveryMinutes,
    ) &&
    typeof value.isFeatured === 'boolean' &&
    typeof value.isManuallyClosed ===
      'boolean' &&
    isNullableString(value.manualClosedNote)
  );
}

function isFreshTimestamp(
  savedAt: number,
): boolean {
  const now = Date.now();

  return (
    savedAt > 0 &&
    savedAt <=
      now + HOME_PUBLIC_CACHE_CLOCK_SKEW_MS &&
    now - savedAt <=
      HOME_PUBLIC_CACHE_MAX_AGE_MS
  );
}

function getStorageKey(
  kind: 'stores' | 'suggestions',
  locationKey: string,
): string | null {
  const normalizedLocationKey =
    locationKey.trim();

  if (!normalizedLocationKey) {
    return null;
  }

  return [
    HOME_PUBLIC_CACHE_PREFIX,
    kind,
    encodeURIComponent(
      normalizedLocationKey,
    ),
  ].join('/');
}

async function removeCachedValue(
  key: string,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    if (__DEV__) {
      console.warn(
        'Unable to remove invalid Home public cache.',
        error,
      );
    }
  }
}

export function createHomeStoreIdsKey(
  stores: readonly Pick<StoreSummary, 'id'>[],
): string {
  return stores
    .map((store) => store.id.trim())
    .filter(Boolean)
    .join('|');
}

export async function readCachedHomeStores(
  locationKey: string,
): Promise<StoreSummary[] | null> {
  const key = getStorageKey(
    'stores',
    locationKey,
  );

  if (!key) {
    return null;
  }

  try {
    const rawValue =
      await AsyncStorage.getItem(key);

    if (!rawValue) {
      return null;
    }

    const parsed: unknown =
      JSON.parse(rawValue);

    if (
      !isRecord(parsed) ||
      parsed.version !==
        HOME_PUBLIC_CACHE_VERSION ||
      !isFiniteNumber(parsed.savedAt) ||
      !isFreshTimestamp(parsed.savedAt) ||
      !Array.isArray(parsed.stores) ||
      !parsed.stores.every(isStoreSummary)
    ) {
      void removeCachedValue(key);
      return null;
    }

    return parsed.stores;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        'Unable to read cached Home stores.',
        error,
      );
    }

    return null;
  }
}

export async function writeCachedHomeStores(
  locationKey: string,
  stores: readonly StoreSummary[],
): Promise<void> {
  const key = getStorageKey(
    'stores',
    locationKey,
  );

  if (!key) {
    return;
  }

  const payload: CachedHomeStores = {
    version: HOME_PUBLIC_CACHE_VERSION,
    savedAt: Date.now(),
    stores: [...stores],
  };

  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify(payload),
    );
  } catch (error) {
    if (__DEV__) {
      console.warn(
        'Unable to cache Home stores.',
        error,
      );
    }
  }
}

export async function readCachedHomeSuggestions(
  locationKey: string,
  storeIdsKey: string,
): Promise<string[] | null> {
  const key = getStorageKey(
    'suggestions',
    locationKey,
  );

  if (!key || !storeIdsKey) {
    return null;
  }

  try {
    const rawValue =
      await AsyncStorage.getItem(key);

    if (!rawValue) {
      return null;
    }

    const parsed: unknown =
      JSON.parse(rawValue);

    if (
      !isRecord(parsed) ||
      parsed.version !==
        HOME_PUBLIC_CACHE_VERSION ||
      !isFiniteNumber(parsed.savedAt) ||
      !isFreshTimestamp(parsed.savedAt) ||
      parsed.storeIdsKey !== storeIdsKey ||
      !Array.isArray(parsed.suggestions) ||
      !parsed.suggestions.every(isString)
    ) {
      void removeCachedValue(key);
      return null;
    }

    return parsed.suggestions;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        'Unable to read cached Home search suggestions.',
        error,
      );
    }

    return null;
  }
}

export async function writeCachedHomeSuggestions(
  locationKey: string,
  storeIdsKey: string,
  suggestions: readonly string[],
): Promise<void> {
  const key = getStorageKey(
    'suggestions',
    locationKey,
  );

  if (!key || !storeIdsKey) {
    return;
  }

  const payload: CachedHomeSuggestions = {
    version: HOME_PUBLIC_CACHE_VERSION,
    savedAt: Date.now(),
    storeIdsKey,
    suggestions: [...suggestions],
  };

  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify(payload),
    );
  } catch (error) {
    if (__DEV__) {
      console.warn(
        'Unable to cache Home search suggestions.',
        error,
      );
    }
  }
}
