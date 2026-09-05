import {
  useLocalSearchParams,
} from 'expo-router';
import { useRef } from 'react';

import CartDetailsScreen from './cart-details-screen';
import {
  markNextGlobalCartCatalogRead,
} from '../services/cart-catalog-read-context';

function getSingleParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

/**
 * Route-only compatibility wrapper.
 *
 * The complete Cart component and its UI remain byte-for-byte in
 * cart-details-screen.tsx. This wrapper only marks the first normal-shopping
 * catalog read so product artwork can be resolved across every store in the
 * global Cart.
 */
export default function CartDetailsRoute() {
  const params =
    useLocalSearchParams<{
      servicePackageId?: string | string[];
    }>();

  const servicePackageId =
    getSingleParam(
      params.servicePackageId,
    )?.trim();

  const didMarkCatalogReadRef =
    useRef(false);

  if (
    !servicePackageId &&
    !didMarkCatalogReadRef.current
  ) {
    didMarkCatalogReadRef.current = true;
    markNextGlobalCartCatalogRead();
  }

  return <CartDetailsScreen />;
}
