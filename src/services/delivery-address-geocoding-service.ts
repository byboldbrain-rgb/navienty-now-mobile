import * as Location from 'expo-location';
import { Platform } from 'react-native';

import {
  resolveDeliveryAddressWithGeocoder,
  type DeliveryCoordinate,
  type ManualDeliveryAddressContext,
} from '../domain/delivery-location-selection';

/**
 * Reverse geocoding improves the address shown to the customer, but it must
 * never make location permission a prerequisite for placing an order.
 */
export async function getDeliveryAddressForCoordinate(
  coordinate: DeliveryCoordinate,
  fallbackContext: ManualDeliveryAddressContext = {},
): Promise<string> {
  return resolveDeliveryAddressWithGeocoder(
    coordinate,
    fallbackContext,
    {
      platform: Platform.OS,
      hasForegroundPermission: async () => {
        const permission =
          await Location.getForegroundPermissionsAsync();

        return permission.granted;
      },
      reverseGeocode: (selectedCoordinate) =>
        Location.reverseGeocodeAsync(
          selectedCoordinate,
        ),
    },
  );
}
