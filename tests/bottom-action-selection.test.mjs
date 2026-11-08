import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeBottomActionPath,
  selectActiveBottomAction,
} from '../src/components/cart/bottom-action-selection.ts';

test('purchase action overrides a cart summary registered on the same screen', () => {
  const entries = [
    { pathname: '/supermarket-product/abc', priority: 100, kind: 'cart-summary' },
    { pathname: '/supermarket-product/abc', priority: 300, kind: 'product-purchase' },
  ];

  assert.equal(
    selectActiveBottomAction(entries, '/supermarket-product/abc')?.kind,
    'product-purchase',
  );
});

test('registering nothing for the next screen cannot surface the previous dock', () => {
  const entries = [
    { pathname: '/supermarket-product/abc', priority: 300, kind: 'product-purchase' },
  ];

  assert.equal(selectActiveBottomAction(entries, '/checkout'), null);
});

test('a no-action registration explicitly blocks fallback controls', () => {
  const entries = [{ pathname: '/checkout', priority: 500, kind: 'none' }];
  assert.equal(selectActiveBottomAction(entries, '/checkout')?.kind, 'none');
});

test('newer registration wins when priority is equal', () => {
  const entries = [
    { pathname: '/store/1', priority: 100, kind: 'cart-summary', version: 1 },
    { pathname: '/store/1', priority: 100, kind: 'cart-summary', version: 2 },
  ];

  assert.equal(selectActiveBottomAction(entries, '/store/1')?.version, 2);
});

test('no action routes and trailing slashes normalize consistently', () => {
  assert.equal(normalizeBottomActionPath('/store/1///'), '/store/1');
  assert.equal(normalizeBottomActionPath(null), '/');
  assert.equal(
    selectActiveBottomAction([{ pathname: '/', priority: 100, kind: 'none' }], '/')?.kind,
    'none',
  );
});
