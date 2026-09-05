import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  createJSONStorage,
  persist,
} from 'zustand/middleware';
import {
  isV1PublicCategorySlug,
} from '../config/v1-release-scope';
import {
  trackBehaviorEvent,
} from '../services/behavioral-analytics-service';
import {
  getMatchingSearchAttributionForCartAdd,
} from '../services/search-attribution-service';
import type {
  PrintJobSnapshot,
} from '../types/printing';
import {
  normalizePrintingUiCopy,
  normalizePrintingUiIcons,
} from '../types/printing';

export type CartItemKind =
  | 'catalog_product'
  | 'print_job';

export type CartProduct = {
  /**
   * Base product ID from now.products.id.
   */
  id: string;

  name: string;
  description: string;
  price: number;
  icon: string;

  /** Stable identity for a semantic cart row. */
  lineId?: string;

  itemKind?: CartItemKind;

  /** Server-authoritative quote snapshot for a print job. */
  printJob?:
    | PrintJobSnapshot
    | null;

  /**
   * Selected variant/size from now.product_variants.id.
   *
   * null = product has no selected variant.
   */
  variantId?: string | null;

  /**
   * Snapshot of the selected variant name.
   * Example: Small / Large / X-Large.
   */
  variantName?: string | null;

  /**
   * Snapshot used by checkout to know whether this product
   * requires age verification.
   */
  isAgeRestricted?: boolean;
};

export type CartItem = CartProduct & {
  quantity: number;

  lineId: string;
  itemKind: CartItemKind;
  printJob: PrintJobSnapshot | null;

  /**
   * Normalized in persisted/current state so consumers can
   * safely distinguish the same product with different sizes.
   */
  variantId: string | null;
  variantName: string | null;
  isAgeRestricted: boolean;
};

export type CartStoreInformation = {
  id: string;
  name: string;
  icon: string;

  /**
   * Store category slug.
   *
   * Examples:
   * restaurants / supermarket / pharmacy / library
   *
   * It is optional temporarily so older screens that have not
   * been migrated yet keep compiling. New/updated screens should
   * always pass it.
   */
  categorySlug?: string | null;

  deliveryFee: number;
  minimumOrder: number;
};

export type StoreCart = {
  storeId: string;
  storeName: string;
  storeIcon: string;
  categorySlug: string | null;

  deliveryFee: number;
  minimumOrder: number;

  items: CartItem[];
};

export type AddItemResult =
  | 'added'
  | 'different-restaurant'
  | 'unsupported-category';

type CartState = {
  /**
   * The real cart state.
   *
   * Every store has its own isolated cart, keyed by store ID.
   */
  carts: Record<string, StoreCart>;

  /**
   * Last cart opened/used.
   *
   * This is also used to keep the old single-cart API working
   * while the rest of the app is migrated screen by screen.
   */
  activeStoreId: string | null;

  /**
   * -----------------------------------------------------------------
   * LEGACY COMPATIBILITY FIELDS
   * -----------------------------------------------------------------
   *
   * Older screens still read state.storeId / state.items directly.
   * These fields mirror the active cart only.
   *
   * New screens should prefer state.carts[storeId].
   */
  storeId: string | null;
  storeName: string | null;
  storeIcon: string | null;

  deliveryFee: number;
  minimumOrder: number;

  items: CartItem[];

  hasHydrated: boolean;

  addItem: (
    store: CartStoreInformation,
    product: CartProduct,
  ) => AddItemResult;

  /**
   * Legacy actions: operate on the active cart.
   */
  increaseItem: (
    productId: string,
    variantId?: string | null,
  ) => void;

  decreaseItem: (
    productId: string,
    variantId?: string | null,
  ) => void;

  removeItem: (
    productId: string,
    variantId?: string | null,
  ) => void;

  clearCart: () => void;

  /**
   * New store-specific actions.
   */
  setActiveCart: (
    storeId: string | null,
  ) => void;

  increaseStoreItem: (
    storeId: string,
    productId: string,
    variantId?: string | null,
  ) => void;

  decreaseStoreItem: (
    storeId: string,
    productId: string,
    variantId?: string | null,
  ) => void;

  removeStoreItem: (
    storeId: string,
    productId: string,
    variantId?: string | null,
  ) => void;

  /** Removes one semantic row, including a configured print job. */
  removeStoreLine: (
    storeId: string,
    lineId: string,
  ) => void;

  clearStoreCart: (
    storeId: string,
  ) => void;

  clearAllCarts: () => void;

  setHasHydrated: (
    hasHydrated: boolean,
  ) => void;
};

type PersistedCartState = {
  carts: Record<string, StoreCart>;
  activeStoreId: string | null;
};

type LegacyPersistedCartState = {
  storeId?: string | null;
  storeName?: string | null;
  storeIcon?: string | null;

  deliveryFee?: number;
  minimumOrder?: number;

  items?: CartItem[];
};

const EMPTY_ITEMS: CartItem[] = [];

const initialPersistedState: PersistedCartState = {
  carts: {},
  activeStoreId: null,
};

const initialLegacyState = {
  storeId: null,
  storeName: null,
  storeIcon: null,

  deliveryFee: 0,
  minimumOrder: 0,

  items: EMPTY_ITEMS,
};

function normalizeVariantId(
  variantId:
    | string
    | null
    | undefined,
): string | null {
  if (
    typeof variantId !== 'string'
  ) {
    return null;
  }

  const normalizedValue =
    variantId.trim();

  return normalizedValue.length > 0
    ? normalizedValue
    : null;
}

function normalizeVariantName(
  variantName:
    | string
    | null
    | undefined,
): string | null {
  if (
    typeof variantName !== 'string'
  ) {
    return null;
  }

  const normalizedValue =
    variantName.trim();

  return normalizedValue.length > 0
    ? normalizedValue
    : null;
}

function normalizeCategorySlug(
  categorySlug:
    | string
    | null
    | undefined,
): string | null {
  if (
    typeof categorySlug !== 'string'
  ) {
    return null;
  }

  const normalizedValue =
    categorySlug
      .trim()
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/\s+/g, '-');

  return normalizedValue.length > 0
    ? normalizedValue
    : null;
}

function normalizeLineId(
  value:
    | string
    | null
    | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}

function normalizePositiveInteger(
  value: unknown,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    parsed > 0
    ? Math.floor(parsed)
    : 0;
}

function normalizeFiniteNumber(
  value: unknown,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function normalizePrintJobSnapshot(
  value: unknown,
): PrintJobSnapshot | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null;
  }

  const candidate =
    value as Partial<PrintJobSnapshot>;

  const requiredIds = [
    candidate.printingServiceId,
    candidate.storeId,
    candidate.catalogCategoryId,
    candidate.categorySlug,
    candidate.productId,
    candidate.productVariantId,
    candidate.colorOptionId,
    candidate.sideOptionId,
  ];

  if (
    requiredIds.some(
      (id) =>
        typeof id !== 'string' ||
        id.trim().length === 0,
    )
  ) {
    return null;
  }

  const pageCount =
    normalizePositiveInteger(
      candidate.pageCount,
    );
  const copyCount =
    normalizePositiveInteger(
      candidate.copyCount,
    );
  const totalSheets =
    normalizePositiveInteger(
      candidate.totalSheets,
    );

  if (
    pageCount <= 0 ||
    copyCount <= 0 ||
    totalSheets <= 0
  ) {
    return null;
  }

  return {
    printingServiceId:
      candidate.printingServiceId!,
    storeId: candidate.storeId!,
    catalogCategoryId:
      candidate.catalogCategoryId!,
    categorySlug:
      candidate.categorySlug!,
    productId: candidate.productId!,
    productVariantId:
      candidate.productVariantId!,
    productName:
      String(
        candidate.productName ??
          'طلب طباعة A4',
      ),
    productIcon:
      String(
        candidate.productIcon ??
          '🖨️',
      ),
    colorOptionId:
      candidate.colorOptionId!,
    colorKey:
      String(
        candidate.colorKey ?? '',
      ),
    colorLabel:
      String(
        candidate.colorLabel ?? '',
      ),
    sideOptionId:
      candidate.sideOptionId!,
    sideKey:
      String(
        candidate.sideKey ?? '',
      ),
    sideLabel:
      String(
        candidate.sideLabel ?? '',
      ),
    pagesPerSheet: Math.max(
      normalizePositiveInteger(
        candidate.pagesPerSheet,
      ),
      1,
    ),
    pageSizeLabel:
      String(
        candidate.pageSizeLabel ??
          'A4',
      ),
    pageCount,
    copyCount,
    sheetsPerCopy:
      normalizePositiveInteger(
        candidate.sheetsPerCopy,
      ),
    totalSheets,
    pricePerSheet:
      normalizeFiniteNumber(
        candidate.pricePerSheet,
      ),
    totalPrice:
      normalizeFiniteNumber(
        candidate.totalPrice,
      ),
    summary:
      String(
        candidate.summary ?? '',
      ),
    whatsappFilePrompt:
      String(
        candidate.whatsappFilePrompt ??
          '',
      ),
    uiCopy:
      normalizePrintingUiCopy(
        candidate.uiCopy,
      ),
    uiIcons:
      normalizePrintingUiIcons(
        candidate.uiIcons,
      ),
  };
}

export function isPrintJobCartItem(
  item: CartItem,
): item is CartItem & {
  itemKind: 'print_job';
  printJob: PrintJobSnapshot;
} {
  return (
    item.itemKind === 'print_job' &&
    item.printJob !== null
  );
}

/**
 * Used by screens when they need to apply the restaurant-only rule.
 */
export function isRestaurantCartCategory(
  categorySlug:
    | string
    | null
    | undefined,
) {
  const normalizedSlug =
    normalizeCategorySlug(
      categorySlug,
    );

  return (
    normalizedSlug ===
      'restaurants' ||
    normalizedSlug ===
      'restaurant'
  );
}

/**
 * A cart line is identified by:
 *
 * product ID + selected variant ID
 *
 * Examples:
 *
 * pizza-1 + small
 * pizza-1 + large
 *
 * are two different cart lines.
 */
function isSameCartLine(
  item: CartItem,
  productId: string,
  variantId?:
    | string
    | null,
) {
  return (
    !isPrintJobCartItem(item) &&
    item.id === productId &&
    normalizeVariantId(
      item.variantId,
    ) ===
      normalizeVariantId(
        variantId,
      )
  );
}

function normalizeCartProduct(
  product: CartProduct,
): Omit<CartItem, 'quantity'> {
  const printJob =
    normalizePrintJobSnapshot(
      product.printJob,
    );

  const itemKind: CartItemKind =
    product.itemKind ===
      'print_job' && printJob
      ? 'print_job'
      : 'catalog_product';

  const variantId =
    itemKind === 'print_job'
      ? printJob!.productVariantId
      : normalizeVariantId(
          product.variantId,
        );

  const requestedLineId =
    normalizeLineId(
      product.lineId,
    );

  const lineId =
    requestedLineId ??
    (itemKind === 'print_job'
      ? `print-job:${printJob!.printingServiceId}`
      : `catalog:${product.id}:${variantId ?? 'base'}`);

  return {
    ...product,

    id:
      itemKind === 'print_job'
        ? printJob!.productId
        : product.id,

    name:
      itemKind === 'print_job'
        ? printJob!.productName
        : product.name,

    description:
      itemKind === 'print_job'
        ? printJob!.summary
        : product.description,

    price:
      itemKind === 'print_job'
        ? printJob!.totalPrice
        : normalizeFiniteNumber(
            product.price,
          ),

    icon:
      itemKind === 'print_job'
        ? printJob!.productIcon
        : product.icon,

    lineId,
    itemKind,
    printJob:
      itemKind === 'print_job'
        ? printJob
        : null,

    variantId,

    variantName:
      itemKind === 'print_job'
        ? printJob!.summary
        : normalizeVariantName(
            product.variantName,
          ),

    isAgeRestricted:
      product.isAgeRestricted === true,
  };
}

function normalizeCartItem(
  item: CartItem,
): CartItem {
  const normalizedProduct =
    normalizeCartProduct(item);

  const quantity =
    Number(item.quantity ?? 0);

  return {
    ...normalizedProduct,

    quantity:
      normalizedProduct.itemKind ===
      'print_job'
        ? 1
        : Number.isFinite(quantity) &&
            quantity > 0
          ? Math.floor(quantity)
          : 1,
  };
}

function normalizeStoreCart(
  cart: Partial<StoreCart>,
  fallbackStoreId?: string,
): StoreCart | null {
  const storeId =
    typeof cart.storeId === 'string' &&
    cart.storeId.trim().length > 0
      ? cart.storeId
      : fallbackStoreId ?? null;

  if (!storeId) {
    return null;
  }

  const items = Array.isArray(
    cart.items,
  )
    ? cart.items.map(
        normalizeCartItem,
      )
    : [];

  return {
    storeId,

    storeName:
      typeof cart.storeName ===
        'string'
        ? cart.storeName
        : '',

    storeIcon:
      typeof cart.storeIcon ===
        'string'
        ? cart.storeIcon
        : '🏪',

    categorySlug:
      normalizeCategorySlug(
        cart.categorySlug,
      ),

    deliveryFee:
      typeof cart.deliveryFee ===
        'number' &&
      Number.isFinite(
        cart.deliveryFee,
      )
        ? cart.deliveryFee
        : 0,

    minimumOrder:
      typeof cart.minimumOrder ===
        'number' &&
      Number.isFinite(
        cart.minimumOrder,
      )
        ? cart.minimumOrder
        : 0,

    items,
  };
}

function getFirstCartStoreId(
  carts: Record<
    string,
    StoreCart
  >,
): string | null {
  const firstEntry =
    Object.values(carts).find(
      (cart) =>
        cart.items.length > 0,
    );

  return firstEntry?.storeId ?? null;
}

function getLegacySnapshot(
  carts: Record<
    string,
    StoreCart
  >,
  requestedActiveStoreId:
    | string
    | null,
) {
  const activeStoreId =
    requestedActiveStoreId &&
    carts[requestedActiveStoreId]
      ? requestedActiveStoreId
      : getFirstCartStoreId(
          carts,
        );

  if (!activeStoreId) {
    return {
      activeStoreId: null,
      ...initialLegacyState,
    };
  }

  const cart =
    carts[activeStoreId];

  if (!cart) {
    return {
      activeStoreId: null,
      ...initialLegacyState,
    };
  }

  return {
    activeStoreId,

    storeId: cart.storeId,
    storeName: cart.storeName,
    storeIcon: cart.storeIcon,

    deliveryFee:
      cart.deliveryFee,

    minimumOrder:
      cart.minimumOrder,

    items: cart.items,
  };
}

function normalizePersistedState(
  persistedState: unknown,
): PersistedCartState {
  if (
    !persistedState ||
    typeof persistedState !== 'object'
  ) {
    return initialPersistedState;
  }

  const candidate =
    persistedState as Partial<
      PersistedCartState &
        LegacyPersistedCartState
    >;

  /**
   * Version 3+ multi-cart state.
   */
  if (
    candidate.carts &&
    typeof candidate.carts ===
      'object' &&
    !Array.isArray(
      candidate.carts,
    )
  ) {
    const carts: Record<
      string,
      StoreCart
    > = {};

    Object.entries(
      candidate.carts,
    ).forEach(
      ([storeId, rawCart]) => {
        const normalizedCart =
          normalizeStoreCart(
            rawCart,
            storeId,
          );

        if (
          normalizedCart &&
          normalizedCart.items.length >
            0
        ) {
          carts[
            normalizedCart.storeId
          ] = normalizedCart;
        }
      },
    );

    const requestedActiveStoreId =
      typeof candidate.activeStoreId ===
        'string'
        ? candidate.activeStoreId
        : null;

    return {
      carts,
      activeStoreId:
        requestedActiveStoreId &&
        carts[
          requestedActiveStoreId
        ]
          ? requestedActiveStoreId
          : getFirstCartStoreId(
              carts,
            ),
    };
  }

  /**
   * Version 1 / 2 single-cart migration.
   *
   * Old persisted carts did not save categorySlug, so the old
   * cart is migrated safely with categorySlug = null. The next
   * time that same store receives an item from an updated screen,
   * its category will be refreshed automatically.
   */
  const oldStoreId =
    typeof candidate.storeId ===
      'string' &&
    candidate.storeId.trim().length > 0
      ? candidate.storeId
      : null;

  const oldItems = Array.isArray(
    candidate.items,
  )
    ? candidate.items.map(
        normalizeCartItem,
      )
    : [];

  if (
    !oldStoreId ||
    oldItems.length === 0
  ) {
    return initialPersistedState;
  }

  const migratedCart: StoreCart = {
    storeId: oldStoreId,

    storeName:
      typeof candidate.storeName ===
        'string'
        ? candidate.storeName
        : '',

    storeIcon:
      typeof candidate.storeIcon ===
        'string'
        ? candidate.storeIcon
        : '🏪',

    categorySlug: null,

    deliveryFee:
      typeof candidate.deliveryFee ===
        'number' &&
      Number.isFinite(
        candidate.deliveryFee,
      )
        ? candidate.deliveryFee
        : 0,

    minimumOrder:
      typeof candidate.minimumOrder ===
        'number' &&
      Number.isFinite(
        candidate.minimumOrder,
      )
        ? candidate.minimumOrder
        : 0,

    items: oldItems,
  };

  return {
    carts: {
      [oldStoreId]:
        migratedCart,
    },

    activeStoreId:
      oldStoreId,
  };
}

function getActiveStoreId(
  state: CartState,
): string | null {
  if (
    state.activeStoreId &&
    state.carts[
      state.activeStoreId
    ]
  ) {
    return state.activeStoreId;
  }

  if (
    state.storeId &&
    state.carts[state.storeId]
  ) {
    return state.storeId;
  }

  return getFirstCartStoreId(
    state.carts,
  );
}

function updateStoreCartItems(
  state: CartState,
  storeId: string,
  updater: (
    items: CartItem[],
  ) => CartItem[],
) {
  const currentCart =
    state.carts[storeId];

  if (!currentCart) {
    return state;
  }

  const nextItems = updater(
    currentCart.items,
  );

  const nextCarts = {
    ...state.carts,
  };

  if (nextItems.length === 0) {
    delete nextCarts[storeId];
  } else {
    nextCarts[storeId] = {
      ...currentCart,
      items: nextItems,
    };
  }

  const nextActiveStoreId =
    state.activeStoreId === storeId &&
    nextItems.length === 0
      ? getFirstCartStoreId(
          nextCarts,
        )
      : state.activeStoreId;

  return {
    ...state,

    carts: nextCarts,

    ...getLegacySnapshot(
      nextCarts,
      nextActiveStoreId,
    ),
  };
}

async function trackSuccessfulCartAdd(
  store: CartStoreInformation,
  product: CartProduct,
) {
  const attribution =
    await getMatchingSearchAttributionForCartAdd({
      storeId: store.id,
      storeCategorySlug:
        store.categorySlug,
      productId: product.id,
    });

  void trackBehaviorEvent({
    eventName:
      'cart_item_added',
    searchSessionId:
      attribution?.attribution
        .searchSessionId ??
      null,
    properties: {
      store_id: store.id,
      store_category_slug:
        store.categorySlug ??
        null,
      product_id:
        product.id,
      variant_id:
        product.variantId ??
        null,
      unit_price:
        Number(
          product.price ?? 0,
        ),
      quantity_delta: 1,
      item_kind:
        product.itemKind ??
        'catalog_product',
      print_page_count:
        product.printJob?.pageCount ??
        null,
      print_copy_count:
        product.printJob?.copyCount ??
        null,
      print_total_sheets:
        product.printJob?.totalSheets ??
        null,
      attribution_source:
        attribution
          ? 'search'
          : 'organic',
      attribution_match:
        attribution?.matchType ??
        null,
      query:
        attribution?.attribution
          .query ??
        null,
      clicked_result_type:
        attribution?.attribution
          .resultKind ??
        null,
      clicked_result_rank:
        attribution?.attribution
          .resultRank ??
        null,
    },
  });
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      ...initialPersistedState,
      ...initialLegacyState,

      hasHydrated: false,

      addItem: (
        store,
        product,
      ) => {
        let result: AddItemResult =
          'added';

        set((state) => {
          const categorySlug =
            normalizeCategorySlug(
              store.categorySlug,
            );

          /**
           * V1 release guard.
           *
           * Updated screens send categorySlug. If that explicit category is
           * outside the public V1 scope, keep it out of the cart and let the
           * caller show its existing unsupported-category handling.
           *
           * Missing categorySlug remains backward-compatible with older
           * screens that have not been migrated yet.
           */
          if (
            categorySlug &&
            !isV1PublicCategorySlug(
              categorySlug,
            )
          ) {
            result =
              'unsupported-category';

            return state;
          }

          /**
           * Business rule:
           *
           * A customer can have carts from multiple different
           * stores/categories at the same time, BUT only one
           * restaurant cart may exist at once.
           *
           * Restaurant + supermarket + pharmacy + library = OK.
           * Restaurant A + Restaurant B = blocked.
           */
          if (
            isRestaurantCartCategory(
              categorySlug,
            )
          ) {
            const anotherRestaurantCart =
              Object.values(
                state.carts,
              ).find(
                (cart) =>
                  cart.items.length > 0 &&
                  cart.storeId !==
                    store.id &&
                  isRestaurantCartCategory(
                    cart.categorySlug,
                  ),
              );

            if (
              anotherRestaurantCart
            ) {
              result =
                'different-restaurant';

              return state;
            }
          }

          const normalizedProduct =
            normalizeCartProduct(
              product,
            );

          const existingCart =
            state.carts[store.id];

          const currentItems =
            existingCart?.items ?? [];

          const existingItem =
            currentItems.find(
              (item) =>
                item.lineId ===
                normalizedProduct.lineId,
            );

          const nextItems =
            existingItem
              ? currentItems.map(
                  (item) =>
                    item.lineId ===
                    normalizedProduct.lineId
                      ? {
                          ...normalizedProduct,

                          quantity:
                            normalizedProduct.itemKind ===
                            'print_job'
                              ? 1
                              : item.quantity +
                                1,
                        }
                      : item,
                )
              : [
                  ...currentItems,

                  {
                    ...normalizedProduct,
                    quantity: 1,
                  },
                ];

          const nextCart: StoreCart = {
            storeId: store.id,
            storeName: store.name,
            storeIcon:
              store.icon || '🏪',

            /**
             * If an older screen does not send categorySlug,
             * preserve the category already stored for this cart.
             */
            categorySlug:
              categorySlug ??
              existingCart?.categorySlug ??
              null,

            deliveryFee:
              Number(
                store.deliveryFee ?? 0,
              ),

            minimumOrder:
              Number(
                store.minimumOrder ?? 0,
              ),

            items: nextItems,
          };

          const nextCarts = {
            ...state.carts,
            [store.id]: nextCart,
          };

          return {
            ...state,

            carts: nextCarts,

            ...getLegacySnapshot(
              nextCarts,
              store.id,
            ),
          };
        });

        if (result === 'added') {
          void trackSuccessfulCartAdd(
            store,
            product,
          );
        }

        return result;
      },

      increaseItem: (
        productId,
        variantId = null,
      ) => {
        set((state) => {
          const activeStoreId =
            getActiveStoreId(
              state,
            );

          if (!activeStoreId) {
            return state;
          }

          return updateStoreCartItems(
            state,
            activeStoreId,
            (items) =>
              items.map(
                (item) =>
                  isSameCartLine(
                    item,
                    productId,
                    variantId,
                  )
                    ? {
                        ...item,

                        quantity:
                          item.quantity +
                          1,
                      }
                    : item,
              ),
          );
        });
      },

      decreaseItem: (
        productId,
        variantId = null,
      ) => {
        set((state) => {
          const activeStoreId =
            getActiveStoreId(
              state,
            );

          if (!activeStoreId) {
            return state;
          }

          return updateStoreCartItems(
            state,
            activeStoreId,
            (items) => {
              const selectedItem =
                items.find(
                  (item) =>
                    isSameCartLine(
                      item,
                      productId,
                      variantId,
                    ),
                );

              if (!selectedItem) {
                return items;
              }

              if (
                selectedItem.quantity <=
                1
              ) {
                return items.filter(
                  (item) =>
                    !isSameCartLine(
                      item,
                      productId,
                      variantId,
                    ),
                );
              }

              return items.map(
                (item) =>
                  isSameCartLine(
                    item,
                    productId,
                    variantId,
                  )
                    ? {
                        ...item,

                        quantity:
                          item.quantity -
                          1,
                      }
                    : item,
              );
            },
          );
        });
      },

      removeItem: (
        productId,
        variantId = null,
      ) => {
        set((state) => {
          const activeStoreId =
            getActiveStoreId(
              state,
            );

          if (!activeStoreId) {
            return state;
          }

          return updateStoreCartItems(
            state,
            activeStoreId,
            (items) =>
              items.filter(
                (item) =>
                  !isSameCartLine(
                    item,
                    productId,
                    variantId,
                  ),
              ),
          );
        });
      },

      clearCart: () => {
        set((state) => {
          const activeStoreId =
            getActiveStoreId(
              state,
            );

          if (!activeStoreId) {
            return state;
          }

          const nextCarts = {
            ...state.carts,
          };

          delete nextCarts[
            activeStoreId
          ];

          return {
            ...state,

            carts: nextCarts,

            ...getLegacySnapshot(
              nextCarts,
              getFirstCartStoreId(
                nextCarts,
              ),
            ),
          };
        });
      },

      setActiveCart: (
        storeId,
      ) => {
        set((state) => {
          if (!storeId) {
            return {
              ...state,

              ...getLegacySnapshot(
                state.carts,
                null,
              ),
            };
          }

          if (!state.carts[storeId]) {
            return state;
          }

          return {
            ...state,

            ...getLegacySnapshot(
              state.carts,
              storeId,
            ),
          };
        });
      },

      increaseStoreItem: (
        storeId,
        productId,
        variantId = null,
      ) => {
        set((state) =>
          updateStoreCartItems(
            state,
            storeId,
            (items) =>
              items.map(
                (item) =>
                  isSameCartLine(
                    item,
                    productId,
                    variantId,
                  )
                    ? {
                        ...item,

                        quantity:
                          item.quantity +
                          1,
                      }
                    : item,
              ),
          ),
        );
      },

      decreaseStoreItem: (
        storeId,
        productId,
        variantId = null,
      ) => {
        set((state) =>
          updateStoreCartItems(
            state,
            storeId,
            (items) => {
              const selectedItem =
                items.find(
                  (item) =>
                    isSameCartLine(
                      item,
                      productId,
                      variantId,
                    ),
                );

              if (!selectedItem) {
                return items;
              }

              if (
                selectedItem.quantity <=
                1
              ) {
                return items.filter(
                  (item) =>
                    !isSameCartLine(
                      item,
                      productId,
                      variantId,
                    ),
                );
              }

              return items.map(
                (item) =>
                  isSameCartLine(
                    item,
                    productId,
                    variantId,
                  )
                    ? {
                        ...item,

                        quantity:
                          item.quantity -
                          1,
                      }
                    : item,
              );
            },
          ),
        );
      },

      removeStoreItem: (
        storeId,
        productId,
        variantId = null,
      ) => {
        set((state) =>
          updateStoreCartItems(
            state,
            storeId,
            (items) =>
              items.filter(
                (item) =>
                  !isSameCartLine(
                    item,
                    productId,
                    variantId,
                  ),
              ),
          ),
        );
      },

      removeStoreLine: (
        storeId,
        lineId,
      ) => {
        const normalizedLineId =
          normalizeLineId(lineId);

        if (!normalizedLineId) {
          return;
        }

        set((state) =>
          updateStoreCartItems(
            state,
            storeId,
            (items) =>
              items.filter(
                (item) =>
                  item.lineId !==
                  normalizedLineId,
              ),
          ),
        );
      },

      clearStoreCart: (
        storeId,
      ) => {
        set((state) => {
          if (!state.carts[storeId]) {
            return state;
          }

          const nextCarts = {
            ...state.carts,
          };

          delete nextCarts[storeId];

          const requestedActiveStoreId =
            state.activeStoreId ===
            storeId
              ? getFirstCartStoreId(
                  nextCarts,
                )
              : state.activeStoreId;

          return {
            ...state,

            carts: nextCarts,

            ...getLegacySnapshot(
              nextCarts,
              requestedActiveStoreId,
            ),
          };
        });
      },

      clearAllCarts: () => {
        set((state) => ({
          ...state,

          carts: {},
          activeStoreId: null,

          ...initialLegacyState,
        }));
      },

      setHasHydrated: (
        hasHydrated,
      ) => {
        set({
          hasHydrated,
        });
      },
    }),

    {
      name: 'navienty-now-cart',

      storage: createJSONStorage(
        () => AsyncStorage,
      ),

      partialize: (
        state,
      ): PersistedCartState => ({
        carts: state.carts,
        activeStoreId:
          state.activeStoreId,
      }),

      /**
       * Version 3 changes the cart from one global store cart to:
       *
       * Record<storeId, StoreCart>
       *
       * Existing version 1/2 carts are migrated automatically.
       */
      version: 4,

      migrate: (
        persistedState,
      ) =>
        normalizePersistedState(
          persistedState,
        ),

      /**
       * Ensures the old compatibility fields mirror the persisted
       * active cart immediately after app hydration.
       */
      merge: (
        persistedState,
        currentState,
      ) => {
        const normalizedState =
          normalizePersistedState(
            persistedState,
          );

        return {
          ...currentState,

          ...normalizedState,

          ...getLegacySnapshot(
            normalizedState.carts,
            normalizedState.activeStoreId,
          ),
        } as CartState;
      },

      onRehydrateStorage:
        () => (state) => {
          state?.setHasHydrated(
            true,
          );
        },
    },
  ),
);

/**
 * -----------------------------------------------------------------
 * LEGACY ACTIVE-CART SELECTORS
 * -----------------------------------------------------------------
 *
 * Existing screens can keep using these during migration.
 */
export const selectCartItemCount = (
  state: CartState,
) =>
  state.items.reduce(
    (total, item) =>
      total + item.quantity,
    0,
  );

export const selectCartSubtotal = (
  state: CartState,
) =>
  state.items.reduce(
    (total, item) =>
      total +
      item.price *
        item.quantity,
    0,
  );

export const selectCartTotal = (
  state: CartState,
) => {
  const subtotal =
    selectCartSubtotal(state);

  if (
    state.items.length === 0
  ) {
    return 0;
  }

  return (
    subtotal +
    state.deliveryFee
  );
};

/**
 * -----------------------------------------------------------------
 * NEW MULTI-CART HELPERS
 * -----------------------------------------------------------------
 */
export function selectStoreCart(
  state: CartState,
  storeId:
    | string
    | null
    | undefined,
): StoreCart | null {
  if (!storeId) {
    return null;
  }

  return (
    state.carts[storeId] ?? null
  );
}

export function selectStoreCartItemCount(
  state: CartState,
  storeId:
    | string
    | null
    | undefined,
) {
  const cart =
    selectStoreCart(
      state,
      storeId,
    );

  return (
    cart?.items.reduce(
      (total, item) =>
        total + item.quantity,
      0,
    ) ?? 0
  );
}

export function selectStoreCartSubtotal(
  state: CartState,
  storeId:
    | string
    | null
    | undefined,
) {
  const cart =
    selectStoreCart(
      state,
      storeId,
    );

  return (
    cart?.items.reduce(
      (total, item) =>
        total +
        item.price *
          item.quantity,
      0,
    ) ?? 0
  );
}

export const selectAllCartItemCount = (
  state: CartState,
) =>
  Object.values(
    state.carts,
  ).reduce(
    (cartTotal, cart) =>
      cartTotal +
      cart.items.reduce(
        (itemTotal, item) =>
          itemTotal +
          item.quantity,
        0,
      ),
    0,
  );

export const selectAllCartSubtotal = (
  state: CartState,
) =>
  Object.values(
    state.carts,
  ).reduce(
    (cartTotal, cart) =>
      cartTotal +
      cart.items.reduce(
        (itemTotal, item) =>
          itemTotal +
          item.price *
            item.quantity,
        0,
      ),
    0,
  );
