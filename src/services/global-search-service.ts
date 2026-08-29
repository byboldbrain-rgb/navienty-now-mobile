import {
    type CatalogProduct,
    type CatalogSection,
    getStoreCatalog,
    listStores,
    type StoreCatalog,
    type StoreSummary,
} from './catalog-service';

export type GlobalSearchServiceKey =
  | 'restaurants'
  | 'supermarket'
  | 'bookstore'
  | 'personal-care'
  | 'laundry'
  | 'request-anything';

export type GlobalSearchResult =
  | {
      id: string;
      kind: 'service';
      serviceKey: GlobalSearchServiceKey;
      title: string;
      subtitle: string;
      icon: string;
    }
  | {
      id: string;
      kind: 'store';
      storeId: string;
      storeCategorySlug: string;
      title: string;
      subtitle: string;
      icon: string;
      imageUrl: string | null;
      rating: number;
      deliveryTime: string;
      isManuallyClosed: boolean;
    }
  | {
      id: string;
      kind: 'category';
      storeId: string;
      storeCategorySlug: string;
      sectionId: string;
      sectionSlug: string;
      title: string;
      subtitle: string;
      imageUrl: string | null;
      storeName: string;
    }
  | {
      id: string;
      kind: 'product';
      productId: string;
      storeId: string;
      storeCategorySlug: string;
      sectionId: string;
      sectionSlug: string;
      title: string;
      subtitle: string;
      description: string;
      icon: string;
      imageUrl: string | null;
      price: number;
      compareAtPrice: number | null;
      storeName: string;
      categoryName: string;
    };

export type GlobalSearchResponse = {
  query: string;
  results: GlobalSearchResult[];
  failedStoreCount: number;
  indexedStoreCount: number;
};

type SearchIndexEntry = {
  result: GlobalSearchResult;
  searchableFields: Array<{
    value: string;
    weight: number;
  }>;
};

type GlobalSearchIndex = {
  entries: SearchIndexEntry[];
  failedStoreCount: number;
  indexedStoreCount: number;
};

type TimedIndexEntry = {
  value: GlobalSearchIndex;
  expiresAt: number;
};

const SEARCH_INDEX_TTL_MS = 2 * 60 * 1000;
const SEARCH_CATALOG_CONCURRENCY = 4;
const MAX_SEARCH_RESULTS = 36;

const indexCache =
  new Map<string, TimedIndexEntry>();

const indexRequests =
  new Map<string, Promise<GlobalSearchIndex>>();

export const GLOBAL_SEARCH_SERVICES: ReadonlyArray<{
  key: GlobalSearchServiceKey;
  title: string;
  subtitle: string;
  icon: string;
  keywords: string[];
}> = [
  {
    key: 'restaurants',
    title: 'المطاعم',
    subtitle: 'مطاعم وأكل',
    icon: 'restaurant-outline',
    keywords: [
      'مطاعم',
      'مطعم',
      'اكل',
      'أكل',
      'food',
      'restaurant',
      'restaurants',
      'بيتزا',
      'كريب',
      'ساندوتش',
    ],
  },
  {
    key: 'supermarket',
    title: 'الماركت',
    subtitle: 'بقالة ومشروبات واحتياجات البيت',
    icon: 'basket-outline',
    keywords: [
      'ماركت',
      'سوبرماركت',
      'سوبر ماركت',
      'بقالة',
      'مشروبات',
      'supermarket',
      'market',
      'grocery',
    ],
  },
  {
    key: 'bookstore',
    title: 'المكتبة',
    subtitle: 'كراسات وأدوات كتابة ومذاكرة',
    icon: 'book-outline',
    keywords: [
      'مكتبة',
      'كراسات',
      'كشكول',
      'اقلام',
      'أقلام',
      'stationery',
      'bookstore',
      'books',
    ],
  },
  {
    key: 'personal-care',
    title: 'العناية',
    subtitle: 'عناية شخصية وتجميل',
    icon: 'sparkles-outline',
    keywords: [
      'عناية',
      'العناية',
      'تجميل',
      'بشرة',
      'شعر',
      'beauty',
      'personal care',
      'care',
    ],
  },
  {
    key: 'laundry',
    title: 'الغسيل والكي',
    subtitle: 'خدمة الغسيل والكي',
    icon: 'shirt-outline',
    keywords: [
      'غسيل',
      'كي',
      'مكواة',
      'غسيل وكي',
      'laundry',
      'washing',
      'ironing',
    ],
  },
  {
    key: 'request-anything',
    title: 'اطلب أي حاجة',
    subtitle: 'قولنا محتاج إيه ومنين',
    icon: 'flash-outline',
    keywords: [
      'اطلب اي حاجة',
      'اطلب أي حاجة',
      'أي حاجة',
      'اي حاجة',
      'طلب خاص',
      'anything',
      'request anything',
    ],
  },
];

function normalizeSearchText(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSearchTokens(
  value: string,
): string[] {
  return normalizeSearchText(value)
    .split(' ')
    .filter(Boolean);
}

function scoreField(
  normalizedQuery: string,
  queryTokens: string[],
  rawValue: string,
  weight: number,
): number {
  const value =
    normalizeSearchText(rawValue);

  if (!value) {
    return 0;
  }

  let score = 0;

  if (value === normalizedQuery) {
    score = 150;
  } else if (
    value.startsWith(normalizedQuery)
  ) {
    score = 118;
  } else if (
    value
      .split(' ')
      .some((word) =>
        word.startsWith(
          normalizedQuery,
        ),
      )
  ) {
    score = 98;
  } else if (
    value.includes(normalizedQuery)
  ) {
    score = 80;
  }

  if (queryTokens.length > 1) {
    const matchedTokenCount =
      queryTokens.filter((token) =>
        value.includes(token),
      ).length;

    if (
      matchedTokenCount ===
      queryTokens.length
    ) {
      score = Math.max(
        score,
        92 +
          queryTokens.length * 4,
      );
    } else if (
      matchedTokenCount > 0
    ) {
      score = Math.max(
        score,
        45 +
          matchedTokenCount * 8,
      );
    }
  }

  return score * weight;
}

function getResultKindBoost(
  result: GlobalSearchResult,
): number {
  switch (result.kind) {
    case 'service':
      return 22;
    case 'store':
      return 17;
    case 'category':
      return 10;
    case 'product':
      return 8;
  }
}

function getProductImage(
  product: CatalogProduct,
): string | null {
  if (product.imageUrl) {
    return product.imageUrl;
  }

  return (
    product.images.find(
      (image) => image.isCover,
    )?.imageUrl ??
    product.images[0]?.imageUrl ??
    null
  );
}

function collectSections(
  sections: readonly CatalogSection[],
): CatalogSection[] {
  const result: CatalogSection[] = [];
  const seen = new Set<string>();

  function visit(
    section: CatalogSection,
  ) {
    if (seen.has(section.id)) {
      return;
    }

    seen.add(section.id);
    result.push(section);

    for (
      const child of
      section.children ?? []
    ) {
      visit(child);
    }
  }

  for (const section of sections) {
    visit(section);
  }

  return result;
}

function createServiceEntries():
  SearchIndexEntry[] {
  return GLOBAL_SEARCH_SERVICES.map(
    (service) => ({
      result: {
        id: `service:${service.key}`,
        kind: 'service',
        serviceKey: service.key,
        title: service.title,
        subtitle: service.subtitle,
        icon: service.icon,
      },
      searchableFields: [
        {
          value: service.title,
          weight: 1.25,
        },
        {
          value: service.subtitle,
          weight: 0.9,
        },
        ...service.keywords.map(
          (keyword) => ({
            value: keyword,
            weight: 1,
          }),
        ),
      ],
    }),
  );
}

function createStoreEntry(
  store: StoreSummary,
): SearchIndexEntry {
  return {
    result: {
      id: `store:${store.id}`,
      kind: 'store',
      storeId: store.id,
      storeCategorySlug:
        store.categorySlug,
      title: store.name,
      subtitle:
        store.categoryName ||
        store.categorySubtitle ||
        'متجر',
      icon: store.icon || '🏪',
      imageUrl:
        store.logoUrl ??
        store.coverImageUrl,
      rating: store.rating,
      deliveryTime:
        store.deliveryTime,
      isManuallyClosed:
        store.isManuallyClosed,
    },
    searchableFields: [
      {
        value: store.name,
        weight: 1.3,
      },
      {
        value: store.description,
        weight: 0.88,
      },
      {
        value: store.categoryName,
        weight: 0.8,
      },
      {
        value:
          store.categorySubtitle,
        weight: 0.72,
      },
      {
        value:
          store.categorySlug,
        weight: 0.66,
      },
    ],
  };
}

function createCatalogEntries(
  catalog: StoreCatalog,
): SearchIndexEntry[] {
  const result: SearchIndexEntry[] =
    [];

  const sections =
    collectSections(
      catalog.categoryTree?.length
        ? catalog.categoryTree
        : catalog.sections,
    );

  const productEntries =
    new Map<
      string,
      SearchIndexEntry
    >();

  for (const section of sections) {
    result.push({
      result: {
        id:
          `category:${catalog.store.id}:` +
          `${section.id}`,
        kind: 'category',
        storeId: catalog.store.id,
        storeCategorySlug:
          catalog.store.categorySlug,
        sectionId: section.id,
        sectionSlug: section.slug,
        title: section.name,
        subtitle: catalog.store.name,
        imageUrl:
          section.imageUrl ?? null,
        storeName:
          catalog.store.name,
      },
      searchableFields: [
        {
          value: section.name,
          weight: 1.18,
        },
        {
          value:
            section.nameEn ?? '',
          weight: 0.92,
        },
        {
          value: section.slug,
          weight: 0.7,
        },
        {
          value:
            catalog.store.name,
          weight: 0.52,
        },
      ],
    });

    for (
      const product of
      section.products ?? []
    ) {
      const key =
        `${catalog.store.id}:` +
        `${product.id}`;

      const shouldReplace =
        !productEntries.has(key) ||
        product.catalogCategoryId ===
          section.id;

      if (!shouldReplace) {
        continue;
      }

      productEntries.set(
        key,
        {
          result: {
            id:
              `product:${catalog.store.id}:` +
              `${product.id}`,
            kind: 'product',
            productId:
              product.id,
            storeId:
              catalog.store.id,
            storeCategorySlug:
              catalog.store
                .categorySlug,
            sectionId:
              section.id,
            sectionSlug:
              section.slug,
            title:
              product.name,
            subtitle:
              catalog.store.name,
            description:
              product.description,
            icon:
              product.icon || '📦',
            imageUrl:
              getProductImage(
                product,
              ),
            price:
              Number(
                product.price ?? 0,
              ),
            compareAtPrice:
              product.compareAtPrice,
            storeName:
              catalog.store.name,
            categoryName:
              section.name,
          },
          searchableFields: [
            {
              value:
                product.name,
              weight: 1.35,
            },
            {
              value:
                product.nameEn ?? '',
              weight: 1.02,
            },
            {
              value:
                product.description,
              weight: 0.74,
            },
            {
              value:
                product.descriptionEn ??
                '',
              weight: 0.62,
            },
            {
              value:
                product.sku ?? '',
              weight: 0.84,
            },
            {
              value:
                product.barcode ?? '',
              weight: 0.86,
            },
            {
              value:
                product.unitLabelAr ??
                '',
              weight: 0.58,
            },
            {
              value:
                section.name,
              weight: 0.5,
            },
            {
              value:
                catalog.store.name,
              weight: 0.46,
            },
            ...(
              product.variants ?? []
            ).flatMap(
              (variant) => [
                {
                  value:
                    variant.name,
                  weight: 0.68,
                },
                {
                  value:
                    variant.nameEn ??
                    '',
                  weight: 0.56,
                },
                {
                  value:
                    variant.sku ?? '',
                  weight: 0.64,
                },
                {
                  value:
                    variant.barcode ??
                    '',
                  weight: 0.66,
                },
              ],
            ),
          ],
        },
      );
    }
  }

  result.push(
    ...productEntries.values(),
  );

  return result;
}

async function mapWithConcurrency<
  T,
  R
>(
  items: readonly T[],
  concurrency: number,
  worker: (
    item: T,
  ) => Promise<R>,
): Promise<
  Array<
    | {
        status: 'fulfilled';
        value: R;
      }
    | {
        status: 'rejected';
        reason: unknown;
      }
  >
> {
  const results: Array<
    | {
        status: 'fulfilled';
        value: R;
      }
    | {
        status: 'rejected';
        reason: unknown;
      }
  > = new Array(items.length);

  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      try {
        results[index] = {
          status: 'fulfilled',
          value:
            await worker(
              items[index],
            ),
        };
      } catch (error) {
        results[index] = {
          status: 'rejected',
          reason: error,
        };
      }
    }
  }

  const runnerCount =
    Math.min(
      Math.max(1, concurrency),
      Math.max(1, items.length),
    );

  await Promise.all(
    Array.from(
      {
        length: runnerCount,
      },
      () => runner(),
    ),
  );

  return results;
}

function getIndexCacheKey(
  serviceAreaId?: string | null,
): string {
  return (
    serviceAreaId?.trim() ||
    '*'
  );
}

async function buildGlobalSearchIndex(
  serviceAreaId?: string | null,
): Promise<GlobalSearchIndex> {
  const normalizedServiceAreaId =
    serviceAreaId?.trim() ||
    undefined;

  const stores =
    await listStores({
      serviceAreaId:
        normalizedServiceAreaId,
    });

  const entries: SearchIndexEntry[] = [
    ...createServiceEntries(),
    ...stores.map(
      createStoreEntry,
    ),
  ];

  const catalogResults =
    await mapWithConcurrency(
      stores,
      SEARCH_CATALOG_CONCURRENCY,
      (store) =>
        getStoreCatalog(
          store.id,
          normalizedServiceAreaId,
        ),
    );

  let failedStoreCount = 0;
  let indexedStoreCount = 0;

  for (
    const catalogResult of
    catalogResults
  ) {
    if (
      catalogResult.status ===
      'rejected'
    ) {
      failedStoreCount += 1;
      continue;
    }

    indexedStoreCount += 1;
    entries.push(
      ...createCatalogEntries(
        catalogResult.value,
      ),
    );
  }

  return {
    entries,
    failedStoreCount,
    indexedStoreCount,
  };
}

export async function prepareGlobalSearchIndex(
  serviceAreaId?: string | null,
): Promise<GlobalSearchIndex> {
  const key =
    getIndexCacheKey(
      serviceAreaId,
    );

  const cached =
    indexCache.get(key);

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return cached.value;
  }

  if (cached) {
    indexCache.delete(key);
  }

  const pending =
    indexRequests.get(key);

  if (pending) {
    return pending;
  }

  const request =
    buildGlobalSearchIndex(
      serviceAreaId,
    ).then((value) => {
      indexCache.set(key, {
        value,
        expiresAt:
          Date.now() +
          SEARCH_INDEX_TTL_MS,
      });

      return value;
    });

  indexRequests.set(
    key,
    request,
  );

  try {
    return await request;
  } finally {
    if (
      indexRequests.get(key) ===
      request
    ) {
      indexRequests.delete(key);
    }
  }
}

export async function searchGlobalCatalog(
  query: string,
  serviceAreaId?: string | null,
): Promise<GlobalSearchResponse> {
  const normalizedQuery =
    normalizeSearchText(query);

  if (
    normalizedQuery.length < 2
  ) {
    return {
      query,
      results: [],
      failedStoreCount: 0,
      indexedStoreCount: 0,
    };
  }

  const queryTokens =
    getSearchTokens(query);

  const index =
    await prepareGlobalSearchIndex(
      serviceAreaId,
    );

  const scored = index.entries
    .map((entry) => {
      const fieldScore =
        entry.searchableFields.reduce(
          (bestScore, field) =>
            Math.max(
              bestScore,
              scoreField(
                normalizedQuery,
                queryTokens,
                field.value,
                field.weight,
              ),
            ),
          0,
        );

      return {
        result: entry.result,
        score:
          fieldScore > 0
            ? fieldScore +
              getResultKindBoost(
                entry.result,
              )
            : 0,
      };
    })
    .filter(
      (item) => item.score > 0,
    )
    .sort(
      (first, second) =>
        second.score -
          first.score ||
        first.result.title.localeCompare(
          second.result.title,
          'ar',
        ),
    );

  const seen =
    new Set<string>();

  const results:
    GlobalSearchResult[] = [];

  for (const item of scored) {
    if (
      seen.has(item.result.id)
    ) {
      continue;
    }

    seen.add(item.result.id);
    results.push(item.result);

    if (
      results.length >=
      MAX_SEARCH_RESULTS
    ) {
      break;
    }
  }

  return {
    query,
    results,
    failedStoreCount:
      index.failedStoreCount,
    indexedStoreCount:
      index.indexedStoreCount,
  };
}

export function invalidateGlobalSearchIndex(
  serviceAreaId?: string | null,
) {
  if (serviceAreaId) {
    indexCache.delete(
      getIndexCacheKey(
        serviceAreaId,
      ),
    );
    return;
  }

  indexCache.clear();
}
