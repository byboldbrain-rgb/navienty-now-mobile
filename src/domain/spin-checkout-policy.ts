/**
 * A next-order Spin reward becomes platform-wide once the source order was
 * submitted and Supabase promoted the reward to `available`.
 * Immediate rewards and pending next-order rewards remain tied to the
 * originating store. Supabase always performs the final authorization.
 */
export function isAvailableCrossStoreSpin(
  rewardType: string | null | undefined,
  rewardStatus: string | null | undefined,
): boolean {
  return rewardType === 'next_order_discount' &&
    rewardStatus === 'available';
}

export function canApplyCheckoutSpin(input: {
  eventIssued: boolean;
  sameStore: boolean;
  immediateReward: boolean;
  unlockReached: boolean;
  eligibleNextOrderReward: boolean;
}): boolean {
  return input.eventIssued &&
    (
      (input.sameStore && input.immediateReward && input.unlockReached) ||
      input.eligibleNextOrderReward
    );
}

export function shouldAttachCheckoutSpinEvent(input: {
  eventIssued: boolean;
  sameStore: boolean;
  eligibleNextOrderReward: boolean;
}): boolean {
  return input.eventIssued &&
    (input.sameStore || input.eligibleNextOrderReward);
}
