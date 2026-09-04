export type OrderIdempotencyItem = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type OrderIdempotencyInput = {
  storeId: string;
  serviceAreaId?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  paymentMethodId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  landmark: string;
  notes: string;
  voucherCode?: string | null;
  spinEventId?: string | null;
  items: OrderIdempotencyItem[];
};

function normalizeText(
  value: string | null | undefined,
): string {
  return String(value ?? '').trim();
}

function normalizePhone(
  value: string | null | undefined,
): string {
  return normalizeText(value).replace(
    /[^0-9+]/g,
    '',
  );
}

function normalizeNullableId(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0
    ? normalized
    : null;
}

function normalizeCoordinate(
  value: number | null | undefined,
): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value)
    ? value
    : null;
}

function hashFingerprintSource(
  value: string,
): string {
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    hashA ^= code;
    hashA = Math.imul(hashA, 0x01000193);

    hashB ^= code + index;
    hashB = Math.imul(hashB, 0x85ebca6b);
  }

  return [hashA, hashB]
    .map((hash) =>
      (hash >>> 0)
        .toString(16)
        .padStart(8, '0'),
    )
    .join('');
}

/**
 * Produces a stable, non-PII fingerprint for one logical checkout request.
 *
 * The fingerprint deliberately ignores cart item ordering while preserving
 * product, variant, quantity, customer, delivery, payment, voucher and Spin
 * semantics. It is used only to decide whether a retry should reuse the same
 * client_request_id; it is not an authentication or authorization token.
 */
export function getOrderRequestFingerprint(
  input: OrderIdempotencyInput,
): string {
  const normalizedItems = input.items
    .map((item) => ({
      productId: normalizeText(
        item.productId,
      ),
      variantId: normalizeNullableId(
        item.variantId,
      ),
      quantity: Number.isFinite(
        item.quantity,
      )
        ? Math.trunc(item.quantity)
        : 0,
    }))
    .sort((left, right) => {
      const leftKey = `${left.productId}|${left.variantId ?? ''}|${left.quantity}`;
      const rightKey = `${right.productId}|${right.variantId ?? ''}|${right.quantity}`;
      return leftKey.localeCompare(rightKey);
    });

  const source = JSON.stringify({
    storeId: normalizeText(input.storeId),
    serviceAreaId: normalizeNullableId(
      input.serviceAreaId,
    ),
    deliveryLatitude: normalizeCoordinate(
      input.deliveryLatitude,
    ),
    deliveryLongitude: normalizeCoordinate(
      input.deliveryLongitude,
    ),
    paymentMethodId: normalizeText(
      input.paymentMethodId,
    ),
    customerName: normalizeText(
      input.customerName,
    ),
    customerPhone: normalizePhone(
      input.customerPhone,
    ),
    address: normalizeText(input.address),
    landmark: normalizeText(input.landmark),
    notes: normalizeText(input.notes),
    voucherCode:
      normalizeText(
        input.voucherCode,
      ).toUpperCase(),
    spinEventId: normalizeNullableId(
      input.spinEventId,
    ),
    items: normalizedItems,
  });

  return hashFingerprintSource(source);
}

/**
 * Generates an RFC-4122-shaped v4 UUID suitable as an idempotency key.
 * The value is not a secret; server authorization must never depend on it.
 */
export function createClientRequestId(
  random: () => number = Math.random,
): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (character) => {
      const randomValue = Math.floor(
        random() * 16,
      );

      const value =
        character === 'x'
          ? randomValue
          : (randomValue & 0x3) | 0x8;

      return value.toString(16);
    },
  );
}
