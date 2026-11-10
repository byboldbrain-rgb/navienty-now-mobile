import assert from 'node:assert/strict';
import test from 'node:test';
import { getSingleCheckoutDeliveryFee, sumStoreDeliveryFees } from '../src/domain/store-delivery-pricing.ts';

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


test('one global checkout charges delivery only once for two paid stores', () => {
  assert.equal(getSingleCheckoutDeliveryFee([25, 25]), 25);
  assert.equal(getSingleCheckoutDeliveryFee([25, 35]), 35);
  assert.equal(getSingleCheckoutDeliveryFee([35, 10]), 35);
});

test('global checkout preserves free delivery and single store pricing', () => {
  assert.equal(getSingleCheckoutDeliveryFee([0, 25]), 25);
  assert.equal(getSingleCheckoutDeliveryFee([0, 0]), 0);
  assert.equal(getSingleCheckoutDeliveryFee([10]), 10);
  assert.equal(getSingleCheckoutDeliveryFee([5.25, 2.1]), 5.25);
  assert.equal(getSingleCheckoutDeliveryFee([]), 0);
});

test('global checkout refuses invalid fee quotes', () => {
  assert.throws(() => getSingleCheckoutDeliveryFee([25, Number.NaN]));
  assert.throws(() => getSingleCheckoutDeliveryFee([25, -1]));
});
