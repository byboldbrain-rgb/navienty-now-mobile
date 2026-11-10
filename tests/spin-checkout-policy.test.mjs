import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAvailableCrossStoreSpin,
  canApplyCheckoutSpin,
  shouldAttachCheckoutSpinEvent,
} from '../src/domain/spin-checkout-policy.ts';

test('available next-order Spin reward works across stores', () => {
  assert.equal(isAvailableCrossStoreSpin('next_order_discount', 'available'), true);
  assert.equal(canApplyCheckoutSpin({
    eventIssued: true,
    sameStore: false,
    immediateReward: false,
    unlockReached: false,
    eligibleNextOrderReward: true,
  }), true);
  assert.equal(shouldAttachCheckoutSpinEvent({
    eventIssued: true,
    sameStore: false,
    eligibleNextOrderReward: true,
  }), true);
});

test('pending future reward cannot be consumed from another store', () => {
  assert.equal(isAvailableCrossStoreSpin('next_order_discount', 'pending'), false);
  assert.equal(canApplyCheckoutSpin({
    eventIssued: true,
    sameStore: false,
    immediateReward: false,
    unlockReached: true,
    eligibleNextOrderReward: false,
  }), false);
  assert.equal(shouldAttachCheckoutSpinEvent({
    eventIssued: true,
    sameStore: false,
    eligibleNextOrderReward: false,
  }), false);
});

test('immediate Spin reward remains scoped to originating store', () => {
  assert.equal(isAvailableCrossStoreSpin('current_order_discount', 'available'), false);
  assert.equal(canApplyCheckoutSpin({
    eventIssued: true,
    sameStore: false,
    immediateReward: true,
    unlockReached: true,
    eligibleNextOrderReward: false,
  }), false);
  assert.equal(canApplyCheckoutSpin({
    eventIssued: true,
    sameStore: true,
    immediateReward: true,
    unlockReached: true,
    eligibleNextOrderReward: false,
  }), true);
});

test('not-yet-unlocked immediate and consumed rewards are not applied', () => {
  assert.equal(canApplyCheckoutSpin({
    eventIssued: true,
    sameStore: true,
    immediateReward: true,
    unlockReached: false,
    eligibleNextOrderReward: false,
  }), false);
  assert.equal(canApplyCheckoutSpin({
    eventIssued: false,
    sameStore: true,
    immediateReward: true,
    unlockReached: true,
    eligibleNextOrderReward: false,
  }), false);
  assert.equal(shouldAttachCheckoutSpinEvent({
    eventIssued: false,
    sameStore: true,
    eligibleNextOrderReward: true,
  }), false);
});
