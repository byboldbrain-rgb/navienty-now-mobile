import {
  getGlobalCartStoreGroups,
} from '../store/cart-store';
import { sumStoreDeliveryFees } from '../domain/store-delivery-pricing';
import * as legacy from './delivery-location-service-legacy';

export * from './delivery-location-service-legacy';

/**
 * The RPC is authoritative for a particular store and destination. Never
 * replace a valid 0 delivery fee with a general cart or service-area fee.
 *
 * In a multi-store cart, each store's delivery is charged independently.
 * The aggregate quote is the sum of all authoritative store-area fees.
 */
export async function resolveDeliveryLocation(
  input: {
    latitude: number;
    longitude: number;
    storeId?: string | null;
  },
): Promise<legacy.DeliveryLocationResolution> {
  if (input.storeId) {
    return legacy.resolveDeliveryLocation(input);
  }

  const groups = getGlobalCartStoreGroups();
  if (groups.length === 0) {
    return legacy.resolveDeliveryLocation(input);
  }

  const resolutions = await Promise.all(
    groups.map((group) =>
      legacy.resolveDeliveryLocation({
        latitude: input.latitude,
        longitude: input.longitude,
        storeId: group.storeId,
      }),
    ),
  );

  const unavailable = resolutions.find(
    (resolution) =>
      !resolution.serviceable || resolution.storeAvailable !== true,
  );

  if (unavailable) {
    return {
      ...unavailable,
      storeId: null,
      storeAvailable: false,
      deliveryFee: null,
    };
  }

  const fees = resolutions.map((resolution) => resolution.deliveryFee);
  const deliveryFee = fees.every(
    (fee): fee is number => fee !== null && Number.isFinite(fee) && fee >= 0,
  )
    ? sumStoreDeliveryFees(fees as number[])
    : null;

  return {
    ...resolutions[0],
    storeId: null,
    storeAvailable: true,
    deliveryFee,
    estimatedDeliveryMinutes:
      Math.max(...resolutions.map(
        (resolution) => resolution.estimatedDeliveryMinutes ?? 0,
      )) || resolutions[0].estimatedDeliveryMinutes,
  };
}
