/**
 * Customer-facing global Cart policy.
 *
 * A Navienty Now checkout can contain products from multiple stores, but the
 * customer pays one shared delivery charge for the whole checkout.
 */
export const GLOBAL_CART_DELIVERY_FEE = 25;

/**
 * One shared delivery charge applies to the global cart. Only waive it
 * when every participating store explicitly has free delivery.
 * No charge applies to an empty cart.
 */
export function getGlobalCartDeliveryFee(
  groups: ReadonlyArray<{ deliveryFee: number }>,
): number {
  if (groups.length === 0) {
    return 0;
  }

  return groups.every(
    (group) =>
      Number.isFinite(group.deliveryFee) &&
      group.deliveryFee === 0,
  )
    ? 0
    : GLOBAL_CART_DELIVERY_FEE;
}
