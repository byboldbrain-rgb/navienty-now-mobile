/**
 * One store cart is one delivery. Service-area prices are authoritative, with
 * explicit zeroes preserved (for example, free delivery from Maison).
 * Returns money rounded to two decimals to avoid floating point drift.
 */
export function sumStoreDeliveryFees(fees: readonly number[]): number {
  if (fees.some((fee) => !Number.isFinite(fee) || fee < 0)) {
    throw new Error('Invalid store delivery fee');
  }
  return Math.round(fees.reduce((total, fee) => total + fee, 0) * 100) / 100;
}

/**
 * One checkout = one customer-facing delivery charge, even if it has
 * products from multiple stores. Use the highest applicable store-area quote
 * so a free-delivery store never adds another charge to the checkout.
 */
export function getSingleCheckoutDeliveryFee(fees: readonly number[]): number {
  if (fees.some((fee) => !Number.isFinite(fee) || fee < 0)) {
    throw new Error('Invalid store delivery fee');
  }
  return Math.round(Math.max(0, ...fees) * 100) / 100;
}
