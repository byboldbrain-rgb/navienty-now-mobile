import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import {
  createJSONStorage,
  persist,
} from 'zustand/middleware';

import { secureAuthStorage } from '../lib/secure-auth-storage';
import type {
  Order,
  OrderStatus,
} from '../types/supabase-order';

export type {
  Order,
  OrderItem,
  OrderStatus
} from '../types/supabase-order';

const MAX_PERSISTED_ORDERS = 20;

const ordersPersistStorage =
  Platform.OS === 'web'
    ? AsyncStorage
    : secureAuthStorage;

type PersistedOrdersState = {
  /**
   * Supabase auth.uid() that owns the local cache.
   *
   * This prevents orders cached for one account/anonymous session
   * from being shown after the app switches to another user.
   */
  ownerUserId: string | null;

  orders: Order[];
  pendingOrder: Order | null;
};

export type OrdersState =
  PersistedOrdersState & {
    hasHydrated: boolean;

    /**
     * Claims the local cache for the current Supabase user.
     *
     * Legacy version-2 caches have ownerUserId = null. We preserve
     * them on the first run after this update and bind them to the
     * current user. If the owner later changes, the cache is cleared.
     */
    prepareForUser: (
      userId: string,
    ) => void;

    /**
     * Replaces the local history with the server-authoritative result
     * returned by now.get_my_orders().
     */
    replaceOrdersFromServer: (
      userId: string,
      orders: Order[],
    ) => void;

    setPendingOrder: (
      order: Order,
    ) => void;

    confirmPendingOrder: (
      order: Order,
    ) => Order;

    discardPendingOrder: () => void;

    upsertOrder: (
      order: Order,
    ) => void;

    updateOrderStatus: (
      orderId: string,
      status: OrderStatus,
    ) => void;

    removeOrder: (
      orderId: string,
    ) => void;

    clearOrders: () => void;

    setHasHydrated: (
      hasHydrated: boolean,
    ) => void;
  };

const initialOrdersState:
  PersistedOrdersState = {
    ownerUserId: null,
    orders: [],
    pendingOrder: null,
  };

function sortOrdersNewestFirst(
  orders: Order[],
): Order[] {
  return [...orders].sort(
    (
      firstOrder,
      secondOrder,
    ) =>
      new Date(
        secondOrder.createdAt,
      ).getTime() -
      new Date(
        firstOrder.createdAt,
      ).getTime(),
  );
}

function addOrderToHistory(
  orders: Order[],
  order: Order,
): Order[] {
  return sortOrdersNewestFirst([
    order,
    ...orders.filter(
      (currentOrder) =>
        currentOrder.id !== order.id,
    ),
  ]);
}

/**
 * A server order with this status exists before the customer confirms
 * that the WhatsApp message was actually sent.
 *
 * Keep the newest such order in pendingOrder so the existing
 * order-confirmation flow continues to work after a server refresh.
 */
function splitServerOrders(
  serverOrders: Order[],
): {
  orders: Order[];
  pendingOrder: Order | null;
} {
  const sorted =
    sortOrdersNewestFirst(
      serverOrders,
    );

  const pendingOrder =
    sorted.find(
      (order) =>
        order.status ===
        'awaiting-whatsapp-send',
    ) ?? null;

  return {
    pendingOrder,

    orders: pendingOrder
      ? sorted.filter(
          (order) =>
            order.id !==
            pendingOrder.id,
        )
      : sorted,
  };
}

export const useOrdersStore =
  create<OrdersState>()(
    persist(
      (set) => ({
        ...initialOrdersState,

        hasHydrated: false,

        prepareForUser: (
          userId,
        ) => {
          set((state) => {
            if (
              !state.ownerUserId
            ) {
              return {
                ownerUserId:
                  userId,
              };
            }

            if (
              state.ownerUserId ===
              userId
            ) {
              return {};
            }

            /**
             * Different Supabase identity:
             * never leak the previous user's local order cache.
             */
            return {
              ownerUserId:
                userId,

              orders: [],

              pendingOrder:
                null,
            };
          });
        },

        replaceOrdersFromServer: (
          userId,
          serverOrders,
        ) => {
          const split =
            splitServerOrders(
              serverOrders,
            );

          set({
            ownerUserId:
              userId,

            orders:
              split.orders,

            pendingOrder:
              split.pendingOrder,
          });
        },

        setPendingOrder: (
          order,
        ) => {
          set((state) => ({
            pendingOrder:
              order,

            orders:
              state.orders.filter(
                (currentOrder) =>
                  currentOrder.id !==
                  order.id,
              ),
          }));
        },

        confirmPendingOrder: (
          order,
        ) => {
          set((state) => ({
            pendingOrder:
              null,

            orders:
              addOrderToHistory(
                state.orders,
                order,
              ),
          }));

          return order;
        },

        discardPendingOrder: () => {
          set({
            pendingOrder: null,
          });
        },

        upsertOrder: (order) => {
          set((state) => {
            if (
              order.status ===
              'awaiting-whatsapp-send'
            ) {
              return {
                pendingOrder:
                  order,

                orders:
                  state.orders.filter(
                    (currentOrder) =>
                      currentOrder.id !==
                      order.id,
                  ),
              };
            }

            return {
              orders:
                addOrderToHistory(
                  state.orders,
                  order,
                ),

              pendingOrder:
                state.pendingOrder?.id ===
                order.id
                  ? null
                  : state.pendingOrder,
            };
          });
        },

        updateOrderStatus: (
          orderId,
          status,
        ) => {
          const updatedAt =
            new Date().toISOString();

          set((state) => ({
            orders:
              state.orders.map(
                (order) =>
                  order.id ===
                  orderId
                    ? {
                        ...order,
                        status,
                        updatedAt,
                      }
                    : order,
              ),

            pendingOrder:
              state.pendingOrder?.id ===
              orderId
                ? {
                    ...state.pendingOrder,
                    status,
                    updatedAt,
                  }
                : state.pendingOrder,
          }));
        },

        removeOrder: (
          orderId,
        ) => {
          set((state) => ({
            orders:
              state.orders.filter(
                (order) =>
                  order.id !==
                  orderId,
              ),

            pendingOrder:
              state.pendingOrder?.id ===
              orderId
                ? null
                : state.pendingOrder,
          }));
        },

        clearOrders: () => {
          set({
            orders: [],
          });
        },

        setHasHydrated: (
          hasHydrated,
        ) => {
          set({
            hasHydrated,
          });
        },
      }),

      {
        name:
          'navienty-now-orders',

        /**
         * Native order snapshots include customer/address details and an
         * order access token, so keep them out of plaintext AsyncStorage.
         * secureAuthStorage also performs a lazy one-time migration from the
         * previous AsyncStorage value and removes the plaintext copy after a
         * successful encrypted write. Web keeps its normal browser storage.
         */
        storage: createJSONStorage(
          () => ordersPersistStorage,
        ),

        partialize: (
          state,
        ): PersistedOrdersState => ({
          ownerUserId:
            state.ownerUserId,

          /**
           * The server remains authoritative and OrdersScreen refreshes from
           * getMyOrders() on focus. Keep only a bounded encrypted cache for
           * offline/fallback UX so SecureStore cannot grow without limit.
           */
          orders:
            state.orders.slice(
              0,
              MAX_PERSISTED_ORDERS,
            ),

          pendingOrder:
            state.pendingOrder,
        }),

        migrate: (
          persistedState,
          version,
        ) => {
          if (version < 2) {
            return {
              ...initialOrdersState,
            };
          }

          const previous =
            persistedState as Partial<
              PersistedOrdersState
            >;

          return {
            ownerUserId:
              version >= 3
                ? previous.ownerUserId ??
                  null
                : null,

            orders:
              Array.isArray(
                previous.orders,
              )
                ? previous.orders.slice(
                    0,
                    MAX_PERSISTED_ORDERS,
                  )
                : [],

            pendingOrder:
              previous.pendingOrder ??
              null,
          };
        },

        onRehydrateStorage:
          () => (state) => {
            state?.setHasHydrated(
              true,
            );
          },

        version: 4,
      },
    ),
  );

export const selectOrdersCount = (
  state: OrdersState,
): number => state.orders.length;

export const selectLatestOrder = (
  state: OrdersState,
): Order | null =>
  state.orders[0] ?? null;

export const selectActiveOrders = (
  state: OrdersState,
): Order[] =>
  state.orders.filter(
    (order) =>
      order.status !==
        'delivered' &&
      order.status !==
        'cancelled',
  );

export const selectCompletedOrders = (
  state: OrdersState,
): Order[] =>
  state.orders.filter(
    (order) =>
      order.status ===
        'delivered' ||
      order.status ===
        'cancelled',
  );

export const createSelectOrderById =
  (orderId: string) =>
  (
    state: OrdersState,
  ): Order | null =>
    state.orders.find(
      (order) =>
        order.id === orderId,
    ) ??
    (state.pendingOrder?.id ===
    orderId
      ? state.pendingOrder
      : null);
