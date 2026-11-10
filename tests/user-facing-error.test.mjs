import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getUserFacingCatalogError,
  isRetryablePublicQueryError,
} from '../src/lib/user-facing-error.ts';

test('never exposes technical backend errors to customers', () => {
  const raw = new Error('Loading store catalog failed: permission denied for relation catalog');
  const text = getUserFacingCatalogError(raw);
  assert.doesNotMatch(text, /permission denied|relation|catalog/i);
  assert.equal(isRetryablePublicQueryError(raw), false);
});

test('network failures use a friendly message and are retryable', () => {
  const raw = new Error('TypeError: Failed to fetch');
  assert.equal(isRetryablePublicQueryError(raw), true);
  assert.match(getUserFacingCatalogError(raw), /الإنترنت/);
});

test('known customer-safe business messages are preserved', () => {
  const message = 'لا يوجد سوبر ماركت متاح حاليًا.';
  assert.equal(getUserFacingCatalogError(new Error(message)), message);
});

test('arbitrary error strings do not reach the UI', () => {
  assert.doesNotMatch(getUserFacingCatalogError('SECRET_TOKEN=123'), /SECRET_TOKEN/);
});

test('iOS Expo fetch cancellation qualifies for automatic bootstrap retry', () => {
  const cancelled = new Error(
    'Supabase bootstrap failed: Error: fetch failed: ' +
    'FetchRequestCanceledException: Fetch request has been canceled',
  );

  assert.equal(isRetryablePublicQueryError(cancelled), true);
  assert.doesNotMatch(getUserFacingCatalogError(cancelled), /Supabase|FetchRequest/i);
});

test('backend authorization faults are not treated as transient', () => {
  const forbidden = new Error('Supabase bootstrap failed: permission denied for function get_app_bootstrap');
  assert.equal(isRetryablePublicQueryError(forbidden), false);
});
