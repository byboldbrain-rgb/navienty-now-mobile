import { useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  Alert,
  AppState,
  type AppStateStatus,
  StyleSheet,
  View,
} from 'react-native';

import {
  confirmWhatsAppOrderSent,
} from '../services/order-service';
import {
  useCartStore,
} from '../store/cart-store';
import {
  useOrdersStore,
} from '../store/orders-store';
import {
  openOrderInWhatsApp,
} from '../utils/order-whatsapp';

const CONFIRM_RETRY_DELAYS_MS = [
  0,
  700,
  1500,
];

function wait(
  milliseconds: number,
): Promise<void> {
  if (milliseconds <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function confirmOrderWithRetry(
  accessToken: string,
) {
  let lastError: unknown = null;

  for (
    let index = 0;
    index < CONFIRM_RETRY_DELAYS_MS.length;
    index += 1
  ) {
    try {
      await wait(
        CONFIRM_RETRY_DELAYS_MS[index],
      );

      return await confirmWhatsAppOrderSent(
        accessToken,
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        'تعذر تأكيد إرسال الطلب.',
      );
}

/**
 * Invisible WhatsApp handoff route.
 *
 * Checkout still routes here internally after creating the order, but the
 * customer never sees the old confirmation UI:
 *
 * 1) WhatsApp opens automatically.
 * 2) We wait until the app actually leaves the foreground.
 * 3) As soon as the customer returns to Navienty Now, we immediately move
 *    them to Order Success.
 * 4) The Supabase "WhatsApp sent" confirmation is completed in the
 *    background and the cart is cleared.
 *
 * Important: AppState can only tell us that the customer left the app and
 * returned. It cannot prove that they pressed Send inside WhatsApp. True
 * message-delivery verification would require WhatsApp Business webhooks.
 */
export default function OrderConfirmationScreen() {
  const router = useRouter();

  const hasHydrated = useOrdersStore(
    (state) => state.hasHydrated,
  );

  const pendingOrder = useOrdersStore(
    (state) => state.pendingOrder,
  );

  const confirmPendingOrder =
    useOrdersStore(
      (state) =>
        state.confirmPendingOrder,
    );

  const clearCart = useCartStore(
    (state) => state.clearCart,
  );

  const appStateRef = useRef<AppStateStatus>(
    AppState.currentState,
  );

  const handoffStartedRef = useRef(false);
  const appWasBackgroundedRef = useRef(false);
  const returnHandledRef = useRef(false);

  const confirmInBackground = useCallback(
    async (
      accessToken: string,
    ) => {
      try {
        const confirmedOrder =
          await confirmOrderWithRetry(
            accessToken,
          );

        confirmPendingOrder(
          confirmedOrder,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'تعذر تأكيد إرسال الطلب.';

        Alert.alert(
          'الطلب تم إنشاؤه',
          `${message}\n\nالطلب محفوظ ويمكنك متابعته من شاشة الطلب.`,
        );
      }
    },
    [confirmPendingOrder],
  );

  const handleReturnFromWhatsApp =
    useCallback(() => {
      if (
        returnHandledRef.current
      ) {
        return;
      }

      const currentOrder =
        useOrdersStore
          .getState()
          .pendingOrder ??
        pendingOrder;

      if (!currentOrder) {
        return;
      }

      returnHandledRef.current = true;

      /*
       * Move to success FIRST so the customer never lands back on an
       * intermediate confirmation page while the network request finishes.
       */
      clearCart();

      router.replace({
        pathname: '/order-success',
        params: {
          id: currentOrder.id,
        },
      });

      void confirmInBackground(
        currentOrder.accessToken,
      );
    },
    [
      clearCart,
      confirmInBackground,
      pendingOrder,
      router,
    ],
  );

  useEffect(() => {
    const subscription =
      AppState.addEventListener(
        'change',
        (nextState) => {
          const previousState =
            appStateRef.current;

          appStateRef.current =
            nextState;

          if (
            !handoffStartedRef.current ||
            returnHandledRef.current
          ) {
            return;
          }

          if (
            nextState === 'inactive' ||
            nextState === 'background'
          ) {
            appWasBackgroundedRef.current =
              true;
            return;
          }

          if (
            nextState === 'active' &&
            previousState !== 'active' &&
            appWasBackgroundedRef.current
          ) {
            handleReturnFromWhatsApp();
          }
        },
      );

    return () => {
      subscription.remove();
    };
  }, [handleReturnFromWhatsApp]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!pendingOrder) {
      router.replace('/checkout');
      return;
    }

    if (handoffStartedRef.current) {
      return;
    }

    handoffStartedRef.current = true;
    appWasBackgroundedRef.current = false;
    returnHandledRef.current = false;

    void openOrderInWhatsApp(
      pendingOrder,
    ).catch((error) => {
      handoffStartedRef.current = false;

      const message =
        error instanceof Error
          ? error.message
          : 'تعذر فتح واتساب.';

      Alert.alert(
        'تعذر فتح واتساب',
        message,
        [
          {
            text: 'رجوع',
            onPress: () => {
              router.replace('/checkout');
            },
          },
        ],
      );
    });
  }, [
    hasHydrated,
    pendingOrder,
    router,
  ]);

  /*
   * This route is intentionally visually empty. It only exists for the
   * native app -> WhatsApp -> native app handoff.
   */
  return (
    <View
      style={styles.screen}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
});
