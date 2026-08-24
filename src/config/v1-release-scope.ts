const V1_REMOVED_SCOPE_MARKERS = [
  'pharmacy',
  'pharmacies',
  'drugstore',
  'drugstores',
  'prescription',
  'prescriptions',
  'medicine',
  'medicines',
  'صيدلية',
  'صيدليات',
  'روشتة',
  'روشتات',
  'دواء',
  'أدوية',
  'وصفة طبية',
  'وصفات طبية',
] as const;

export const V1_UNAVAILABLE_CATEGORY_MESSAGE =
  'هذا القسم غير متاح في الإصدار الحالي.';

function normalizeScopeText(
  value: string,
): string {
  let decodedValue = value;

  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    // Keep the original text when a URL contains malformed escaping.
  }

  return decodedValue
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function containsV1RemovedScope(
  value: unknown,
): boolean {
  if (typeof value === 'string') {
    const normalizedValue =
      normalizeScopeText(value);

    return V1_REMOVED_SCOPE_MARKERS.some(
      (marker) =>
        normalizedValue.includes(marker),
    );
  }

  if (Array.isArray(value)) {
    return value.some(
      containsV1RemovedScope,
    );
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    return Object.values(value).some(
      containsV1RemovedScope,
    );
  }

  return false;
}

export function isV1PublicCategorySlug(
  value: string | null | undefined,
): boolean {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    return false;
  }

  return !containsV1RemovedScope(value);
}

export function isV1PublicPromotion(
  value: unknown,
): boolean {
  return !containsV1RemovedScope(value);
}
