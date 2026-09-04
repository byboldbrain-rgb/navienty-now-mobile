export type NumericPaymentValue =
  | number
  | string
  | null
  | undefined;

export type PaymentFeeConfiguration = {
  processing_fee_enabled?:
    | boolean
    | null;
  processing_fee_type?:
    | string
    | null;
  processing_fee_percentage?:
    NumericPaymentValue;
  processing_fee_fixed_amount?:
    NumericPaymentValue;
  processing_fee_min_amount?:
    NumericPaymentValue;
  processing_fee_max_amount?:
    NumericPaymentValue;
  processing_fee_charge_customer?:
    | boolean
    | null;
  processing_fee_label_ar?:
    | string
    | null;
};

const DEFAULT_PAYMENT_FEE_LABEL_AR =
  'رسوم الدفع الإلكتروني';

function toFiniteNumber(
  value: NumericPaymentValue,
  fallback = 0,
): number {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return fallback;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : fallback;
}

/**
 * PostgreSQL round(numeric, 2) rounds half values away from zero. Payment
 * fees are non-negative, so calculating cents first avoids the common JS
 * 4.975 -> 4.97 binary floating-point edge and matches the server result.
 */
function calculatePercentageFee(
  subtotal: number,
  percentage: number,
): number {
  const rawCents =
    subtotal * percentage;

  return Math.round(
    rawCents + 1e-9,
  ) / 100;
}

/**
 * Mirrors now.apply_order_payment_fee on the client so Cart/Checkout can
 * display the same processing fee that Supabase will persist on the order.
 * Supabase remains authoritative when the order is created.
 */
export function calculatePaymentProcessingFee(
  configuration:
    | PaymentFeeConfiguration
    | null
    | undefined,
  subtotal: NumericPaymentValue,
): number {
  if (
    !configuration?.processing_fee_enabled ||
    !configuration
      .processing_fee_charge_customer
  ) {
    return 0;
  }

  const normalizedSubtotal =
    Math.max(
      toFiniteNumber(subtotal, 0),
      0,
    );

  let fee = 0;

  switch (
    configuration.processing_fee_type
  ) {
    case 'fixed':
      fee = toFiniteNumber(
        configuration
          .processing_fee_fixed_amount,
        0,
      );
      break;

    case 'percentage':
      fee = calculatePercentageFee(
        normalizedSubtotal,
        toFiniteNumber(
          configuration
            .processing_fee_percentage,
          0,
        ),
      );
      break;

    default:
      fee = 0;
      break;
  }

  if (
    configuration
      .processing_fee_min_amount !== null &&
    configuration
      .processing_fee_min_amount !== undefined
  ) {
    fee = Math.max(
      fee,
      toFiniteNumber(
        configuration
          .processing_fee_min_amount,
        0,
      ),
    );
  }

  if (
    configuration
      .processing_fee_max_amount !== null &&
    configuration
      .processing_fee_max_amount !== undefined
  ) {
    fee = Math.min(
      fee,
      toFiniteNumber(
        configuration
          .processing_fee_max_amount,
        fee,
      ),
    );
  }

  return Math.max(
    fee,
    0,
  );
}

export function getPaymentProcessingFeeLabelAr(
  configuration:
    | PaymentFeeConfiguration
    | null
    | undefined,
): string {
  const label =
    configuration
      ?.processing_fee_label_ar
      ?.trim();

  return label ||
    DEFAULT_PAYMENT_FEE_LABEL_AR;
}
