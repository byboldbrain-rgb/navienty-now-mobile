import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGeocodedDeliveryAddress,
  buildManualDeliveryAddress,
  requiresForegroundPermissionForGeocoding,
  resolveDeliveryAddressWithGeocoder,
} from '../src/domain/delivery-location-selection.ts';

test('iOS geocoding does not require foreground location permission', () => {
  assert.equal(
    requiresForegroundPermissionForGeocoding('ios'),
    false,
  );
  assert.equal(
    requiresForegroundPermissionForGeocoding('android'),
    true,
  );
});

test('formatted reverse-geocoded address takes precedence', () => {
  assert.equal(
    buildGeocodedDeliveryAddress({
      formattedAddress:
        'Badr University, New Nasser City',
      city: 'Assiut',
    }),
    'Badr University, New Nasser City',
  );
});

test('address parts are normalized and deduplicated', () => {
  assert.equal(
    buildGeocodedDeliveryAddress({
      name: 'مبنى 12',
      streetNumber: '12',
      street: 'شارع الجامعة',
      district: 'الهضبة',
      city: 'أسيوط',
      region: 'أسيوط',
      country: 'مصر',
    }),
    'مبنى 12، 12 شارع الجامعة، الهضبة، أسيوط، مصر',
  );
});

test('manual pin fallback remains a usable address label', () => {
  assert.equal(
    buildManualDeliveryAddress({
      serviceAreaName: 'الهضبة',
      cityName: 'أسيوط',
    }),
    'موقع محدد يدويًا على الخريطة، الهضبة، أسيوط',
  );
});

test('iOS reverse geocodes a manual pin without checking permission', async () => {
  let permissionWasChecked = false;

  const address =
    await resolveDeliveryAddressWithGeocoder(
      {
        latitude: 27.1885,
        longitude: 31.1637,
      },
      {},
      {
        platform: 'ios',
        hasForegroundPermission: async () => {
          permissionWasChecked = true;
          return false;
        },
        reverseGeocode: async () => [
          {
            formattedAddress: 'الهضبة، أسيوط',
          },
        ],
      },
    );

  assert.equal(permissionWasChecked, false);
  assert.equal(address, 'الهضبة، أسيوط');
});

test('Android permission denial returns a manual pin fallback', async () => {
  let geocoderWasCalled = false;

  const address =
    await resolveDeliveryAddressWithGeocoder(
      {
        latitude: 27.1885,
        longitude: 31.1637,
      },
      {
        serviceAreaName: 'الهضبة',
      },
      {
        platform: 'android',
        hasForegroundPermission: async () => false,
        reverseGeocode: async () => {
          geocoderWasCalled = true;
          return [];
        },
      },
    );

  assert.equal(geocoderWasCalled, false);
  assert.equal(
    address,
    'موقع محدد يدويًا على الخريطة، الهضبة',
  );
});

test('geocoder failure never blocks the selected coordinate', async () => {
  const address =
    await resolveDeliveryAddressWithGeocoder(
      {
        latitude: 27.1885,
        longitude: 31.1637,
      },
      {},
      {
        platform: 'ios',
        hasForegroundPermission: async () => true,
        reverseGeocode: async () => {
          throw new Error('Location Services disabled');
        },
      },
    );

  assert.equal(
    address,
    'موقع محدد يدويًا على الخريطة',
  );
});
