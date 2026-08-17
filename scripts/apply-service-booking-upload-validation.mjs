import fs from 'node:fs';

const path =
  'src/services/service-booking-payment-proof-service.ts';

function replaceExactly(
  source,
  pattern,
  replacement,
  expectedCount,
  label,
) {
  const matches = source.match(pattern) ?? [];

  if (matches.length !== expectedCount) {
    throw new Error(
      `${label}: expected ${expectedCount} replacement(s), found ${matches.length}.`,
    );
  }

  return source.replace(pattern, replacement);
}

let source = fs.readFileSync(path, 'utf8');

source = replaceExactly(
  source,
  /^import \{ File \} from 'expo-file-system';\n/m,
  `import { File } from 'expo-file-system';\n\nimport {\n  PRIVATE_UPLOAD_MIME_TYPES,\n  PrivateUploadValidationError,\n  assertPrivateUploadContent,\n  assertPrivateUploadSize,\n  normalizePrivateUploadMimeType,\n  type PrivateUploadMimeType,\n} from '../domain/private-upload-validation';\n`,
  1,
  'imports',
);

source = replaceExactly(
  source,
  /\nconst MAX_PAYMENT_PROOF_FILE_SIZE =\n  8 \* 1024 \* 1024;\n\nconst ALLOWED_MIME_TYPES = \[\n  'image\/jpeg',\n  'image\/png',\n  'image\/webp',\n  'application\/pdf',\n\] as const;\n/,
  '',
  1,
  'legacy upload constants',
);

const helpers = `\nfunction getValidatedUploadMimeType(\n  value: string | null | undefined,\n): PrivateUploadMimeType {\n  try {\n    return normalizePrivateUploadMimeType(value);\n  } catch (error) {\n    if (\n      error instanceof PrivateUploadValidationError &&\n      error.code === 'unsupported_type'\n    ) {\n      throw new Error(\n        'اختر صورة لإثبات الدفع أو ملف PDF فقط.',\n      );\n    }\n\n    throw error;\n  }\n}\n\nfunction assertValidatedUploadSize(\n  size: number | null | undefined,\n): void {\n  try {\n    assertPrivateUploadSize(size);\n  } catch (error) {\n    if (error instanceof PrivateUploadValidationError) {\n      if (error.code === 'too_large') {\n        throw new Error(\n          'حجم إثبات الدفع أكبر من 8 ميجابايت.',\n        );\n      }\n\n      if (error.code === 'invalid_size') {\n        throw new Error(\n          'تعذر التحقق من حجم إثبات الدفع أو أن الملف فارغ.',\n        );\n      }\n    }\n\n    throw error;\n  }\n}\n\nfunction assertValidatedUploadContent(\n  mimeType: PrivateUploadMimeType,\n  buffer: ArrayBuffer,\n): void {\n  try {\n    assertPrivateUploadContent(\n      mimeType,\n      buffer,\n    );\n  } catch (error) {\n    if (error instanceof PrivateUploadValidationError) {\n      if (error.code === 'too_large') {\n        throw new Error(\n          'حجم إثبات الدفع أكبر من 8 ميجابايت.',\n        );\n      }\n\n      if (error.code === 'invalid_size') {\n        throw new Error(\n          'تعذر التحقق من حجم إثبات الدفع أو أن الملف فارغ.',\n        );\n      }\n\n      if (error.code === 'content_type_mismatch') {\n        throw new Error(\n          'محتوى ملف إثبات الدفع لا يطابق نوعه. اختر صورة JPEG أو PNG أو WebP أو ملف PDF صالح.',\n        );\n      }\n    }\n\n    throw error;\n  }\n}\n`;

source = replaceExactly(
  source,
  /\nfunction nullableString\(/,
  `${helpers}\nfunction nullableString(`,
  1,
  'validation helpers',
);

source = replaceExactly(
  source,
  /type: \[\.\.\.ALLOWED_MIME_TYPES\],/,
  'type: [...PRIVATE_UPLOAD_MIME_TYPES],',
  1,
  'picker types',
);

source = replaceExactly(
  source,
  /  const mimeType =\n    asset\.mimeType\?\.trim\(\)\n      \.toLowerCase\(\) \?\? '';\n\n  if \(\n    !ALLOWED_MIME_TYPES\.includes\(\n      mimeType as\n        \(typeof ALLOWED_MIME_TYPES\)\[number\],\n    \)\n  \) \{\n    throw new Error\(\n      'اختر صورة لإثبات الدفع أو ملف PDF فقط\.',\n    \);\n  \}\n\n  const file = new File\(asset\.uri\);\n  const fileSize =\n    asset\.size \?\? file\.size;\n\n  if \(\n    typeof fileSize === 'number' &&\n    fileSize > MAX_PAYMENT_PROOF_FILE_SIZE\n  \) \{\n    throw new Error\(\n      'حجم إثبات الدفع أكبر من 8 ميجابايت\.',\n    \);\n  \}/,
  `  const mimeType =\n    getValidatedUploadMimeType(\n      asset.mimeType,\n    );\n\n  const file = new File(asset.uri);\n  const fileSize =\n    asset.size ?? file.size;\n\n  assertValidatedUploadSize(\n    fileSize,\n  );`,
  1,
  'metadata validation',
);

source = replaceExactly(
  source,
  /  const fileBuffer =\n    await file\.arrayBuffer\(\);/,
  `  const fileBuffer =\n    await file.arrayBuffer();\n\n  assertValidatedUploadContent(\n    mimeType,\n    fileBuffer,\n  );`,
  1,
  'content validation',
);

fs.writeFileSync(path, source);
console.log('Applied service-booking private upload content validation.');
