import { GLOBAL_CART_DELIVERY_FEE } from '../config/global-cart';
import {
  getGlobalCartStoreGroups,
} from '../store/cart-store';
import * as legacy from './delivery-location-service-legacy';

export * from './delivery-location-service-legacy';

export async function resolveDeliveryLocation(
  input: {
    latitude: number;
    longitude: number;
    storeId?: string | null;
  },
): Promise<legacy.DeliveryLocationResolution> {
  const groups =
    getGlobalCartStoreGroups();

  if (groups.length <= 1) {
    const resolution =
      await legacy.resolveDeliveryLocation(
        input,
      );

    return {
      ...resolution,
      minimumOrder: 0,
      deliveryFee:
        groups.length === 1
          ? GLOBAL_CART_DELIVERY_FEE
          : resolution.deliveryFee,
    };
  }

  const resolutions =
    await Promise.all(
      groups.map(
        (group) =>
          legacy.resolveDeliveryLocation({
            latitude:
              input.latitude,
            longitude:
              input.longitude,
            storeId:
              group.storeId,
          }),
      ),
    );

  const unavailable =
    resolutions.find(
      (resolution) =>
        !resolution.serviceable ||
        resolution.storeAvailable !==
          true,
    );

  if (unavailable) {
    return {
      ...unavailable,
      storeId:
        input.storeId ??
        unavailable.storeId,
      storeAvailable: false,
      deliveryFee:
        GLOBAL_CART_DELIVERY_FEE,
      minimumOrder: 0,
    };
  }

  const base = resolutions[0];

  return {
    ...base,
    serviceable: true,
    reason: null,
    storeId:
      input.storeId ??
      base.storeId,
    storeAvailable: true,
    deliveryFee:
      GLOBAL_CART_DELIVERY_FEE,
    minimumOrder: 0,
    estimatedDeliveryMinutes:
      Math.max(
        ...resolutions.map(
          (resolution) =>
            Number(
              resolution
                .estimatedDeliveryMinutes ??
                0,
            ),
        ),
      ) ||
      base.estimatedDeliveryMinutes,
  };
}
