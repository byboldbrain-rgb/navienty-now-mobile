import { GLOBAL_CART_DELIVERY_FEE } from '../config/global-cart';
import {
  useCartStore as useBaseCartStore,
  type CartState,
  type StoreCart,
} from './global-cart-store';

export * from './global-cart-store';

function nonEmptyGroups(
  state: CartState,
): StoreCart[] {
  return Object.values(state.carts).filter(
    (cart) => cart.items.length > 0,
  );
}

function anchorGroup(
  state: CartState,
): StoreCart | null {
  const groups = nonEmptyGroups(state);

  if (groups.length === 0) {
    return null;
  }

  return (
    (
      state.activeStoreId
        ? state.carts[state.activeStoreId]
        : null
    ) ?? groups[0]
  );
}

function aggregateCart(
  state: CartState,
): StoreCart | null {
  const groups = nonEmptyGroups(state);
  const anchor = anchorGroup(state);

  if (!anchor) {
    return null;
  }

  return {
    ...anchor,
    deliveryFee: GLOBAL_CART_DELIVERY_FEE,
    minimumOrder: 0,
    items: groups.flatMap(
      (group) => group.items,
    ),
  };
}

function cartFacade(
  state: CartState,
): Record<string, StoreCart> {
  const aggregate = aggregateCart(state);

  if (!aggregate) {
    return {};
  }

  const facade: Record<string, StoreCart> = {
    [aggregate.storeId]: aggregate,
  };

  nonEmptyGroups(state).forEach((group) => {
    if (group.storeId === aggregate.storeId) {
      return;
    }

    Object.defineProperty(
      facade,
      group.storeId,
      {
        configurable: true,
        enumerable: false,
        value: aggregate,
      },
    );
  });

  return facade;
}

function sameCatalogLine(
  item: StoreCart['items'][number],
  productId: string,
  variantId: string | null | undefined,
) {
  const normalizedVariant =
    typeof variantId === 'string' && variantId.trim()
      ? variantId.trim()
      : null;

  return (
    item.itemKind !== 'print_job' &&
    item.id === productId &&
    item.variantId === normalizedVariant
  );
}

function findStoreForCatalogLine(
  preferredStoreId: string | null | undefined,
  productId: string,
  variantId: string | null | undefined,
): string | null {
  const state = useBaseCartStore.getState();

  if (
    preferredStoreId &&
    state.carts[preferredStoreId]?.items.some(
      (item) => sameCatalogLine(item, productId, variantId),
    )
  ) {
    return preferredStoreId;
  }

  return (
    Object.values(state.carts).find(
      (group) =>
        group.items.some(
          (item) => sameCatalogLine(item, productId, variantId),
        ),
    )?.storeId ?? null
  );
}

function findStoreForLine(
  preferredStoreId: string | null | undefined,
  lineId: string,
): string | null {
  const state = useBaseCartStore.getState();

  if (
    preferredStoreId &&
    state.carts[preferredStoreId]?.items.some(
      (item) => item.lineId === lineId,
    )
  ) {
    return preferredStoreId;
  }

  return (
    Object.values(state.carts).find(
      (group) =>
        group.items.some(
          (item) => item.lineId === lineId,
        ),
    )?.storeId ?? null
  );
}

const increaseStoreItem: CartState['increaseStoreItem'] = (
  storeId,
  productId,
  variantId = null,
) => {
  const owner = findStoreForCatalogLine(
    storeId,
    productId,
    variantId,
  );

  if (owner) {
    useBaseCartStore.getState().increaseStoreItem(
      owner,
      productId,
      variantId,
    );
  }
};

const decreaseStoreItem: CartState['decreaseStoreItem'] = (
  storeId,
  productId,
  variantId = null,
) => {
  const owner = findStoreForCatalogLine(
    storeId,
    productId,
    variantId,
  );

  if (owner) {
    useBaseCartStore.getState().decreaseStoreItem(
      owner,
      productId,
      variantId,
    );
  }
};

const removeStoreItem: CartState['removeStoreItem'] = (
  storeId,
  productId,
  variantId = null,
) => {
  const owner = findStoreForCatalogLine(
    storeId,
    productId,
    variantId,
  );

  if (owner) {
    useBaseCartStore.getState().removeStoreItem(
      owner,
      productId,
      variantId,
    );
  }
};

const removeStoreLine: CartState['removeStoreLine'] = (
  storeId,
  lineId,
) => {
  const owner = findStoreForLine(
    storeId,
    lineId.trim(),
  );

  if (owner) {
    useBaseCartStore.getState().removeStoreLine(
      owner,
      lineId,
    );
  }
};

const clearStoreCart: CartState['clearStoreCart'] = () => {
  useBaseCartStore.getState().clearAllCarts();
};

function facadeState(
  state: CartState,
): CartState {
  const aggregate = aggregateCart(state);

  return {
    ...state,
    carts: cartFacade(state),
    deliveryFee: aggregate
      ? GLOBAL_CART_DELIVERY_FEE
      : 0,
    minimumOrder: 0,
    increaseStoreItem,
    decreaseStoreItem,
    removeStoreItem,
    removeStoreLine,
    clearStoreCart,
  };
}

/**
 * Compatibility hook: existing screens keep their exact UI and selectors,
 * while they now see one aggregate customer-facing Cart.
 */
const wrappedUseCartStore = (<T>(
  selector: (state: CartState) => T,
) =>
  useBaseCartStore(
    (state) => selector(facadeState(state)),
  )) as typeof useBaseCartStore;

Object.assign(
  wrappedUseCartStore,
  useBaseCartStore,
);

export const useCartStore = wrappedUseCartStore;

/** Real store groups used only by global checkout/order infrastructure. */
export function getGlobalCartStoreGroups(): StoreCart[] {
  return nonEmptyGroups(
    useBaseCartStore.getState(),
  );
}

export function hasMultiStoreGlobalCart(): boolean {
  return getGlobalCartStoreGroups().length > 1;
}
