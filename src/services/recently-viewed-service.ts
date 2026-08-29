import AsyncStorage from '@react-native-async-storage/async-storage';

export type RecentlyViewedKind =
  | 'store'
  | 'category'
  | 'product';

export type RecentlyViewedItem = {
  id: string;
  kind: RecentlyViewedKind;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  icon: string;
  storeId: string;
  storeCategorySlug: string;
  sectionId: string | null;
  sectionSlug: string | null;
  price: number | null;
  viewedAt: string;
};

type RecentlyViewedInput =
  Omit<
    RecentlyViewedItem,
    'id' | 'viewedAt'
  > & {
    entityId: string;
  };

const STORAGE_KEY =
  'navienty-now-recently-viewed-v1';

const MAX_STORED_ITEMS = 20;

const listeners =
  new Set<
    (
      items: RecentlyViewedItem[],
    ) => void
  >();

function normalizeText(
  value: unknown,
): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function normalizeNullableText(
  value: unknown,
): string | null {
  const normalized =
    normalizeText(value);

  return normalized.length > 0
    ? normalized
    : null;
}

function normalizePrice(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    parsed >= 0
    ? parsed
    : null;
}

function normalizeStoredItem(
  value: unknown,
): RecentlyViewedItem | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null;
  }

  const raw =
    value as Partial<RecentlyViewedItem>;

  if (
    raw.kind !== 'store' &&
    raw.kind !== 'category' &&
    raw.kind !== 'product'
  ) {
    return null;
  }

  const id = normalizeText(raw.id);
  const title =
    normalizeText(raw.title);
  const storeId =
    normalizeText(raw.storeId);
  const storeCategorySlug =
    normalizeText(
      raw.storeCategorySlug,
    );
  const viewedAt =
    normalizeText(raw.viewedAt);

  if (
    !id ||
    !title ||
    !storeId ||
    !storeCategorySlug ||
    !viewedAt
  ) {
    return null;
  }

  return {
    id,
    kind: raw.kind,
    title,
    subtitle:
      normalizeText(raw.subtitle),
    imageUrl:
      normalizeNullableText(
        raw.imageUrl,
      ),
    icon:
      normalizeText(raw.icon) ||
      '📦',
    storeId,
    storeCategorySlug,
    sectionId:
      normalizeNullableText(
        raw.sectionId,
      ),
    sectionSlug:
      normalizeNullableText(
        raw.sectionSlug,
      ),
    price:
      normalizePrice(raw.price),
    viewedAt,
  };
}

async function readAll():
  Promise<RecentlyViewedItem[]> {
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

    return parsed
      .map(normalizeStoredItem)
      .filter(
        (
          item,
        ): item is RecentlyViewedItem =>
          item !== null,
      )
      .sort(
        (first, second) =>
          new Date(
            second.viewedAt,
          ).getTime() -
          new Date(
            first.viewedAt,
          ).getTime(),
      )
      .slice(
        0,
        MAX_STORED_ITEMS,
      );
  } catch {
    return [];
  }
}

async function writeAll(
  items: readonly RecentlyViewedItem[],
) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        items.slice(
          0,
          MAX_STORED_ITEMS,
        ),
      ),
    );
  } catch {
    // Personalization must never block navigation.
  }
}

function emit(
  items: RecentlyViewedItem[],
) {
  for (const listener of listeners) {
    try {
      listener(items);
    } catch {
      // Ignore a broken subscriber.
    }
  }
}

export async function getRecentlyViewedItems(
  limit = 8,
): Promise<RecentlyViewedItem[]> {
  const items = await readAll();

  return items.slice(
    0,
    Math.max(0, limit),
  );
}

export async function recordRecentlyViewed(
  input: RecentlyViewedInput,
): Promise<RecentlyViewedItem[]> {
  const entityId =
    normalizeText(input.entityId);
  const title =
    normalizeText(input.title);
  const storeId =
    normalizeText(input.storeId);
  const storeCategorySlug =
    normalizeText(
      input.storeCategorySlug,
    );

  if (
    !entityId ||
    !title ||
    !storeId ||
    !storeCategorySlug
  ) {
    return readAll();
  }

  const id = [
    input.kind,
    storeId,
    entityId,
  ].join(':');

  const item: RecentlyViewedItem = {
    id,
    kind: input.kind,
    title,
    subtitle:
      normalizeText(input.subtitle),
    imageUrl:
      normalizeNullableText(
        input.imageUrl,
      ),
    icon:
      normalizeText(input.icon) ||
      (
        input.kind === 'store'
          ? '🏪'
          : input.kind ===
              'category'
            ? '▦'
            : '📦'
      ),
    storeId,
    storeCategorySlug,
    sectionId:
      normalizeNullableText(
        input.sectionId,
      ),
    sectionSlug:
      normalizeNullableText(
        input.sectionSlug,
      ),
    price:
      normalizePrice(input.price),
    viewedAt:
      new Date().toISOString(),
  };

  const current =
    await readAll();

  const next = [
    item,
    ...current.filter(
      (candidate) =>
        candidate.id !== id,
    ),
  ].slice(
    0,
    MAX_STORED_ITEMS,
  );

  await writeAll(next);
  emit(next);

  return next;
}

export async function clearRecentlyViewed():
  Promise<void> {
  try {
    await AsyncStorage.removeItem(
      STORAGE_KEY,
    );
  } catch {
    // Non-critical local preference.
  }

  emit([]);
}

export function subscribeRecentlyViewed(
  listener: (
    items: RecentlyViewedItem[],
  ) => void,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
