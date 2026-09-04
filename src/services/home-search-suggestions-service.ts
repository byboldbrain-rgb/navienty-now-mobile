import { publicSupabase } from '../lib/supabase';
import {
  recordStartupTimingOnce,
} from './startup-performance-service';

const HOME_SEARCH_STORE_BATCH_SIZE = 50;
const HOME_SEARCH_BATCH_CONCURRENCY = 3;

type HomeSearchCatalogCategoryRow = {
  id: string;
  store_id: string;
  parent_id: string | null;
  name_ar: string | null;
};

function chunkStoreIds(
  storeIds: readonly string[],
): string[][] {
  const batches: string[][] = [];

  for (
    let index = 0;
    index < storeIds.length;
    index += HOME_SEARCH_STORE_BATCH_SIZE
  ) {
    batches.push(
      storeIds.slice(
        index,
        index + HOME_SEARCH_STORE_BATCH_SIZE,
      ),
    );
  }

  return batches;
}

function normalizeStoreIds(
  storeIds: readonly string[],
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const storeId of storeIds) {
    const value = storeId.trim();

    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

async function loadActiveCategoryRows(
  storeIds: readonly string[],
): Promise<HomeSearchCatalogCategoryRow[]> {
  if (storeIds.length === 0) {
    return [];
  }

  const nowClient =
    (publicSupabase as any).schema(
      'now',
    );

  const { data, error } =
    await nowClient
      .from('catalog_categories')
      .select(
        'id,store_id,parent_id,name_ar,sort_order,created_at',
      )
      .in('store_id', storeIds)
      .eq('is_active', true)
      .order('store_id', {
        ascending: true,
      })
      .order('sort_order', {
        ascending: true,
      })
      .order('created_at', {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? (data as HomeSearchCatalogCategoryRow[])
    : [];
}

function collectEffectiveCategoryNames(
  categoryRows: readonly HomeSearchCatalogCategoryRow[],
): string[] {
  if (categoryRows.length === 0) {
    return [];
  }

  const categoryById = new Map(
    categoryRows.map(
      (category) => [
        category.id,
        category,
      ] as const,
    ),
  );

  /*
   * Every row in this collection is active itself. Requiring every ancestor
   * to exist in the same active result set prevents an active child from
   * leaking into Home search suggestions when its parent category is disabled.
   */
  const effectivelyActiveMemo =
    new Map<string, boolean>();

  const isEffectivelyActive = (
    category: HomeSearchCatalogCategoryRow,
    visited = new Set<string>(),
  ): boolean => {
    const cached =
      effectivelyActiveMemo.get(
        category.id,
      );

    if (cached !== undefined) {
      return cached;
    }

    if (!category.parent_id) {
      effectivelyActiveMemo.set(
        category.id,
        true,
      );
      return true;
    }

    if (visited.has(category.id)) {
      effectivelyActiveMemo.set(
        category.id,
        false,
      );
      return false;
    }

    const parent = categoryById.get(
      category.parent_id,
    );

    if (!parent) {
      effectivelyActiveMemo.set(
        category.id,
        false,
      );
      return false;
    }

    const nextVisited = new Set(visited);
    nextVisited.add(category.id);

    const result = isEffectivelyActive(
      parent,
      nextVisited,
    );

    effectivelyActiveMemo.set(
      category.id,
      result,
    );

    return result;
  };

  const effectiveCategories =
    categoryRows.filter(
      (category) =>
        isEffectivelyActive(category),
    );

  const activeNestedCategories =
    effectiveCategories.filter(
      (category) =>
        category.parent_id !== null,
    );

  const sourceCategories =
    activeNestedCategories.length > 0
      ? activeNestedCategories
      : effectiveCategories;

  return sourceCategories
    .map(
      (category) =>
        category.name_ar?.trim() ?? '',
    )
    .filter(Boolean);
}

export async function loadHomeSearchSuggestionNames(
  storeIds: readonly string[],
): Promise<string[]> {
  const startedAt = Date.now();
  const normalizedStoreIds =
    normalizeStoreIds(storeIds);

  recordStartupTimingOnce(
    'home-stores-ready-for-search',
    0,
    {
      storeCount: normalizedStoreIds.length,
    },
  );

  if (normalizedStoreIds.length === 0) {
    recordStartupTimingOnce(
      'home-search-suggestions-total',
      Date.now() - startedAt,
      {
        batchCount: 0,
        storeCount: 0,
        suggestionCount: 0,
      },
    );

    return [];
  }

  const batches = chunkStoreIds(
    normalizedStoreIds,
  );

  const rowsByStore = new Map<
    string,
    HomeSearchCatalogCategoryRow[]
  >();

  let nextBatchIndex = 0;

  async function worker() {
    while (true) {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;

      if (batchIndex >= batches.length) {
        return;
      }

      const batch = batches[batchIndex];

      if (!batch) {
        continue;
      }

      try {
        const rows =
          await loadActiveCategoryRows(
            batch,
          );

        for (const row of rows) {
          const storeId =
            row.store_id?.trim() ?? '';

          if (!storeId) {
            continue;
          }

          const currentRows =
            rowsByStore.get(storeId);

          if (currentRows) {
            currentRows.push(row);
          } else {
            rowsByStore.set(
              storeId,
              [row],
            );
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(
            'Unable to load active Home search suggestion categories.',
            batch,
            error,
          );
        }
      }
    }
  }

  const workerCount = Math.min(
    HOME_SEARCH_BATCH_CONCURRENCY,
    batches.length,
  );

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => worker(),
    ),
  );

  const names: string[] = [];
  const seenNames = new Set<string>();

  for (const storeId of normalizedStoreIds) {
    const storeNames =
      collectEffectiveCategoryNames(
        rowsByStore.get(storeId) ?? [],
      );

    for (const name of storeNames) {
      const normalizedName =
        name.toLocaleLowerCase('ar');

      if (seenNames.has(normalizedName)) {
        continue;
      }

      seenNames.add(normalizedName);
      names.push(name);
    }
  }

  recordStartupTimingOnce(
    'home-search-suggestions-total',
    Date.now() - startedAt,
    {
      batchCount: batches.length,
      storeCount: normalizedStoreIds.length,
      suggestionCount: names.length,
    },
  );

  return names;
}
