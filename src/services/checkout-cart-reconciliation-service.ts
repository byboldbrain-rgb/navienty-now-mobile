import {
  reconcileCartLines,
  type CartPriceChange,
} from '../domain/cart-catalog-reconciliation';
import type { CartItem, StoreCart } from '../store/global-cart-store';
import { getStoreCatalog } from './catalog-service-base';

export type CheckoutCartCorrection = {
  storeId: string;
  expectedItems: CartItem[];
  nextItems: CartItem[];
};

export type CheckoutUnavailableItem = {
  storeId: string;
  storeName: string;
  lineId: string;
  name: string;
};

export type CheckoutCartReconciliation = {
  corrections: CheckoutCartCorrection[];
  unavailable: CheckoutUnavailableItem[];
  priceChanges: CartPriceChange[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolve each cart against its own store catalog, including other merchants
 * in a multi-store checkout. Never use the aggregate compatibility cart:
 * product identities are store-scoped.
 *
 * A network/catalog failure throws so customers can retry without losing
 * their baskets. Permanently invalid legacy store IDs are isolated instead.
 */
export async function reconcileCheckoutCarts(
  groups: StoreCart[],
): Promise<CheckoutCartReconciliation> {
  const resolved = await Promise.all(groups.map(async (group) => {
    if (!UUID_PATTERN.test(group.storeId)) {
      return {
        correction: {
          storeId: group.storeId,
          expectedItems: group.items,
          nextItems: [] as CartItem[],
        },
        unavailable: group.items.map((item) => ({
          storeId: group.storeId,
          storeName: group.storeName,
          lineId: item.lineId,
          name: item.name,
        })),
        priceChanges: [] as CartPriceChange[],
      };
    }

    const catalog = await getStoreCatalog(group.storeId);
    if (catalog.store.id !== group.storeId) {
      throw new Error('Unexpected store identity in catalog response');
    }

    const result = reconcileCartLines(
      group.items,
      catalog.sections.flatMap((section) => section.products),
    );

    return {
      correction: {
        storeId: group.storeId,
        expectedItems: group.items,
        nextItems: result.items,
      },
      unavailable: result.unavailable.map((item) => ({
        storeId: group.storeId,
        storeName: group.storeName,
        lineId: item.lineId,
        name: item.name,
      })),
      priceChanges: result.priceChanges,
    };
  }));

  return {
    corrections: resolved.map((item) => item.correction),
    unavailable: resolved.flatMap((item) => item.unavailable),
    priceChanges: resolved.flatMap((item) => item.priceChanges),
  };
}
