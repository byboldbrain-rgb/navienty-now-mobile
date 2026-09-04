export const SEARCH_SCOPES = {
  restaurants: {
    key: 'restaurants',
    label: 'المطاعم',
    discoveryTitle: 'نفسك تطلب منين؟',
    placeholderFallback: 'بيتزا',
    storeResultsTitle: 'المطاعم',
    storeCategorySlug: 'restaurants',
    aliases: [
      'restaurants',
      'restaurant',
      'food',
    ],
    discoveryMode: 'stores',
    storeNavigation: {
      kind: 'store-detail',
    },
    categoryNavigation: {
      kind: 'store-detail',
    },
    showInGlobalTabs: true,
  },

  supermarket: {
    key: 'supermarket',
    label: 'الماركت',
    discoveryTitle: 'ناقصك إيه من الماركت؟',
    placeholderFallback: 'منتج',
    storeResultsTitle: 'المتاجر',
    storeCategorySlug: 'supermarket',
    aliases: [
      'supermarket',
      'supermarkets',
      'market',
      'grocery',
    ],
    discoveryMode: 'categories',
    storeNavigation: {
      kind: 'category-home',
      pathname: '/category/supermarket',
    },
    categoryNavigation: {
      kind: 'catalog-category',
      pathname:
        '/supermarket-category/[slug]',
    },
    showInGlobalTabs: true,
  },

  bookstore: {
    key: 'bookstore',
    label: 'المكتبة',
    discoveryTitle: 'محتاج إيه للمذاكرة؟',
    placeholderFallback: 'أقلام',
    storeResultsTitle: 'المتاجر',
    storeCategorySlug: 'bookstore',
    aliases: [
      'bookstore',
      'bookstores',
      'book-store',
      'library',
      'books',
      'stationery',
    ],
    discoveryMode: 'categories',
    storeNavigation: {
      kind: 'category-home',
      pathname: '/category/bookstore',
    },
    categoryNavigation: {
      kind: 'catalog-category',
      pathname:
        '/bookstore-category/[slug]',
    },
    showInGlobalTabs: true,
  },

  'personal-care': {
    key: 'personal-care',
    label: 'العناية',
    discoveryTitle: 'روتينك ناقصه إيه؟',
    placeholderFallback: 'العناية بالبشرة',
    storeResultsTitle: 'المتاجر',
    storeCategorySlug: 'personal-care',
    aliases: [
      'personal-care',
      'personalcare',
      'beauty',
      'beauty-care',
      'health-beauty',
      'care',
    ],
    discoveryMode: 'categories',
    storeNavigation: {
      kind: 'category-home',
      pathname: '/category/personal-care',
    },
    categoryNavigation: {
      kind: 'catalog-category',
      pathname:
        '/personal-care-category/[slug]',
    },
    showInGlobalTabs: true,
  },
} as const;

export type SearchScopeKey =
  keyof typeof SEARCH_SCOPES;

export type SearchScopeConfig =
  (typeof SEARCH_SCOPES)[SearchScopeKey];

export const SEARCH_SCOPE_TABS =
  Object.values(SEARCH_SCOPES).filter(
    (scope) => scope.showInGlobalTabs,
  );

function normalizeSearchScopeValue(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

export function resolveSearchScope(
  value:
    | string
    | string[]
    | null
    | undefined,
): SearchScopeKey | null {
  const rawValue = Array.isArray(value)
    ? value[0]
    : value;

  const normalizedValue =
    normalizeSearchScopeValue(rawValue);

  if (!normalizedValue) {
    return null;
  }

  for (const scope of Object.values(
    SEARCH_SCOPES,
  )) {
    if (
      scope.key === normalizedValue ||
      scope.aliases.some(
        (alias) =>
          normalizeSearchScopeValue(
            alias,
          ) === normalizedValue,
      )
    ) {
      return scope.key;
    }
  }

  return null;
}

export function getSearchScopeForCategorySlug(
  value: string | null | undefined,
): SearchScopeKey | null {
  return resolveSearchScope(value);
}
