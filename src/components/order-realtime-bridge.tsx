import { useEffect } from 'react';

import { supabase } from '../lib/supabase';
import {
  getMyOrders,
  getOrderByToken,
} from '../services/order-service';
import { useOrderRealtimeHealthStore } from '../store/order-realtime-health-store';
import { useOrdersStore } from '../store/orders-store';

type OrderUpdatePayload = {
  order_id?: unknown;
  status?: unknown;
  payment_status?: unknown;
  updated_at?: unknown;
};

function getOrderId(
  payload: unknown,
): string | null {
  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    return null;
  }

  const orderId =
    (payload as OrderUpdatePayload)
      .order_id;

  if (
    typeof orderId !== 'string'
  ) {
    return null;
  }

  const normalized =
    orderId.trim();

  return normalized || null;
}

function getCachedOrder(
  orderId: string,
) {
  const state =
    useOrdersStore.getState();

  return (
    state.orders.find(
      (order) =>
        order.id === orderId,
    ) ??
    (
      state.pendingOrder?.id ===
      orderId
        ? state.pendingOrder
        : null
    )
  );
}

function applyLatestOrder(
  latestOrder: Awaited<
    ReturnType<typeof getOrderByToken>
  >,
) {
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
}

export default function OrderRealtimeBridge() {
  useEffect(() => {
    let disposed = false;
    let activeUserId:
      string | null = null;
    let activeChannel:
      ReturnType<
        typeof supabase.channel
      > | null = null;
    let connectionGeneration = 0;

    const refreshingOrderIds =
      new Set<string>();

    const setRealtimeHealth = (
      userId: string | null,
      status:
        | 'idle'
        | 'connecting'
        | 'subscribed'
        | 'error',
    ) => {
      useOrderRealtimeHealthStore
        .getState()
        .setStatus(
          userId,
          status,
        );
    };

    const resetRealtimeHealth = () => {
      useOrderRealtimeHealthStore
        .getState()
        .reset();
    };

    async function removeActiveChannel() {
      const channel =
        activeChannel;

      activeChannel = null;
      activeUserId = null;
      resetRealtimeHealth();

      if (!channel) {
        return;
      }

      try {
        await supabase.removeChannel(
          channel,
        );
      } catch (error) {
        console.warn(
          'Unable to remove order realtime channel:',
          error,
        );
      }
    }

    async function refreshOrder(
      userId: string,
      orderId: string,
    ) {
      if (
        disposed ||
        refreshingOrderIds.has(
          orderId,
        )
      ) {
        return;
      }

      refreshingOrderIds.add(
        orderId,
      );

      try {
        const cachedOrder =
          getCachedOrder(orderId);

        if (cachedOrder) {
          const latestOrder =
            await getOrderByToken(
              cachedOrder.accessToken,
            );

          if (!disposed) {
            applyLatestOrder(
              latestOrder,
            );
          }

          return;
        }

        /**
         * A broadcast can arrive before a newly-created order has been
         * persisted into Zustand. Recover by refreshing the authoritative
         * order history once instead of silently dropping the event.
         */
        const latestOrders =
          await getMyOrders();

        if (!disposed) {
          useOrdersStore
            .getState()
            .replaceOrdersFromServer(
              userId,
              latestOrders,
            );
        }
      } catch (error) {
        /**
         * Realtime accelerates consistency but is never the only path. Home's
         * health-aware polling automatically becomes the fast fallback when
         * this channel is unavailable.
         */
        console.warn(
          'Unable to refresh order after realtime update:',
          error,
        );
      } finally {
        refreshingOrderIds.delete(
          orderId,
        );
      }
    }

    async function connectForSession(
      session: Awaited<
        ReturnType<
          typeof supabase.auth.getSession
        >
      >['data']['session'],
    ) {
      const generation =
        ++connectionGeneration;

      if (
        !session?.user?.id ||
        !session.access_token
      ) {
        await removeActiveChannel();
        return;
      }

      const userId =
        session.user.id;

      if (
        activeUserId === userId &&
        activeChannel
      ) {
        return;
      }

      await removeActiveChannel();

      if (
        disposed ||
        generation !==
          connectionGeneration
      ) {
        return;
      }

      useOrdersStore
        .getState()
        .prepareForUser(userId);

      setRealtimeHealth(
        userId,
        'connecting',
      );

      try {
        await supabase.realtime.setAuth(
          session.access_token,
        );
      } catch (error) {
        setRealtimeHealth(
          userId,
          'error',
        );

        console.warn(
          'Unable to authenticate order realtime channel:',
          error,
        );
        return;
      }

      if (
        disposed ||
        generation !==
          connectionGeneration
      ) {
        return;
      }

      const topic =
        `customer:${userId}:orders`;

      const channel =
        supabase.channel(
          topic,
          {
            config: {
              private: true,
            },
          },
        );

      channel.on(
        'broadcast',
        {
          event:
            'order_updated',
        },
        (message) => {
          const orderId =
            getOrderId(
              message.payload,
            );

          if (!orderId) {
            return;
          }

          void refreshOrder(
            userId,
            orderId,
          );
        },
      );

      activeUserId = userId;
      activeChannel = channel;

      channel.subscribe(
        (status) => {
          if (
            disposed ||
            generation !==
              connectionGeneration ||
            activeChannel !== channel
          ) {
            return;
          }

          if (
            status === 'SUBSCRIBED'
          ) {
            setRealtimeHealth(
              userId,
              'subscribed',
            );
            return;
          }

          if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT'
          ) {
            setRealtimeHealth(
              userId,
              'error',
            );

            console.warn(
              'Order realtime channel is unavailable.',
              status,
            );
            return;
          }

          if (status === 'CLOSED') {
            setRealtimeHealth(
              userId,
              'idle',
            );
          }
        },
      );
    }

    async function bootstrapRealtime() {
      const {
        data,
        error,
      } =
        await supabase.auth
          .getSession();

      if (error) {
        resetRealtimeHealth();

        console.warn(
          'Unable to read session for order realtime:',
          error,
        );
        return;
      }

      if (!disposed) {
        await connectForSession(
          data.session,
        );
      }
    }

    void bootstrapRealtime();

    const {
      data: authListener,
    } =
      supabase.auth
        .onAuthStateChange(
          (_event, session) => {
            /**
             * Schedule outside the auth callback so follow-up Supabase work
             * does not block the auth event lifecycle.
             */
            setTimeout(() => {
              if (!disposed) {
                void connectForSession(
                  session,
                );
              }
            }, 0);
          },
        );

    return () => {
      disposed = true;
      connectionGeneration += 1;

      authListener.subscription
        .unsubscribe();

      const channel =
        activeChannel;

      activeChannel = null;
      activeUserId = null;
      resetRealtimeHealth();

      if (channel) {
        void supabase.removeChannel(
          channel,
        );
      }
    };
  }, []);

  return null;
}
