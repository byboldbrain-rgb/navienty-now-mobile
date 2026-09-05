import {
  usePathname,
  useRouter,
} from 'expo-router';

import {
  selectCartItemCount,
  selectCartSubtotal,
  useCartStore,
} from '../../store/cart-store';
import CategoryCartDock from './category-cart-dock';

type GlobalCartDockBridgeProps = {
  enabled?: boolean;
};

const ROUTES_WITH_BOTTOM_CART_ACCESS = new Set([
  '/',
  '/account',
  '/orders',
]);

const ROUTES_WITH_LOCAL_CART_DOCK = new Set([
  '/category/bookstore',
  '/category/books',
  '/category/library',
  '/category/personal-care',
  '/category/stationery',
  '/category/supermarket',
]);

const LOCAL_CART_DOCK_PREFIXES = [
  '/bookstore-category/',
  '/personal-care-category/',
  '/store/',
  '/supermarket-category/',
];

const CART_FLOW_PREFIXES = [
  '/address-details',
  '/cart',
  '/checkout',
  '/global-checkout',
  '/global-location-picker',
  '/global-order-success',
  '/location-picker',
  '/login',
  '/notification-settings',
  '/notification-test',
  '/order',
  '/payment-proof',
  '/service-booking-payment-proof',
];

function normalizePathname(
  pathname: string | null,
): string {
  if (!pathname) {
    return '/';
  }

  if (pathname === '/') {
    return pathname;
  }

  const normalized = pathname.replace(
    /\/+$/,
    '',
  );

  return normalized || '/';
}

function routeOwnsCartAccess(
  pathname: string,
): boolean {
  if (
    ROUTES_WITH_BOTTOM_CART_ACCESS.has(
      pathname,
    ) ||
    ROUTES_WITH_LOCAL_CART_DOCK.has(
      pathname,
    )
  ) {
    return true;
  }

  if (
    LOCAL_CART_DOCK_PREFIXES.some(
      (prefix) =>
        pathname.startsWith(prefix),
    )
  ) {
    return true;
  }

  return CART_FLOW_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(
        `${prefix}/`,
      ),
  );
}

/**
 * Global fallback for screens that do not already render their own Cart dock
 * or bottom navigation Cart tab.
 *
 * Product-heavy screens keep their existing scroll-aware Cart dock. Any other
 * screen immediately gains the same customer-facing Cart entry point as soon
 * as the shared Cart contains at least one item.
 */
export default function GlobalCartDockBridge({
  enabled = true,
}: GlobalCartDockBridgeProps) {
  const pathname = normalizePathname(
    usePathname(),
  );
  const router = useRouter();

  const itemCount = useCartStore(
    selectCartItemCount,
  );
  const subtotal = useCartStore(
    selectCartSubtotal,
  );

  if (
    !enabled ||
    itemCount <= 0 ||
    routeOwnsCartAccess(pathname)
  ) {
    return null;
  }

  return (
    <CategoryCartDock
      currencyCode="EGP"
      isScrollingDown={false}
      itemCount={itemCount}
      minimumOrder={0}
      subtotal={subtotal}
      onPress={() => {
        router.push('/cart');
      }}
    />
  );
}
