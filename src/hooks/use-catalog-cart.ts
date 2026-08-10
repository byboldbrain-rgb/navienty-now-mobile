import {
    useMemo,
    useState,
} from 'react';

import type {
    CatalogProduct,
    StoreCatalog,
} from '../services/catalog-service';
import {
    selectCartItemCount,
    selectCartSubtotal,
    useCartStore,
} from '../store/cart-store';

type UseCatalogCartResult = {
  cartItemCount: number;
  cartSubtotal: number;
  cartStoreName: string | null;
  pendingProduct: CatalogProduct | null;
  storeIsClosed: boolean;
  getProductQuantity: (
    productId: string,
  ) => number;
  increaseProduct: (
    product: CatalogProduct,
  ) => void;
  decreaseProduct: (
    productId: string,
  ) => void;
  replaceCartAndAddProduct: () => void;
  dismissPendingProduct: () => void;
};

export default function useCatalogCart(
  catalog: StoreCatalog | null,
): UseCatalogCartResult {
  const [pendingProduct, setPendingProduct] =
    useState<CatalogProduct | null>(null);

  const cartItems = useCartStore(
    (state) => state.items,
  );
  const cartStoreId = useCartStore(
    (state) => state.storeId,
  );
  const cartStoreName = useCartStore(
    (state) => state.storeName,
  );
  const addItem = useCartStore(
    (state) => state.addItem,
  );
  const increaseItem = useCartStore(
    (state) => state.increaseItem,
  );
  const decreaseItem = useCartStore(
    (state) => state.decreaseItem,
  );
  const clearCart = useCartStore(
    (state) => state.clearCart,
  );
  const cartItemCount = useCartStore(
    selectCartItemCount,
  );
  const cartSubtotal = useCartStore(
    selectCartSubtotal,
  );

  const currentStoreId = catalog?.store.id ?? null;
  const storeIsClosed = Boolean(
    catalog?.store.isManuallyClosed,
  );

  const quantities = useMemo(() => {
    if (
      !currentStoreId ||
      cartStoreId !== currentStoreId
    ) {
      return new Map<string, number>();
    }

    return new Map(
      cartItems.map((item) => [
        item.id,
        item.quantity,
      ]),
    );
  }, [cartItems, cartStoreId, currentStoreId]);

  function addProduct(
    product: CatalogProduct,
  ) {
    if (!catalog || storeIsClosed) {
      return;
    }

    const result = addItem(
      {
        id: catalog.store.id,
        name: catalog.store.name,
        icon: catalog.store.icon,
        deliveryFee:
          catalog.delivery.deliveryFee,
        minimumOrder:
          catalog.delivery.minimumOrder,
      },
      {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        icon: product.icon,
      },
    );

    if (result === 'different-store') {
      setPendingProduct(product);
    }
  }

  function increaseProduct(
    product: CatalogProduct,
  ) {
    if (!catalog || storeIsClosed) {
      return;
    }

    const existingQuantity =
      quantities.get(product.id) ?? 0;

    if (existingQuantity > 0) {
      increaseItem(product.id);
      return;
    }

    addProduct(product);
  }

  function decreaseProduct(productId: string) {
    if (
      !catalog ||
      cartStoreId !== catalog.store.id
    ) {
      return;
    }

    decreaseItem(productId);
  }

  function replaceCartAndAddProduct() {
    if (
      !catalog ||
      !pendingProduct ||
      storeIsClosed
    ) {
      return;
    }

    clearCart();

    addItem(
      {
        id: catalog.store.id,
        name: catalog.store.name,
        icon: catalog.store.icon,
        deliveryFee:
          catalog.delivery.deliveryFee,
        minimumOrder:
          catalog.delivery.minimumOrder,
      },
      {
        id: pendingProduct.id,
        name: pendingProduct.name,
        description:
          pendingProduct.description,
        price: pendingProduct.price,
        icon: pendingProduct.icon,
      },
    );

    setPendingProduct(null);
  }

  return {
    cartItemCount,
    cartSubtotal,
    cartStoreName,
    pendingProduct,
    storeIsClosed,
    getProductQuantity: (productId) =>
      quantities.get(productId) ?? 0,
    increaseProduct,
    decreaseProduct,
    replaceCartAndAddProduct,
    dismissPendingProduct: () => {
      setPendingProduct(null);
    },
  };
}
