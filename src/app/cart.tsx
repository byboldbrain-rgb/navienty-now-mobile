import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useRef,
} from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import { useCartStore } from '../store/cart-store';

function getSingleParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

/**
 * Compatibility entry point for every existing `router.push('/cart')` call.
 *
 * Normal shopping now has exactly one global Cart, so storeId is intentionally
 * ignored. Service-package checkout keeps its existing dedicated flow.
 */
export default function CartEntryScreen() {
  const router = useRouter();
  const params =
    useLocalSearchParams<{
      servicePackageId?: string | string[];
    }>();
  const hasHydrated = useCartStore(
    (state) => state.hasHydrated,
  );
  const routingRef = useRef(false);

  const servicePackageId =
    getSingleParam(
      params.servicePackageId,
    )?.trim() || null;

  useEffect(() => {
    if (routingRef.current) {
      return;
    }

    if (servicePackageId) {
      routingRef.current = true;
      router.replace({
        pathname: '/cart-details',
        params: { servicePackageId },
      });
      return;
    }

    if (!hasHydrated) {
      return;
    }

    routingRef.current = true;
    router.replace('/cart-details');
  }, [
    hasHydrated,
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

const styles = StyleSheet.create({
  screen: {
    backgroundColor: 'transparent',
    flex: 1,
  },
});
