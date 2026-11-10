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
