import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileCartLines } from '../src/domain/cart-catalog-reconciliation.ts';

const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const variantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function product(overrides = {}) {
  return {
    id: productId,
    name: 'عصير برتقال',
    description: 'طازج',
    icon: '🥤',
    price: 25,
    isAgeRestricted: false,
    variants: [],
    ...overrides,
  };
}

function item(overrides = {}) {
  return {
    id: productId,
    lineId: 'catalog:' + productId + ':base',
    itemKind: 'catalog_product',
    printJob: null,
    name: 'عصير برتقال',
    description: 'طازج',
    icon: '🥤',
    price: 25,
    quantity: 2,
    variantId: null,
    variantName: null,
    isAgeRestricted: false,
    ...overrides,
  };
}

test('an already-current cart is unchanged without a needless persisted write', () => {
  const original = [item()];
  const result = reconcileCartLines(original, [product()]);
  assert.equal(result.changed, false);
  assert.strictEqual(result.items, original);
  assert.deepEqual(result.unavailable, []);
});

test('unique exact name safely repairs an old local ID and keeps quantity', () => {
  const result = reconcileCartLines(
    [item({ id: 'legacy-juice', lineId: 'catalog:legacy-juice:base' })],
    [product()],
  );
  assert.equal(result.unavailable.length, 0);
  assert.equal(result.items[0].id, productId);
  assert.equal(result.items[0].lineId, 'catalog:' + productId + ':base');
  assert.equal(result.items[0].quantity, 2);
});

test('duplicate product names never get auto-mapped to an arbitrary ID', () => {
  const result = reconcileCartLines(
    [item({ id: 'old', lineId: 'catalog:old:base' })],
    [product(), product({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })],
  );
  assert.equal(result.unavailable.length, 1);
  assert.equal(result.items.length, 0);
});

test('variant name can safely migrate a legacy variant ID', () => {
  const result = reconcileCartLines(
    [item({ variantId: 'size-old', variantName: 'كبير', price: 35 })],
    [product({ variants: [{ id: variantId, name: 'كبير', price: 35 }] })],
  );
  assert.equal(result.items[0].variantId, variantId);
  assert.equal(result.items[0].price, 35);
  assert.equal(result.unavailable.length, 0);
});

test('missing variant is reported rather than replaced with a random variant', () => {
  const result = reconcileCartLines(
    [item({ variantId: 'old', variantName: 'متوسط' })],
    [product({ variants: [{ id: variantId, name: 'كبير', price: 35 }] })],
  );
  assert.equal(result.unavailable.length, 1);
});

test('price refresh requires review and never mutates original cart line', () => {
  const old = item();
  const result = reconcileCartLines([old], [product({ price: 30 })]);
  assert.deepEqual(result.priceChanges, [{ name: 'عصير برتقال', before: 25, after: 30 }]);
  assert.equal(old.price, 25);
  assert.equal(result.items[0].price, 30);
});

test('print jobs bypass catalog pricing when their server IDs are valid', () => {
  const print = item({
    itemKind: 'print_job',
    printJob: { productVariantId: variantId },
    price: 140,
  });
  const result = reconcileCartLines([print], []);
  assert.equal(result.unavailable.length, 0);
  assert.strictEqual(result.items[0], print);
});

test('duplicate legacy IDs that now refer to one real line are merged', () => {
  const result = reconcileCartLines(
    [
      item({ id: 'legacy-a', lineId: 'catalog:legacy-a:base' }),
      item({ id: 'legacy-b', lineId: 'catalog:legacy-b:base' }),
    ],
    [product()],
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 4);
});
