import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  hasDifferentRestaurantCart,
  isRestaurantCartCategory,
  isSameCartLine,
} from '../domain/cart-rules';

export {
  isRestaurantCartCategory,
} from '../domain/cart-rules';
import { create } from 'zustand';
import {
  createJSONStorage,
  persist,
} from 'zustand/middleware';

export type CartProduct = {
  /**
   * Base product ID from now.products.id.
   */
  id: string;

  name: string;
  description: string;
  price: number;
  icon: string;

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

  requiresPrescription?: boolean;
  isAgeRestricted?: boolean;
};

export type CartItem = CartProduct & {
  quantity: number;

  /**
   * Normalized in persisted/current state so consumers can
   * safely distinguish the same product with different sizes.
   */
  variantId: string | null;
  variantName: string | null;
  requiresPrescription: boolean;
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
  | 'different-restaurant';

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

function normalizeCartProduct(
  product: CartProduct,
): Omit<CartItem, 'quantity'> {
  return {
    ...product,

    variantId: normalizeVariantId(
      product.variantId,
    ),

    variantName:
      normalizeVariantName(
        product.variantName,
      ),

    requiresPrescription:
      product.requiresPrescription === true,

    isAgeRestricted:
      product.isAgeRestricted === true,
  };
}

function normalizeCartItem(
  item: CartItem,
): CartItem {
  const quantity = Number(
    item.quantity ?? 0,
  );

  return {
    ...item,

    price: Number(
      item.price ?? 0,
    ),

    quantity:
      Number.isFinite(quantity) &&
      quantity > 0
        ? Math.floor(quantity)
        : 1,

    variantId:
      normalizeVariantId(
        item.variantId,
      ),

    variantName:
      normalizeVariantName(
        item.variantName,
      ),

    requiresPrescription:
      item.requiresPrescription === true,

    isAgeRestricted:
      item.isAgeRestricted === true,
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
            hasDifferentRestaurantCart(
              Object.values(state.carts),
              store.id,
              categorySlug,
            )
          ) {
            result =
              'different-restaurant';

            return state;
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
                isSameCartLine(
                  item,
                  normalizedProduct.id,
                  normalizedProduct.variantId,
                ),
            );

          const nextItems =
            existingItem
              ? currentItems.map(
                  (item) =>
                    isSameCartLine(
                      item,
                      normalizedProduct.id,
                      normalizedProduct.variantId,
                    )
                      ? {
                          ...item,

                          /**
                           * Refresh current product/variant
                           * snapshots while keeping quantity.
                           */
                          ...normalizedProduct,

                          quantity:
                            item.quantity +
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
          /**
           * IMPORTANT:
           * This action must be idempotent. Multiple screens can stay
           * mounted at the same time when Expo Router uses modal/transparent
           * presentations. Returning a brand-new Zustand state when the
           * requested cart is already active can create an update feedback
           * loop between those mounted screens.
           */
          if (!storeId) {
            const fallbackStoreId =
              getFirstCartStoreId(
                state.carts,
              );

            if (
              state.activeStoreId ===
              fallbackStoreId
            ) {
              return state;
            }

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

          if (
            state.activeStoreId ===
            storeId
          ) {
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
      version: 3,

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
