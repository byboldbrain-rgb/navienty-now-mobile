import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRecentOrderCategory,
  getOrderArtworkCategory,
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

test('image category resolves all five services using names or store categories', () => {
  const cases = [
    ['بيتزا ريسو', 'restaurants', 'restaurants'],
    ['ماركت ناڤينتي', 'supermarket', 'supermarket'],
    ['مكتبة ناڤينتي', 'bookstore', 'bookstore'],
    ['عناية ناڤينتي', 'personal-care', 'personal-care'],
    ['اطلب أي حاجة', 'request-anything', 'request-anything'],
  ];

  for (const [name, slug, expected] of cases) {
    assert.equal(
      getOrderArtworkCategory(order(name), store(name, slug)),
      expected,
    );
  }

  assert.equal(
    getOrderArtworkCategory(order('مكتبة ناڤينتي'), null),
    'bookstore',
  );
  assert.equal(
    getOrderArtworkCategory(order('عناية ناڤينتي'), null),
    'personal-care',
  );
  assert.equal(
    getOrderArtworkCategory(order('بيتزا ريسو'), null),
    null,
  );
  assert.equal(
    getOrderArtworkCategory(order('مغسلة ناڤينتي'), store('مغسلة ناڤينتي', 'laundry')),
    null,
  );
});
