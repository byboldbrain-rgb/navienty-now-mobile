export const MAX_PRIVATE_UPLOAD_FILE_SIZE =
  8 * 1024 * 1024;

export const PRIVATE_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type PrivateUploadMimeType =
  (typeof PRIVATE_UPLOAD_MIME_TYPES)[number];

export type PrivateUploadValidationCode =
  | 'unsupported_type'
  | 'invalid_size'
  | 'too_large'
  | 'content_type_mismatch';

export class PrivateUploadValidationError extends Error {
  readonly code: PrivateUploadValidationCode;

  constructor(code: PrivateUploadValidationCode) {
    super(code);
    this.name = 'PrivateUploadValidationError';
    this.code = code;
  }
}

export function normalizePrivateUploadMimeType(
  value: string | null | undefined,
): PrivateUploadMimeType {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (
    !PRIVATE_UPLOAD_MIME_TYPES.includes(
      normalized as PrivateUploadMimeType,
    )
  ) {
    throw new PrivateUploadValidationError(
      'unsupported_type',
    );
  }

  return normalized as PrivateUploadMimeType;
}

export function assertPrivateUploadSize(
  size: number | null | undefined,
): number {
  if (
    typeof size !== 'number' ||
    !Number.isFinite(size) ||
    size <= 0
  ) {
    throw new PrivateUploadValidationError(
      'invalid_size',
    );
  }

  if (size > MAX_PRIVATE_UPLOAD_FILE_SIZE) {
    throw new PrivateUploadValidationError(
      'too_large',
    );
  }

  return size;
}

function startsWithBytes(
  bytes: Uint8Array,
  signature: readonly number[],
): boolean {
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every(
    (value, index) => bytes[index] === value,
  );
}

function hasWebpSignature(
  bytes: Uint8Array,
): boolean {
  return (
    bytes.length >= 12 &&
    startsWithBytes(bytes, [
      0x52,
      0x49,
      0x46,
      0x46,
    ]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

export function assertPrivateUploadContent(
  mimeType: PrivateUploadMimeType,
  buffer: ArrayBuffer,
): void {
  assertPrivateUploadSize(buffer.byteLength);

  const bytes = new Uint8Array(buffer);

  const matches =
    mimeType === 'image/jpeg'
      ? startsWithBytes(bytes, [
          0xff,
          0xd8,
          0xff,
        ])
      : mimeType === 'image/png'
        ? startsWithBytes(bytes, [
            0x89,
            0x50,
            0x4e,
            0x47,
            0x0d,
            0x0a,
            0x1a,
            0x0a,
          ])
        : mimeType === 'image/webp'
          ? hasWebpSignature(bytes)
          : startsWithBytes(bytes, [
              0x25,
              0x50,
              0x44,
              0x46,
              0x2d,
            ]);

  if (!matches) {
    throw new PrivateUploadValidationError(
      'content_type_mismatch',
    );
  }
}
