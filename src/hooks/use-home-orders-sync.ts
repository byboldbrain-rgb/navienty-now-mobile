import { useFocusEffect } from 'expo-router';
import {
    useCallback,
    useRef,
} from 'react';

import {
    getMyOrders,
    getOrderByToken,
} from '../services/order-service';
import { useOrderRealtimeHealthStore } from '../store/order-realtime-health-store';
import {
    type Order,
    useOrdersStore,
} from '../store/orders-store';

const HOME_ORDER_FALLBACK_POLL_INTERVAL_MS =
  8000;

const HOME_ORDER_REALTIME_WATCHDOG_INTERVAL_MS =
  45_000;

type UseHomeOrdersSyncInput = {
  currentUserId: string | null;
  hasHydrated: boolean;
  hasActiveOrders: boolean;
};

function isTerminalOrder(
  order: Order,
): boolean {
  return (
    order.status === 'delivered' ||
    order.status === 'cancelled'
  );
}

function collectActiveOrders(): Order[] {
  const currentState =
    useOrdersStore.getState();

  const uniqueOrders =
    new Map<string, Order>();

  currentState.orders.forEach(
    (order) => {
      uniqueOrders.set(
        order.id,
        order,
      );
    },
  );

  if (currentState.pendingOrder) {
    uniqueOrders.set(
      currentState.pendingOrder.id,
      currentState.pendingOrder,
    );
  }

  return Array.from(
    uniqueOrders.values(),
  ).filter(
    (order) => !isTerminalOrder(order),
  );
}

async function refreshActiveOrders(
  shouldApply: () => boolean,
): Promise<void> {
  const ordersToRefresh =
    collectActiveOrders();

  if (ordersToRefresh.length === 0) {
    return;
  }

  const results =
    await Promise.allSettled(
      ordersToRefresh.map(
        (order) =>
          getOrderByToken(
            order.accessToken,
          ),
      ),
    );

  if (!shouldApply()) {
    return;
  }

  results.forEach(
    (result, index) => {
      if (!shouldApply()) {
        return;
      }

      if (result.status === 'rejected') {
        console.warn(
          'Unable to refresh active home order.',
          ordersToRefresh[index]?.id,
          result.reason,
        );
        return;
      }

      const latestOrder = result.value;
      const orderStore =
        useOrdersStore.getState();

      if (
        orderStore.pendingOrder?.id ===
        latestOrder.id
      ) {
        if (
          latestOrder.status ===
          'awaiting-whatsapp-send'
        ) {
          orderStore.setPendingOrder(
            latestOrder,
          );
        } else {
          orderStore.confirmPendingOrder(
            latestOrder,
          );
        }

        return;
      }

      orderStore.upsertOrder(
        latestOrder,
      );
    },
  );
}

export function useHomeOrdersSync({
  currentUserId,
  hasHydrated,
  hasActiveOrders,
}: UseHomeOrdersSyncInput): void {
  const fullSyncPromiseRef = useRef<
    Promise<void> | null
  >(null);

  const realtimeIsSubscribed =
    useOrderRealtimeHealthStore(
      (state) =>
        !!currentUserId &&
        state.userId ===
          currentUserId &&
        state.status ===
          'subscribed',
    );

  /*
   * Refresh the complete order history whenever Home becomes focused for the
   * current identity. The result is ignored after blur/user-change so a slow
   * request from an old session cannot overwrite the new user's store.
   */
  useFocusEffect(
    useCallback(() => {
      if (
        !hasHydrated ||
        !currentUserId
      ) {
        fullSyncPromiseRef.current = null;
        return;
      }

      let active = true;

      const syncPromise =
        (async () => {
          const orderStore =
            useOrdersStore.getState();

          orderStore.prepareForUser(
            currentUserId,
          );

          try {
            const serverOrders =
              await getMyOrders();

            if (!active) {
              return;
            }

            useOrdersStore
              .getState()
              .replaceOrdersFromServer(
                currentUserId,
                serverOrders,
              );
          } catch (error) {
            if (__DEV__ && active) {
              console.warn(
                'Unable to sync Home orders from Supabase.',
                error,
              );
            }
          }
        })();

      fullSyncPromiseRef.current =
        syncPromise;

      return () => {
        active = false;

        if (
          fullSyncPromiseRef.current ===
          syncPromise
        ) {
          fullSyncPromiseRef.current = null;
        }
      };
    }, [currentUserId, hasHydrated]),
  );

  /*
   * Realtime is the primary active-order update path. While its private
   * channel is subscribed, keep only a low-frequency 45-second watchdog so a
   * missed broadcast can still self-heal. If realtime is connecting, closed,
   * timed out, or errored, automatically return to the previous 8-second
   * polling cadence.
   *
   * The focus-level getMyOrders() above is already authoritative, so there is
   * no second immediate per-order refresh on focus. This avoids the previous
   * duplicate network round while preserving the same eventual consistency.
   */
  useFocusEffect(
    useCallback(() => {
      if (
        !hasHydrated ||
        !currentUserId ||
        !hasActiveOrders
      ) {
        return;
      }

      let active = true;
      let refreshInFlight = false;

      const pollIntervalMs =
        realtimeIsSubscribed
          ? HOME_ORDER_REALTIME_WATCHDOG_INTERVAL_MS
          : HOME_ORDER_FALLBACK_POLL_INTERVAL_MS;

      const runRefresh = async () => {
        if (refreshInFlight) {
          return;
        }

        refreshInFlight = true;

        try {
          const fullSyncPromise =
            fullSyncPromiseRef.current;

          if (fullSyncPromise) {
            await fullSyncPromise;
          }

          if (!active) {
            return;
          }

          await refreshActiveOrders(
            () => active,
          );
        } catch (error) {
          if (active) {
            console.warn(
              'Unable to refresh Home active orders.',
              error,
            );
          }
        } finally {
          refreshInFlight = false;
        }
      };

      const timer = setInterval(() => {
        void runRefresh();
      }, pollIntervalMs);

      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [
      currentUserId,
      hasActiveOrders,
      hasHydrated,
      realtimeIsSubscribed,
    ]),
  );
}
