import StoreScreen from '../store/[id]';

/**
 * Dedicated, store-scoped menu search.
 *
 * Reuse the restaurant catalog's product cards, variants, and cart logic so
 * adding an item from search behaves identically to adding it from the menu.
 */
export default function RestaurantSearchRoute() {
  return <StoreScreen searchOnly />;
}
