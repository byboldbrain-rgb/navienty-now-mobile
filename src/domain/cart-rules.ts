export type CartLineIdentity = {
  id: string;
  variantId?: string | null;
};

export type CartConflictCandidate = {
  storeId: string;
  categorySlug?: string | null;
  items: readonly unknown[];
};

function normalizeVariantId(
  variantId: string | null | undefined,
): string | null {
  if (typeof variantId !== 'string') {
    return null;
  }

  const normalizedValue = variantId.trim();
  return normalizedValue.length > 0
    ? normalizedValue
    : null;
}

function normalizeCategorySlug(
  categorySlug: string | null | undefined,
): string | null {
  if (typeof categorySlug !== 'string') {
    return null;
  }

  const normalizedValue = categorySlug
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');

  return normalizedValue.length > 0
    ? normalizedValue
    : null;
}

export function isRestaurantCartCategory(
  categorySlug: string | null | undefined,
): boolean {
  const normalizedSlug =
    normalizeCategorySlug(categorySlug);

  return (
    normalizedSlug === 'restaurants' ||
    normalizedSlug === 'restaurant'
  );
}

export function isSameCartLine(
  item: CartLineIdentity,
  productId: string,
  variantId?: string | null,
): boolean {
  return (
    item.id === productId &&
    normalizeVariantId(item.variantId) ===
      normalizeVariantId(variantId)
  );
}

/**
 * Navienty Now allows multiple simultaneous store carts, except that a user
 * may have only one restaurant cart at a time. The same restaurant remains
 * valid and non-restaurant carts can coexist with it.
 */
export function hasDifferentRestaurantCart(
  existingCarts: readonly CartConflictCandidate[],
  incomingStoreId: string,
  incomingCategorySlug:
    | string
    | null
    | undefined,
): boolean {
  if (
    !isRestaurantCartCategory(
      incomingCategorySlug,
    )
  ) {
    return false;
  }

  return existingCarts.some(
    (cart) =>
      cart.items.length > 0 &&
      cart.storeId !== incomingStoreId &&
      isRestaurantCartCategory(
        cart.categorySlug,
      ),
  );
}
