import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import { useCartStore } from '../store/cart-store';

function getSingleParam(
  value:
    | string
    | string[]
    | undefined,
) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

/**
 * Lightweight Cart entry gate.
 *
 * IMPORTANT:
 * This file intentionally contains no Cart UI, catalog loading, images,
 * Spin logic, checkout logic, or bottom-sheet rendering.
 *
 * Every existing `router.push('/cart')` in the app can keep working.
 * This tiny route decides the correct destination before the heavy Cart
 * details screen is ever mounted:
 *
 * - servicePackageId -> /cart-details?servicePackageId=...
 * - valid requested storeId -> /cart-details?storeId=...
 * - more than one non-empty cart -> /cart-picker
 * - exactly one non-empty cart -> /cart-details?storeId=...
 * - no carts -> /cart-details (empty state)
 *
 * The route itself is configured as a transparent, animation-free modal in
 * app/_layout.tsx, so the customer should not see an intermediate screen.
 */
export default function CartEntryScreen() {
  const router = useRouter();

  const params =
    useLocalSearchParams<{
      storeId?:
        | string
        | string[];
      servicePackageId?:
        | string
        | string[];
    }>();

  const requestedStoreId =
    getSingleParam(
      params.storeId,
    )?.trim() || null;

  const servicePackageId =
    getSingleParam(
      params.servicePackageId,
    )?.trim() || null;

  const hasHydrated =
    useCartStore(
      (state) =>
        state.hasHydrated,
    );

  const carts =
    useCartStore(
      (state) => state.carts,
    );

  const routingRef =
    useRef(false);

  const availableCarts =
    useMemo(
      () =>
        Object.values(carts).filter(
          (cart) =>
            cart.items.length > 0,
        ),
      [carts],
    );

  useEffect(() => {
    if (
      routingRef.current
    ) {
      return;
    }

    /*
     * Service-package Cart does not depend on the normal store-cart list.
     * Route it directly so Laundry/service flows never wait on cart-state
     * resolution unnecessarily.
     */
    if (servicePackageId) {
      routingRef.current = true;

      router.replace({
        pathname:
          '/cart-details',
        params: {
          servicePackageId,
        },
      });

      return;
    }

    /*
     * RootLayout already waits for persisted stores before rendering the
     * navigator, but keep this guard so the route remains safe if that
     * bootstrap strategy changes later.
     */
    if (!hasHydrated) {
      return;
    }

    const requestedCart =
      requestedStoreId
        ? carts[
            requestedStoreId
          ]
        : null;

    if (
      requestedStoreId &&
      requestedCart &&
      requestedCart.items.length > 0
    ) {
      routingRef.current = true;

      router.replace({
        pathname:
          '/cart-details',
        params: {
          storeId:
            requestedStoreId,
        },
      });

      return;
    }

    if (
      availableCarts.length > 1
    ) {
      routingRef.current = true;

      router.replace(
        '/cart-picker',
      );

      return;
    }

    if (
      availableCarts.length === 1
    ) {
      routingRef.current = true;

      router.replace({
        pathname:
          '/cart-details',
        params: {
          storeId:
            availableCarts[0]
              .storeId,
        },
      });

      return;
    }

    routingRef.current = true;

    router.replace(
      '/cart-details',
    );
  }, [
    availableCarts,
    carts,
    hasHydrated,
    requestedStoreId,
    router,
    servicePackageId,
  ]);

  return (
    <View
      pointerEvents="none"
      style={styles.screen}
    />
  );
}

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor:
        'transparent',
      flex: 1,
    },
  });
