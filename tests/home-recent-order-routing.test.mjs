import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRecentOrderCategory,
} from '../src/features/home/recent-order-routing.ts';

const order = (storeName) => ({ storeName });
const store = (name, categorySlug) => ({ name, categorySlug });

test('Navienty Market order navigates to supermarket category', () => {
  assert.equal(
    getRecentOrderCategory(order('ماركت ناڤينتي'), null),
    'supermarket',
  );
  assert.equal(
    getRecentOrderCategory(order('Navienty Market'), store('Navienty Market', 'supermarket')),
    'supermarket',
  );
});

test('Bookstore and care orders navigate to their category screens', () => {
  assert.equal(
    getRecentOrderCategory(order('مكتبة ناڤينتي'), null),
    'bookstore',
  );
  assert.equal(
    getRecentOrderCategory(order('عناية ناڤينتي'), null),
    'personal-care',
  );
  assert.equal(
    getRecentOrderCategory(order('عناية'), store('Navienty Care', 'personal-care')),
    'personal-care',
  );
});

test('Request anything never qualifies for the repeat-order rail', () => {
  assert.equal(getRecentOrderCategory(order('اطلب أي حاجة'), null), 'request-anything');
  assert.equal(getRecentOrderCategory(order('اطلب اي حاجه'), null), 'request-anything');
  assert.equal(
    getRecentOrderCategory(order('خدمة'), store('الخدمة', 'request-anything')),
    'request-anything',
  );
});

test('Regular restaurant and other stores keep normal store navigation', () => {
  assert.equal(
    getRecentOrderCategory(order('بيتزا ريسو'), store('بيتزا ريسو', 'restaurants')),
    null,
  );
  assert.equal(
    getRecentOrderCategory(order('مغسلة ناڤينتي'), store('مغسلة ناڤينتي', 'laundry')),
    null,
  );
});
