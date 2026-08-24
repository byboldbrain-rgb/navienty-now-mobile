import assert from 'node:assert/strict';
import test from 'node:test';

import {
  containsV1RemovedScope,
  isV1PublicCategorySlug,
  isV1PublicPromotion,
} from '../src/config/v1-release-scope.ts';

test('v1 category scope allows public ordering categories', () => {
  for (const slug of [
    'restaurants',
    'supermarket',
    'bookstore',
    'laundry-services',
  ]) {
    assert.equal(
      isV1PublicCategorySlug(slug),
      true,
    );
  }
});

test('v1 category scope blocks removed category aliases', () => {
  for (const slug of [
    'pharmacy',
    'pharmacies',
    'drugstore',
    'medicines',
    'صيدليات',
  ]) {
    assert.equal(
      isV1PublicCategorySlug(slug),
      false,
    );
  }
});

test('v1 promotion scope rejects removed deep links and copy', () => {
  assert.equal(
    isV1PublicPromotion({
      route: '/category/pharmacy',
    }),
    false,
  );

  assert.equal(
    isV1PublicPromotion({
      title: 'ارفع الروشتة',
    }),
    false,
  );

  assert.equal(
    containsV1RemovedScope(
      'https%3A%2F%2Fexample.com%2Fpharmacies',
    ),
    true,
  );
});

test('v1 promotion scope keeps unrelated campaigns available', () => {
  assert.equal(
    isV1PublicPromotion({
      route: '/category/bookstore',
      title: 'خصم على الأدوات المكتبية',
    }),
    true,
  );
});
