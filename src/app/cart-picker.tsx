import { Redirect } from 'expo-router';

/**
 * Deprecated multi-Cart route.
 *
 * Kept only so old navigation history/deep links do not break after the app
 * moved to one global Cart.
 */
export default function CartPickerRedirect() {
  return <Redirect href="/cart-details" />;
}
