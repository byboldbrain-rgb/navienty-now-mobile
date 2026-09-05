import {
  useLocalSearchParams,
} from 'expo-router';

import GlobalCartScreen from '../components/cart/global-cart-screen';
import ServicePackageCart from '../components/service/service-package-cart';

function getSingleParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

/**
 * One route, two intentionally separate domains:
 * - laundry/service packages keep their existing dedicated Cart;
 * - catalog shopping uses the single cross-store global Cart.
 */
export default function CartDetailsScreen() {
  const params =
    useLocalSearchParams<{
      servicePackageId?: string | string[];
    }>();

  const servicePackageId =
    getSingleParam(
      params.servicePackageId,
    )?.trim();

  if (servicePackageId) {
    return (
      <ServicePackageCart
        servicePackageId={servicePackageId}
      />
    );
  }

  return <GlobalCartScreen />;
}
