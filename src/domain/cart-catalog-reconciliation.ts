import type { CatalogProduct } from '../services/catalog-service-base';
import type { CartItem } from '../store/global-cart-store';

export type CartPriceChange = { name: string; before: number; after: number };
export type CartCatalogReconciliation = {
  items: CartItem[];
  unavailable: CartItem[];
  priceChanges: CartPriceChange[];
  changed: boolean;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizedName(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function uniqueById(products: CatalogProduct[]): CatalogProduct[] {
  return Array.from(new Map(products.map((product) => [product.id, product])).values());
}

/**
 * Match products against their own physical store only. If an old ID cannot
 * be found, an exact, UNIQUE name match is the only safe fallback.
 */
export function reconcileCartLines(
  cartItems: CartItem[],
  catalogProducts: CatalogProduct[],
): CartCatalogReconciliation {
  const products = uniqueById(catalogProducts);
  const byId = new Map(products.map((product) => [product.id, product]));
  const nextItems: CartItem[] = [];
  const unavailable: CartItem[] = [];
  const priceChanges: CartPriceChange[] = [];
  let changed = false;

  for (const item of cartItems) {
    if (item.itemKind === 'print_job') {
      // Printing has a configured price and a dedicated server-side validator.
      if (UUID_PATTERN.test(item.id) && item.printJob &&
          UUID_PATTERN.test(item.printJob.productVariantId)) {
        nextItems.push(item);
      } else {
        unavailable.push(item);
      }
      continue;
    }

    let product = byId.get(item.id);
    if (!product) {
      const sameName = products.filter(
        (candidate) => normalizedName(candidate.name) === normalizedName(item.name),
      );
      product = sameName.length === 1 ? sameName[0] : undefined;
    }
    if (!product) {
      unavailable.push(item);
      continue;
    }

    let variantId = item.variantId ?? null;
    let variantName = item.variantName ?? null;
    let currentPrice = product.price;

    if (variantId) {
      let variant = product.variants.find((candidate) => candidate.id === variantId);
      if (!variant && variantName) {
        const matches = product.variants.filter(
          (candidate) => normalizedName(candidate.name) === normalizedName(variantName),
        );
        variant = matches.length === 1 ? matches[0] : undefined;
      }
      if (!variant) {
        unavailable.push(item);
        continue;
      }
      variantId = variant.id;
      variantName = variant.name;
      currentPrice = variant.price;
    } else if (variantName && product.variants.length) {
      const matches = product.variants.filter(
        (candidate) => normalizedName(candidate.name) === normalizedName(variantName),
      );
      if (matches.length !== 1) {
        unavailable.push(item);
        continue;
      }
      variantId = matches[0].id;
      variantName = matches[0].name;
      currentPrice = matches[0].price;
    }

    const lineId = 'catalog:' + product.id + ':' + (variantId ?? 'base');
    const updated: CartItem = {
      ...item,
      id: product.id,
      lineId,
      name: product.name,
      description: product.description,
      icon: product.icon,
      price: currentPrice,
      variantId,
      variantName,
      isAgeRestricted: product.isAgeRestricted,
    };

    if (item.price !== currentPrice) {
      priceChanges.push({ name: product.name, before: item.price, after: currentPrice });
    }

    if (item.id !== updated.id || item.lineId !== lineId ||
        item.name !== updated.name || item.description !== updated.description ||
        item.icon !== updated.icon || item.price !== updated.price ||
        item.variantId !== updated.variantId || item.variantName !== updated.variantName ||
        item.isAgeRestricted !== updated.isAgeRestricted) {
      changed = true;
    }

    const existingIndex = nextItems.findIndex(
      (candidate) => candidate.itemKind !== 'print_job' && candidate.lineId === lineId,
    );
    if (existingIndex !== -1) {
      nextItems[existingIndex] = {
        ...updated,
        quantity: nextItems[existingIndex].quantity + item.quantity,
      };
      changed = true;
    } else {
      nextItems.push(updated);
    }
  }

  return {
    items: changed || unavailable.length > 0 ? nextItems : cartItems,
    unavailable,
    priceChanges,
    changed: changed || unavailable.length > 0,
  };
}
