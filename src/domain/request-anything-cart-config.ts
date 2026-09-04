export type RequestAnythingStoreCandidate = {
  id: string;
  slug?: string | null;
  categorySlug?: string | null;
  name?: string | null;
  icon?: string | null;
  deliveryFee?: number | null;
  minimumOrder?: number | null;
};

export type RequestAnythingProductCandidate = {
  id: string;
  slug?: string | null;
  name?: string | null;
  icon?: string | null;
};

export type RequestAnythingCatalogCandidate = {
  sections?: Array<{
    products?: RequestAnythingProductCandidate[] | null;
  }> | null;
};

export type RequestAnythingCartConfiguration = {
  storeId: string;
  productId: string;
  storeName: string;
  storeIcon: string;
  categorySlug: string;
  deliveryFee: number;
  minimumOrder: number;
  productName: string;
  productIcon: string;
  source: 'remote' | 'legacy-fallback';
};

const REQUEST_ANYTHING_CATEGORY_SLUG =
  'request-anything';

const REQUEST_ANYTHING_CATEGORY_ALIASES =
  new Set([
    'request-anything',
    'anything',
    'other',
    'special-request',
  ]);

const REQUEST_ANYTHING_PRODUCT_ALIASES =
  new Set([
    'request-anything',
    'anything',
    'special-request',
    'custom-request',
    'request-anything-item',
  ]);

const LEGACY_REQUEST_ANYTHING_CART_CONFIGURATION:
  RequestAnythingCartConfiguration = {
    storeId:
      '4ebd8b80-8288-4c9b-980a-f15b5274e78b',
    productId:
      'b260c5e5-e6cb-462b-b025-627d7bb2cff2',
    storeName:
      'اطلب أي حاجة',
    storeIcon:
      '🛍️',
    categorySlug:
      REQUEST_ANYTHING_CATEGORY_SLUG,
    deliveryFee: 25,
    minimumOrder: 0,
    productName:
      'اطلب أي حاجة',
    productIcon:
      '🛍️',
    source:
      'legacy-fallback',
  };

function normalizeSlug(
  value: string | null | undefined,
) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

function isRequestAnythingStore(
  store: RequestAnythingStoreCandidate,
) {
  return (
    REQUEST_ANYTHING_CATEGORY_ALIASES.has(
      normalizeSlug(store.categorySlug),
    ) ||
    REQUEST_ANYTHING_CATEGORY_ALIASES.has(
      normalizeSlug(store.slug),
    )
  );
}

function isRequestAnythingProduct(
  product: RequestAnythingProductCandidate,
) {
  if (
    REQUEST_ANYTHING_PRODUCT_ALIASES.has(
      normalizeSlug(product.slug),
    )
  ) {
    return true;
  }

  const normalizedName =
    (product.name ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();

  return (
    normalizedName === 'اطلب أي حاجة' ||
    normalizedName === 'request anything'
  );
}

function isValidNonNegativeNumber(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0
  );
}

export function getLegacyRequestAnythingCartConfiguration():
  RequestAnythingCartConfiguration {
  return {
    ...LEGACY_REQUEST_ANYTHING_CART_CONFIGURATION,
  };
}

export function findRequestAnythingStore(
  stores:
    readonly RequestAnythingStoreCandidate[],
): RequestAnythingStoreCandidate | null {
  return (
    stores.find(
      isRequestAnythingStore,
    ) ?? null
  );
}

export function resolveRequestAnythingCartConfiguration(
  stores:
    readonly RequestAnythingStoreCandidate[],
  catalog:
    RequestAnythingCatalogCandidate | null | undefined,
): RequestAnythingCartConfiguration | null {
  const store =
    findRequestAnythingStore(stores);

  if (!store?.id) {
    return null;
  }

  const products =
    (catalog?.sections ?? [])
      .flatMap(
        (section) =>
          section.products ?? [],
      )
      .filter(
        (product, index, allProducts) =>
          allProducts.findIndex(
            (candidate) =>
              candidate.id === product.id,
          ) === index,
      );

  const explicitProduct =
    products.find(
      isRequestAnythingProduct,
    ) ?? null;

  const product =
    explicitProduct ??
    (
      products.length === 1
        ? products[0]
        : null
    );

  if (!product?.id) {
    return null;
  }

  if (
    !isValidNonNegativeNumber(
      store.deliveryFee,
    ) ||
    !isValidNonNegativeNumber(
      store.minimumOrder,
    )
  ) {
    return null;
  }

  return {
    storeId:
      store.id,
    productId:
      product.id,
    storeName:
      store.name?.trim() ||
      'اطلب أي حاجة',
    storeIcon:
      store.icon?.trim() ||
      '🛍️',
    categorySlug:
      normalizeSlug(
        store.categorySlug,
      ) ||
      REQUEST_ANYTHING_CATEGORY_SLUG,
    deliveryFee:
      store.deliveryFee,
    minimumOrder:
      store.minimumOrder,
    productName:
      product.name?.trim() ||
      'اطلب أي حاجة',
    productIcon:
      product.icon?.trim() ||
      '🛍️',
    source:
      'remote',
  };
}
