import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getLegacyRequestAnythingCartConfiguration,
  resolveRequestAnythingCartConfiguration,
} from '../src/domain/request-anything-cart-config.ts';

const requestAnythingStore = {
  id: 'store-remote',
  slug: 'request-anything-internal',
  categorySlug: 'request-anything',
  name: 'اطلب أي حاجة',
  icon: '🛍️',
  deliveryFee: 31,
  minimumOrder: 0,
};

test('remote Request Anything store, product and delivery config win over fallback', () => {
  const configuration =
    resolveRequestAnythingCartConfiguration(
      [requestAnythingStore],
      {
        sections: [
          {
            products: [
              {
                id: 'product-remote',
                slug: 'request-anything',
                name: 'اطلب أي حاجة',
                icon: '📦',
              },
            ],
          },
        ],
      },
    );

  assert.deepEqual(
    configuration,
    {
      storeId: 'store-remote',
      productId: 'product-remote',
      storeName: 'اطلب أي حاجة',
      storeIcon: '🛍️',
      categorySlug: 'request-anything',
      deliveryFee: 31,
      minimumOrder: 0,
      productName: 'اطلب أي حاجة',
      productIcon: '📦',
      source: 'remote',
    },
  );
});

test('explicit Request Anything product is selected from a multi-product catalog', () => {
  const configuration =
    resolveRequestAnythingCartConfiguration(
      [requestAnythingStore],
      {
        sections: [
          {
            products: [
              {
                id: 'unrelated-product',
                slug: 'other-item',
                name: 'منتج آخر',
              },
              {
                id: 'request-product',
                slug: 'custom-request',
                name: 'Custom request',
              },
            ],
          },
        ],
      },
    );

  assert.equal(
    configuration?.productId,
    'request-product',
  );
});

test('a single placeholder product is accepted even when its slug is legacy', () => {
  const configuration =
    resolveRequestAnythingCartConfiguration(
      [requestAnythingStore],
      {
        sections: [
          {
            products: [
              {
                id: 'legacy-placeholder',
                slug: 'internal-placeholder-v1',
                name: 'Placeholder',
              },
            ],
          },
        ],
      },
    );

  assert.equal(
    configuration?.productId,
    'legacy-placeholder',
  );
  assert.equal(
    configuration?.source,
    'remote',
  );
});

test('resolver refuses ambiguous or incomplete remote configuration', () => {
  assert.equal(
    resolveRequestAnythingCartConfiguration(
      [],
      null,
    ),
    null,
  );

  assert.equal(
    resolveRequestAnythingCartConfiguration(
      [requestAnythingStore],
      {
        sections: [
          {
            products: [
              {
                id: 'first',
                slug: 'first-product',
                name: 'First',
              },
              {
                id: 'second',
                slug: 'second-product',
                name: 'Second',
              },
            ],
          },
        ],
      },
    ),
    null,
  );

  assert.equal(
    resolveRequestAnythingCartConfiguration(
      [
        {
          ...requestAnythingStore,
          deliveryFee: -1,
        },
      ],
      {
        sections: [
          {
            products: [
              {
                id: 'request-product',
                slug: 'request-anything',
              },
            ],
          },
        ],
      },
    ),
    null,
  );
});

test('legacy configuration remains an explicit backward-compatible fallback', () => {
  const fallback =
    getLegacyRequestAnythingCartConfiguration();

  assert.equal(
    fallback.storeId,
    '4ebd8b80-8288-4c9b-980a-f15b5274e78b',
  );
  assert.equal(
    fallback.productId,
    'b260c5e5-e6cb-462b-b025-627d7bb2cff2',
  );
  assert.equal(
    fallback.deliveryFee,
    25,
  );
  assert.equal(
    fallback.source,
    'legacy-fallback',
  );
});
