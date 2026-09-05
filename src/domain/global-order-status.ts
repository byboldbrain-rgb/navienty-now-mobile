import type {
  OrderStatus,
} from '../types/supabase-order';

type ActiveOrderStatus =
  Exclude<OrderStatus, 'cancelled'>;

const STATUS_STAGE: Record<
  ActiveOrderStatus,
  number
> = {
  'awaiting-whatsapp-send': 0,
  'waiting-confirmation': 0,
  confirmed: 1,
  preparing: 1,
  'out-for-delivery': 2,
  delivered: 3,
};

/**
 * A global checkout is fulfilled by one child order per store.
 *
 * The customer-facing parent must never claim a later stage while one of its
 * active child orders is still behind. We therefore expose the slowest active
 * child stage. Cancelled children are ignored unless every child is cancelled.
 */
export function getAggregateGlobalOrderStatus(
  statuses: OrderStatus[],
  fallback: OrderStatus,
): OrderStatus {
  if (statuses.length === 0) {
    return fallback;
  }

  const activeStatuses =
    statuses.filter(
      (
        status,
      ): status is ActiveOrderStatus =>
        status !== 'cancelled',
    );

  if (activeStatuses.length === 0) {
    return 'cancelled';
  }

  let earliestStatus =
    activeStatuses[0];
  let earliestStage =
    STATUS_STAGE[earliestStatus];

  for (
    const status of
      activeStatuses.slice(1)
  ) {
    const stage =
      STATUS_STAGE[status];

    if (stage < earliestStage) {
      earliestStatus = status;
      earliestStage = stage;
    }
  }

  if (earliestStage === 0) {
    return activeStatuses.includes(
      'awaiting-whatsapp-send',
    )
      ? 'awaiting-whatsapp-send'
      : 'waiting-confirmation';
  }

  if (earliestStage === 1) {
    return activeStatuses.includes(
      'confirmed',
    )
      ? 'confirmed'
      : 'preparing';
  }

  if (earliestStage === 2) {
    return 'out-for-delivery';
  }

  return 'delivered';
}
