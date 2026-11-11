import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getManagedCategoryRoute,
  getManagedDiscoveryRoute,
} from '../src/features/home/home-managed-category-routing.ts';

test('repeat orders for managed stores open the actual top-level screens', () => {
  assert.equal(getManagedCategoryRoute('supermarket'), '/category/supermarket');
  assert.equal(getManagedCategoryRoute('bookstore'), '/category/bookstore');
  assert.equal(getManagedCategoryRoute('personal-care'), '/category/personal-care');
});

test('discovery items open managed category home pages, not old subcategory screens', () => {
  assert.equal(getManagedDiscoveryRoute('supermarket-category'), '/category/supermarket');
  assert.equal(getManagedDiscoveryRoute('bookstore-category'), '/category/bookstore');
  assert.equal(getManagedDiscoveryRoute('personal-care-category'), '/category/personal-care');
});

test('unrelated pages keep their existing navigation', () => {
  assert.equal(getManagedCategoryRoute('restaurants'), null);
  assert.equal(getManagedCategoryRoute('request-anything'), null);
  assert.equal(getManagedCategoryRoute('laundry'), null);
  assert.equal(getManagedDiscoveryRoute('restaurant-cuisine'), null);
});
