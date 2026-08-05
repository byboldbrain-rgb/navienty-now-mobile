import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
    createJSONStorage,
    persist,
} from 'zustand/middleware';

import type {
    Order,
    OrderStatus
} from '../types/supabase-order';

export type {
    Order,
    OrderItem,
    OrderStatus
} from '../types/supabase-order';

type PersistedOrdersState = {
  orders: Order[];
  pendingOrder: Order | null;
};

export type OrdersState =
  PersistedOrdersState & {
    hasHydrated: boolean;

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
    orders: [],
    pendingOrder: null,
  };

const MAX_SAVED_ORDERS = 50;

function addOrderToHistory(
  orders: Order[],
  order: Order,
): Order[] {
  return [
    order,
    ...orders.filter(
      (currentOrder) =>
        currentOrder.id !== order.id,
    ),
  ].slice(0, MAX_SAVED_ORDERS);
}

export const useOrdersStore =
  create<OrdersState>()(
    persist(
      (set) => ({
        ...initialOrdersState,

        hasHydrated: false,

        setPendingOrder: (
          order,
        ) => {
          set({
            pendingOrder: order,
          });
        },

        confirmPendingOrder: (
          order,
        ) => {
          set((state) => ({
            pendingOrder: null,

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
          set((state) => ({
            orders:
              addOrderToHistory(
                state.orders,
                order,
              ),

            pendingOrder:
              state.pendingOrder?.id ===
              order.id
                ? order
                : state.pendingOrder,
          }));
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

        removeOrder: (orderId) => {
          set((state) => ({
            orders:
              state.orders.filter(
                (order) =>
                  order.id !== orderId,
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

        storage: createJSONStorage(
          () => AsyncStorage,
        ),

        partialize: (
          state,
        ): PersistedOrdersState => ({
          orders: state.orders,

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

          return (
            persistedState as
              PersistedOrdersState
          );
        },

        onRehydrateStorage:
          () => (state) => {
            state?.setHasHydrated(
              true,
            );
          },

        version: 2,
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
