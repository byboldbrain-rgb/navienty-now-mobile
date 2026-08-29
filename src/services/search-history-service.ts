import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY =
  'navienty-now-global-search-recents-v1';

const MAX_STORED_SEARCHES = 10;

function normalizeSearch(
  value: unknown,
): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function sameSearch(
  first: string,
  second: string,
): boolean {
  return (
    first
      .trim()
      .toLocaleLowerCase('ar') ===
    second
      .trim()
      .toLocaleLowerCase('ar')
  );
}

export async function getRecentSearches(
  limit = 6,
): Promise<string[]> {
  try {
    const raw =
      await AsyncStorage.getItem(
        STORAGE_KEY,
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const result: string[] = [];

    for (const item of parsed) {
      const normalized =
        normalizeSearch(item);

      if (
        normalized.length < 2 ||
        result.some(
          (candidate) =>
            sameSearch(
              candidate,
              normalized,
            ),
        )
      ) {
        continue;
      }

      result.push(normalized);

      if (
        result.length >=
        Math.max(0, limit)
      ) {
        break;
      }
    }

    return result;
  } catch {
    return [];
  }
}

export async function saveRecentSearch(
  value: string,
  limit = 6,
): Promise<string[]> {
  const normalized =
    normalizeSearch(value);

  if (normalized.length < 2) {
    return getRecentSearches(limit);
  }

  const current =
    await getRecentSearches(
      MAX_STORED_SEARCHES,
    );

  const next = [
    normalized,
    ...current.filter(
      (item) =>
        !sameSearch(
          item,
          normalized,
        ),
    ),
  ].slice(
    0,
    MAX_STORED_SEARCHES,
  );

  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(next),
    );
  } catch {
    // Search remains usable even if local persistence fails.
  }

  return next.slice(
    0,
    Math.max(0, limit),
  );
}

export async function clearRecentSearches():
  Promise<void> {
  try {
    await AsyncStorage.removeItem(
      STORAGE_KEY,
    );
  } catch {
    // Non-critical local preference.
  }
}
