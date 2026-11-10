import assert from 'node:assert/strict';
import test from 'node:test';

import { getSearchScopeForCategorySlug } from '../src/config/search-scopes.ts';
import { isSearchResultVisible } from '../src/components/search/search-result-visibility.ts';

const noDownloadedCategories = new Map();

function product(categorySlug, sectionId = 'active-section') {
  return {
    id: 'product:store:123',
    kind: 'product',
    productId: '123',
    storeId: 'store',
    sectionId,
    sectionSlug: 'category',
    storeCategorySlug: categorySlug,
    title: 'Test Product',
  };
}

function visible(result, activeScope, categories = noDownloadedCategories) {
  return isSearchResultVisible(
    result, activeScope, categories, getSearchScopeForCategorySlug,
  );
}

test('bookstore products appear without downloading full active-category index', () => {
  assert.equal(visible(product('bookstores'), 'bookstore'), true);
  assert.equal(visible(product('bookstore'), 'bookstore'), true);
});

test('personal-care products appear without downloading full active-category index', () => {
  assert.equal(visible(product('personal-care'), 'personal-care'), true);
  assert.equal(visible(product('personalcare'), 'personal-care'), true);
});

test('supermarket product search retains existing fast-path behavior', () => {
  assert.equal(visible(product('supermarket'), 'supermarket'), true);
});

test('shop-specific searches never leak results from other shops', () => {
  assert.equal(visible(product('personal-care'), 'bookstore'), false);
  assert.equal(visible(product('bookstores'), 'personal-care'), false);
  assert.equal(visible(product('supermarket'), 'bookstore'), false);
});

test('legacy non-shopping search still excludes inactive category products', () => {
  const restaurantProduct = product('restaurants');
  assert.equal(visible(restaurantProduct, 'restaurants'), false);
  const categoryIndex = new Map([['store', new Set(['active-section'])]]);
  assert.equal(visible(restaurantProduct, 'restaurants', categoryIndex), true);
  assert.equal(visible(product('restaurants', 'inactive-section'), 'restaurants', categoryIndex), false);
});

test('category discovery still excludes inactive categories', () => {
  const category = {
    kind: 'category',
    storeId: 'store',
    storeCategorySlug: 'bookstores',
    sectionId: 'category-1',
  };
  assert.equal(visible(category, 'bookstore'), false);
  assert.equal(visible(category, 'bookstore', new Map([['store', new Set(['category-1'])]])), true);
});

test('store results remain scoped but do not require catalog category metadata', () => {
  const store = { kind: 'store', storeId: 'store', storeCategorySlug: 'bookstores' };
  assert.equal(visible(store, 'bookstore'), true);
  assert.equal(visible(store, 'personal-care'), false);
});
