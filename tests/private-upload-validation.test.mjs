import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_PRIVATE_UPLOAD_FILE_SIZE,
  PrivateUploadValidationError,
  assertPrivateUploadContent,
  assertPrivateUploadSize,
  normalizePrivateUploadMimeType,
} from '../src/domain/private-upload-validation.ts';

function buffer(bytes) {
  return Uint8Array.from(bytes).buffer;
}

function assertCode(fn, code) {
  assert.throws(
    fn,
    (error) =>
      error instanceof PrivateUploadValidationError &&
      error.code === code,
  );
}

test('normalizes supported private upload MIME types', () => {
  assert.equal(
    normalizePrivateUploadMimeType(' IMAGE/PNG '),
    'image/png',
  );

  assertCode(
    () => normalizePrivateUploadMimeType('image/svg+xml'),
    'unsupported_type',
  );
});

test('rejects unknown, empty, and oversized file sizes', () => {
  assert.equal(assertPrivateUploadSize(1), 1);
  assert.equal(
    assertPrivateUploadSize(MAX_PRIVATE_UPLOAD_FILE_SIZE),
    MAX_PRIVATE_UPLOAD_FILE_SIZE,
  );

  for (const value of [undefined, null, 0, -1, Number.NaN]) {
    assertCode(
      () => assertPrivateUploadSize(value),
      'invalid_size',
    );
  }

  assertCode(
    () =>
      assertPrivateUploadSize(
        MAX_PRIVATE_UPLOAD_FILE_SIZE + 1,
      ),
    'too_large',
  );
});

test('accepts matching JPEG, PNG, WebP, and PDF signatures', () => {
  assert.doesNotThrow(() =>
    assertPrivateUploadContent(
      'image/jpeg',
      buffer([0xff, 0xd8, 0xff, 0xe0]),
    ),
  );

  assert.doesNotThrow(() =>
    assertPrivateUploadContent(
      'image/png',
      buffer([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ]),
    ),
  );

  assert.doesNotThrow(() =>
    assertPrivateUploadContent(
      'image/webp',
      buffer([
        0x52,
        0x49,
        0x46,
        0x46,
        0x04,
        0x00,
        0x00,
        0x00,
        0x57,
        0x45,
        0x42,
        0x50,
      ]),
    ),
  );

  assert.doesNotThrow(() =>
    assertPrivateUploadContent(
      'application/pdf',
      buffer([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]),
    ),
  );
});

test('rejects spoofed MIME type even when the declared type is allowed', () => {
  const pdfBytes = buffer([
    0x25,
    0x50,
    0x44,
    0x46,
    0x2d,
    0x31,
  ]);

  assertCode(
    () =>
      assertPrivateUploadContent(
        'image/jpeg',
        pdfBytes,
      ),
    'content_type_mismatch',
  );
});

test('rejects empty content before signature validation', () => {
  assertCode(
    () =>
      assertPrivateUploadContent(
        'application/pdf',
        new ArrayBuffer(0),
      ),
    'invalid_size',
  );
});
