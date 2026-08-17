import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareVersions,
  isVersionBelowMinimum,
} from '../src/domain/app-version.ts';

test('compareVersions handles equal and missing patch components', () => {
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.2', '1.2.0'), 0);
  assert.equal(compareVersions('2', '2.0.0'), 0);
});

test('compareVersions orders semantic numeric components', () => {
  assert.equal(compareVersions('1.9.9', '1.10.0'), -1);
  assert.equal(compareVersions('2.0.0', '1.99.99'), 1);
  assert.equal(compareVersions('1.0.10', '1.0.2'), 1);
});

test('compareVersions accepts v prefix and ignores prerelease/build suffixes', () => {
  assert.equal(compareVersions('v1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions('1.2.3-beta.1', '1.2.3'), 0);
  assert.equal(compareVersions('1.2.3+45', '1.2.3'), 0);
});

test('compareVersions rejects malformed versions', () => {
  assert.equal(compareVersions('1.x.0', '1.0.0'), null);
  assert.equal(compareVersions('', '1.0.0'), null);
  assert.equal(compareVersions('1..0', '1.0.0'), null);
});

test('isVersionBelowMinimum only blocks genuinely older valid versions', () => {
  assert.equal(isVersionBelowMinimum('1.0.0', '1.0.1'), true);
  assert.equal(isVersionBelowMinimum('1.0.1', '1.0.1'), false);
  assert.equal(isVersionBelowMinimum('1.1.0', '1.0.9'), false);
  assert.equal(isVersionBelowMinimum(null, '1.0.0'), false);
  assert.equal(isVersionBelowMinimum('invalid', '1.0.0'), false);
});
