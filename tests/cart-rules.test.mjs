import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasDifferentRestaurantCart,
  isRestaurantCartCategory,
  isSameCartLine,
} from '../src/domain/cart-rules.ts';

test('restaurant category normalization accepts supported aliases', () => {
  assert.equal(
    isRestaurantCartCategory('restaurants'),
    true,
  );
  assert.equal(
    isRestaurantCartCategory(' Restaurant '),
    true,
  );
  assert.equal(
    isRestaurantCartCategory('supermarket'),
    false,
  );
  assert.equal(
    isRestaurantCartCategory(null),
    false,
  );
});

test('a second different restaurant cart is blocked', () => {
  const carts = [
    {
      storeId: 'restaurant-a',
      categorySlug: 'restaurants',
      items: [{ id: 'burger' }],
    },
    {
      storeId: 'bookstore-a',
      categorySlug: 'bookstores',
      items: [{ id: 'notebook' }],
    },
  ];

  assert.equal(
    hasDifferentRestaurantCart(
      carts,
      'restaurant-b',
      'restaurant',
    ),
    true,
  );
});

test('same restaurant and non-restaurant carts remain allowed', () => {
  const carts = [
    {
      storeId: 'restaurant-a',
      categorySlug: 'restaurants',
      items: [{ id: 'burger' }],
    },
    {
      storeId: 'supermarket-a',
      categorySlug: 'supermarket',
      items: [{ id: 'water' }],
    },
  ];

  assert.equal(
    hasDifferentRestaurantCart(
      carts,
      'restaurant-a',
      'restaurants',
    ),
    false,
  );

  assert.equal(
    hasDifferentRestaurantCart(
      carts,
      'bookstore-b',
      'bookstores',
    ),
    false,
  );
});

test('empty restaurant carts do not block a new restaurant', () => {
  assert.equal(
    hasDifferentRestaurantCart(
      [
        {
          storeId: 'restaurant-a',
          categorySlug: 'restaurants',
          items: [],
        },
      ],
      'restaurant-b',
      'restaurants',
    ),
    false,
  );
});

test('cart line identity includes normalized variant ID', () => {
  const small = {
    id: 'pizza-1',
    variantId: 'small',
  };

  assert.equal(
    isSameCartLine(
      small,
      'pizza-1',
      'small',
    ),
    true,
  );

  assert.equal(
    isSameCartLine(
      small,
      'pizza-1',
      'large',
    ),
    false,
  );

  assert.equal(
    isSameCartLine(
      {
        id: 'water-1',
        variantId: '  ',
      },
      'water-1',
      null,
    ),
    true,
  );
});
