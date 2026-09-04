import type { Order } from '../../store/orders-store';
import type {
    ForYouRecommendation,
    RecentlyViewedItem,
} from './home-model';

export type BehaviorEventInput = {
  eventName: string;
  serviceAreaId?: string | null;
  properties?: Record<string, unknown>;
};

/*
 * RELEASE WORKSPACE COMPATIBILITY
 *
 * The current release workspace does not bundle the newer Home
 * personalization/analytics services. Keep the public Home contract explicit
 * and isolated here so the screen remains production-safe without pretending
 * the services exist. Replacing this module with real service adapters later
 * does not require changing the Home UI or route orchestration.
 */
export function trackBehaviorEvent(
  _event: BehaviorEventInput,
): Promise<void> {
  return Promise.resolve();
}

export function getForYouRecommendations(
  _input: {
    serviceAreaId?: string | null;
    orders: readonly Order[];
  },
): Promise<ForYouRecommendation[]> {
  return Promise.resolve([]);
}

export function getRecentlyViewedItems(
  _limit: number,
): Promise<RecentlyViewedItem[]> {
  return Promise.resolve([]);
}

export function subscribeRecentlyViewed(
  _listener: (
    items: RecentlyViewedItem[],
  ) => void,
): () => void {
  return () => undefined;
}

export function clearSearchAttribution(): Promise<void> {
  return Promise.resolve();
}
