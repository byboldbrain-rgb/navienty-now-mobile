import { useEffect } from 'react';

import { supabase } from '../lib/supabase';
import {
  getMyOrders,
  getOrderByToken,
} from '../services/order-service';
import { useOrdersStore } from '../store/orders-store';
import PushNotificationsBridge from './push-notifications-bridge';

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

    async function removeActiveChannel() {
      const channel =
        activeChannel;

      activeChannel = null;
      activeUserId = null;

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
            useOrdersStore
              .getState()
              .upsertOrder(
                latestOrder,
              );
          }

          return;
        }

        /**
         * A broadcast can arrive before a newly-created order has been
         * persisted into Zustand (for example during a fast admin status
         * transition). Recover by refreshing the user's authoritative order
         * history once rather than silently dropping the event.
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
         * Realtime is an acceleration path, not the only consistency path.
         * Existing focus refresh / polling remains available as a fallback.
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

      try {
        await supabase.realtime.setAuth(
          session.access_token,
        );
      } catch (error) {
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

      channel.subscribe(
        (status) => {
          if (
            status ===
            'CHANNEL_ERROR'
          ) {
            console.warn(
              'Order realtime channel failed to subscribe.',
            );
          }
        },
      );

      activeUserId = userId;
      activeChannel = channel;
    }

    async function bootstrapRealtime() {
      const {
        data,
        error,
      } =
        await supabase.auth
          .getSession();

      if (error) {
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

      if (channel) {
        void supabase.removeChannel(
          channel,
        );
      }
    };
  }, []);

  /**
   * Both customer-runtime bridges share the same root lifecycle: they mount
   * only after auth/bootstrap succeeds and the launch gate allows the app.
   */
  return (
    <PushNotificationsBridge
      enabled
    />
  );
}
