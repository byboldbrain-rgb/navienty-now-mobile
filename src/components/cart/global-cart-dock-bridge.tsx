import { usePathname, useRouter } from 'expo-router';

import {
  selectCartItemCount,
  selectCartSubtotal,
  useCartStore,
} from '../../store/cart-store';
import { BottomActionHost } from './bottom-action-provider';
import { CategoryCartDockView } from './category-cart-dock';

type GlobalCartDockBridgeProps = {
  enabled?: boolean;
};

/**
 * These routes already have non-cart navigation or checkout controls.
 * This is only a legacy FALLBACK eligibility rule, not a list of screens
 * with their own cart dock. New screens declare their action via
 * BottomActionSlot, which wins over the fallback automatically.
 */
const ROUTES_WITH_BOTTOM_NAVIGATION = new Set(['/', '/account', '/orders']);

const CHECKOUT_FLOW_PREFIXES = [
  '/address-details',
  '/cart',
  '/cart-details',
  '/cart-details-screen',
  '/cart-picker',
  '/checkout',
  '/global-checkout',
  '/global-location-picker',
  '/global-order-success',
  '/location-picker',
  '/login',
  '/notification-settings',
  '/notification-test',
  '/order',
  '/order-confirmation',
  '/order-success',
  '/payment-proof',
  '/service-booking-payment-proof',
];

function normalizePathname(pathname: string | null): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function canShowLegacyCartFallback(pathname: string): boolean {
  if (ROUTES_WITH_BOTTOM_NAVIGATION.has(pathname)) return false;

  return !CHECKOUT_FLOW_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * One root-level host for ALL bottom actions.
 *
 * A screen-owned purchase/checkout/cart-summary/none registration takes
 * precedence over this global cart fallback. No duplicate overlays.
 */
export default function GlobalCartDockBridge({
  enabled = true,
}: GlobalCartDockBridgeProps) {
  const pathname = normalizePathname(usePathname());
  const router = useRouter();
  const itemCount = useCartStore(selectCartItemCount);
  const subtotal = useCartStore(selectCartSubtotal);

  const fallback = itemCount > 0 && canShowLegacyCartFallback(pathname)
    ? (
      <CategoryCartDockView
        currencyCode="EGP"
        isScrollingDown={false}
        itemCount={itemCount}
        minimumOrder={0}
        subtotal={subtotal}
        onPress={() => router.push('/cart')}
      />
    )
    : null;

  return <BottomActionHost enabled={enabled} fallback={fallback} />;
}
