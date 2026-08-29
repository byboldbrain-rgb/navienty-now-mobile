import AsyncStorage from '@react-native-async-storage/async-storage';

export type SearchAttributionKind =
  | 'service'
  | 'store'
  | 'category'
  | 'product';

export type SearchAttribution = {
  searchSessionId: string;
  query: string;

  resultId: string;
  resultKind:
    SearchAttributionKind;
  resultRank: number;

  storeId: string | null;
  storeCategorySlug:
    string | null;

  productId: string | null;
  sectionId: string | null;
  sectionSlug: string | null;

  clickedAt: string;
};

export type SearchCartAttributionMatch = {
  attribution:
    SearchAttribution;
  matchType:
    | 'exact_product'
    | 'same_store'
    | 'same_service';
};

const STORAGE_KEY =
  'navienty-now-search-attribution-v1';

const ATTRIBUTION_TTL_MS =
  30 * 60 * 1000;

let memoryAttribution:
  SearchAttribution | null = null;

function normalize(
  value:
    | string
    | null
    | undefined,
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized
    ? normalized
    : null;
}

function normalizeCategory(
  value:
    | string
    | null
    | undefined,
): string | null {
  return normalize(value)
    ?.toLowerCase()
    .replace(/_/g, '-') ??
    null;
}

function isFresh(
  attribution:
    SearchAttribution,
): boolean {
  const clickedAt =
    new Date(
      attribution.clickedAt,
    ).getTime();

  return (
    Number.isFinite(clickedAt) &&
    Date.now() - clickedAt <=
      ATTRIBUTION_TTL_MS
  );
}

function normalizeStored(
  value: unknown,
): SearchAttribution | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null;
  }

  const raw =
    value as Partial<
      SearchAttribution
    >;

  const searchSessionId =
    normalize(
      raw.searchSessionId,
    );

  const query =
    normalize(raw.query);

  const resultId =
    normalize(raw.resultId);

  const clickedAt =
    normalize(raw.clickedAt);

  if (
    !searchSessionId ||
    !query ||
    !resultId ||
    !clickedAt
  ) {
    return null;
  }

  if (
    raw.resultKind !==
      'service' &&
    raw.resultKind !==
      'store' &&
    raw.resultKind !==
      'category' &&
    raw.resultKind !==
      'product'
  ) {
    return null;
  }

  const resultRank =
    Number(
      raw.resultRank,
    );

  const normalized:
    SearchAttribution = {
      searchSessionId,
      query,
      resultId,
      resultKind:
        raw.resultKind,
      resultRank:
        Number.isFinite(
          resultRank,
        )
          ? Math.max(
              1,
              Math.floor(
                resultRank,
              ),
            )
          : 1,
      storeId:
        normalize(
          raw.storeId,
        ),
      storeCategorySlug:
        normalizeCategory(
          raw.storeCategorySlug,
        ),
      productId:
        normalize(
          raw.productId,
        ),
      sectionId:
        normalize(
          raw.sectionId,
        ),
      sectionSlug:
        normalize(
          raw.sectionSlug,
        ),
      clickedAt,
    };

  return isFresh(normalized)
    ? normalized
    : null;
}

export async function clearSearchAttribution():
  Promise<void> {
  memoryAttribution = null;

  try {
    await AsyncStorage.removeItem(
      STORAGE_KEY,
    );
  } catch {
    // Non-critical attribution state.
  }
}

export async function setSearchAttribution(
  attribution:
    SearchAttribution,
): Promise<void> {
  const normalized =
    normalizeStored(
      attribution,
    );

  if (!normalized) {
    return;
  }

  memoryAttribution =
    normalized;

  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        normalized,
      ),
    );
  } catch {
    // In-memory attribution still works for the current app session.
  }
}

async function loadAttribution():
  Promise<SearchAttribution | null> {
  if (
    memoryAttribution &&
    isFresh(
      memoryAttribution,
    )
  ) {
    return memoryAttribution;
  }

  memoryAttribution = null;

  try {
    const raw =
      await AsyncStorage.getItem(
        STORAGE_KEY,
      );

    if (!raw) {
      return null;
    }

    const parsed =
      normalizeStored(
        JSON.parse(raw),
      );

    if (!parsed) {
      await AsyncStorage.removeItem(
        STORAGE_KEY,
      );

      return null;
    }

    memoryAttribution =
      parsed;

    return parsed;
  } catch {
    return null;
  }
}

export async function getMatchingSearchAttributionForCartAdd(
  input: {
    storeId: string;
    storeCategorySlug?:
      string | null;
    productId: string;
  },
): Promise<
  SearchCartAttributionMatch | null
> {
  const attribution =
    await loadAttribution();

  if (!attribution) {
    return null;
  }

  const storeId =
    input.storeId.trim();

  const productId =
    input.productId.trim();

  const categorySlug =
    normalizeCategory(
      input.storeCategorySlug,
    );

  if (
    attribution.resultKind ===
      'product' &&
    attribution.productId ===
      productId &&
    attribution.storeId ===
      storeId
  ) {
    return {
      attribution,
      matchType:
        'exact_product',
    };
  }

  if (
    attribution.storeId &&
    attribution.storeId ===
      storeId
  ) {
    return {
      attribution,
      matchType:
        'same_store',
    };
  }

  if (
    attribution.resultKind ===
      'service' &&
    attribution.storeCategorySlug &&
    categorySlug &&
    attribution.storeCategorySlug ===
      categorySlug
  ) {
    return {
      attribution,
      matchType:
        'same_service',
    };
  }

  return null;
}
