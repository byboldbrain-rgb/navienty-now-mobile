export type GeocodedDeliveryAddress = {
  formattedAddress?: string | null;
  streetNumber?: string | null;
  street?: string | null;
  name?: string | null;
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type ManualDeliveryAddressContext = {
  serviceAreaName?: string | null;
  cityName?: string | null;
};

export type DeliveryCoordinate = {
  latitude: number;
  longitude: number;
};

export type DeliveryAddressGeocoder = {
  platform: string;
  hasForegroundPermission: () => Promise<boolean>;
  reverseGeocode: (
    coordinate: DeliveryCoordinate,
  ) => Promise<GeocodedDeliveryAddress[]>;
};

const MANUAL_LOCATION_LABEL_AR =
  'موقع محدد يدويًا على الخريطة';

function uniqueNonEmptyParts(
  parts: (string | null | undefined)[],
): string[] {
  const uniqueParts: string[] = [];

  parts.forEach((part) => {
    const normalized = part?.trim();

    if (
      !normalized ||
      uniqueParts.some(
        (existingPart) =>
          existingPart.toLocaleLowerCase() ===
          normalized.toLocaleLowerCase(),
      )
    ) {
      return;
    }

    uniqueParts.push(normalized);
  });

  return uniqueParts;
}

export function buildGeocodedDeliveryAddress(
  address: GeocodedDeliveryAddress,
): string {
  const formattedAddress =
    address.formattedAddress?.trim();

  if (formattedAddress) {
    return formattedAddress;
  }

  const streetLine = uniqueNonEmptyParts([
    address.streetNumber,
    address.street,
  ]).join(' ');

  return uniqueNonEmptyParts([
    address.name,
    streetLine,
    address.district,
    address.subregion,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ]).join('، ');
}

export function buildManualDeliveryAddress(
  context: ManualDeliveryAddressContext = {},
): string {
  return uniqueNonEmptyParts([
    MANUAL_LOCATION_LABEL_AR,
    context.serviceAreaName,
    context.cityName,
  ]).join('، ');
}

/**
 * Expo SDK 57 only requires foreground location permission for native
 * geocoding on Android. iOS geocoding must remain available when Location
 * Services are disabled so manually selected delivery pins are not blocked.
 */
export function requiresForegroundPermissionForGeocoding(
  platform: string,
): boolean {
  return platform === 'android';
}

/**
 * Turns reverse geocoding into a best-effort enhancement. A manually selected
 * coordinate stays valid even when permissions, Location Services, or the
 * device geocoder are unavailable.
 */
export async function resolveDeliveryAddressWithGeocoder(
  coordinate: DeliveryCoordinate,
  fallbackContext: ManualDeliveryAddressContext,
  geocoder: DeliveryAddressGeocoder,
): Promise<string> {
  const fallbackAddress =
    buildManualDeliveryAddress(fallbackContext);

  if (
    requiresForegroundPermissionForGeocoding(
      geocoder.platform,
    )
  ) {
    try {
      if (!(await geocoder.hasForegroundPermission())) {
        return fallbackAddress;
      }
    } catch {
      return fallbackAddress;
    }
  }

  try {
    const addresses =
      await geocoder.reverseGeocode(coordinate);
    const firstAddress = addresses[0];

    if (!firstAddress) {
      return fallbackAddress;
    }

    return (
      buildGeocodedDeliveryAddress(firstAddress) ||
      fallbackAddress
    );
  } catch {
    return fallbackAddress;
  }
}
