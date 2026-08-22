import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createClientRequestId,
  getOrderRequestFingerprint,
} from '../src/domain/order-idempotency.ts';

function makeInput(overrides = {}) {
  return {
    storeId: 'store-1',
    serviceAreaId: 'area-1',
    deliveryLatitude: 27.1801,
    deliveryLongitude: 31.1893,
    paymentMethodId: 'payment-1',
    customerName: ' Evan ',
    customerPhone: '010 1234-5678',
    address: ' Building 12, Apartment 4 ',
    landmark: ' Near Gate 2 ',
    notes: ' Call on arrival ',
    items: [
      {
        productId: 'product-b',
        variantId: 'large',
        quantity: 2,
      },
      {
        productId: 'product-a',
        variantId: null,
        quantity: 1,
      },
    ],
    ...overrides,
  };
}

test('same logical checkout produces the same fingerprint', () => {
  const first = getOrderRequestFingerprint(
    makeInput(),
  );

  const second = getOrderRequestFingerprint(
    makeInput({
      customerName: 'Evan',
      customerPhone: '01012345678',
      address: 'Building 12, Apartment 4',
      landmark: 'Near Gate 2',
      notes: 'Call on arrival',
      items: [
        {
          productId: 'product-a',
          variantId: '',
          quantity: 1,
        },
        {
          productId: 'product-b',
          variantId: 'large',
          quantity: 2,
        },
      ],
    }),
  );

  assert.equal(first, second);
});

test('material checkout changes produce a different fingerprint', () => {
  const original = getOrderRequestFingerprint(
    makeInput(),
  );

  const changedQuantity =
    getOrderRequestFingerprint(
      makeInput({
        items: [
          {
            productId: 'product-b',
            variantId: 'large',
            quantity: 3,
          },
          {
            productId: 'product-a',
            variantId: null,
            quantity: 1,
          },
        ],
      }),
    );

  const changedVariant =
    getOrderRequestFingerprint(
      makeInput({
        items: [
          {
            productId: 'product-b',
            variantId: 'small',
            quantity: 2,
          },
          {
            productId: 'product-a',
            variantId: null,
            quantity: 1,
          },
        ],
      }),
    );

  const changedPayment =
    getOrderRequestFingerprint(
      makeInput({
        paymentMethodId: 'payment-2',
      }),
    );

  assert.notEqual(original, changedQuantity);
  assert.notEqual(original, changedVariant);
  assert.notEqual(original, changedPayment);
});

test('fingerprint is compact and does not persist customer PII', () => {
  const fingerprint = getOrderRequestFingerprint(
    makeInput(),
  );

  assert.match(fingerprint, /^[0-9a-f]{16}$/);
  assert.equal(fingerprint.includes('Evan'), false);
  assert.equal(
    fingerprint.includes('01012345678'),
    false,
  );
});

test('client request ID has RFC-4122 v4 shape', () => {
  const values = [
    0.01,
    0.13,
    0.27,
    0.41,
    0.55,
    0.69,
    0.83,
    0.97,
  ];
  let index = 0;

  const requestId = createClientRequestId(
    () => {
      const value = values[index % values.length];
      index += 1;
      return value;
    },
  );

  assert.match(
    requestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});
