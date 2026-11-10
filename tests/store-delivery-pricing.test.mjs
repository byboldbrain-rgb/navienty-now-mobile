import assert from 'node:assert/strict';
import test from 'node:test';
import { sumStoreDeliveryFees } from '../src/domain/store-delivery-pricing.ts';

test('two 25 EGP restaurants pay 50 EGP delivery', () => {
  assert.equal(sumStoreDeliveryFees([25, 25]), 50);
});

test('free-delivery store retains zero, other store still pays', () => {
  assert.equal(sumStoreDeliveryFees([0, 25]), 25);
  assert.equal(sumStoreDeliveryFees([0, 0]), 0);
});

test('store-area fees add without a fixed 25 EGP fallback', () => {
  assert.equal(sumStoreDeliveryFees([10, 35]), 45);
  assert.equal(sumStoreDeliveryFees([5.25, 2.1]), 7.35);
});

test('unresolved fees must not be silently treated as zero', () => {
  assert.throws(() => sumStoreDeliveryFees([25, Number.NaN]));
  assert.throws(() => sumStoreDeliveryFees([-1]));
});
