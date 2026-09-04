from pathlib import Path

CHECKOUT_PATH = Path('src/app/checkout.tsx')


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(
            f'{label}: expected exactly one match, found {count}'
        )
    return source.replace(old, new, 1)


source = CHECKOUT_PATH.read_text(encoding='utf-8')

source = replace_once(
    source,
    """import {
  isV1PublicCategorySlug,
  V1_UNAVAILABLE_CATEGORY_MESSAGE,
} from '../config/v1-release-scope';
""",
    """import {
  isV1PublicCategorySlug,
  V1_UNAVAILABLE_CATEGORY_MESSAGE,
} from '../config/v1-release-scope';
import {
  calculatePaymentProcessingFee,
  getPaymentProcessingFeeLabelAr,
} from '../domain/payment-method';
""",
    'payment fee helper import',
)

source = replace_once(
    source,
    """const PAYMENT_PROCESSING_FEE = 10;
const SPIN_UNLOCK_SUBTOTAL_FALLBACK = 200;
""",
    """/*
 * Backward-compatibility only. New bootstrap responses provide the fee
 * configuration from now.payment_methods. This value is used only if an
 * older cached/backend contract does not expose those fields yet.
 */
const LEGACY_PAYMENT_PROCESSING_FEE_FALLBACK = 10;
const SPIN_UNLOCK_SUBTOTAL_FALLBACK = 200;
""",
    'legacy payment fee constant',
)

source = replace_once(
    source,
    """  const hasAgeRestrictedItems =
    items.some(
      (item) =>
        'isAgeRestricted' in item &&
        item.isAgeRestricted === true,
    );

  const subtotal =
""",
    """  const hasAgeRestrictedItems =
    items.some(
      (item) =>
        'isAgeRestricted' in item &&
        item.isAgeRestricted === true,
    );

  const paymentMethod =
    useCustomerStore(
      (state) =>
        state.paymentMethod,
    );

  const subtotal =
""",
    'early selected payment method subscription',
)

source = replace_once(
    source,
    """  const paymentProcessingFee =
    PAYMENT_PROCESSING_FEE;
""",
    """  const paymentFeeMethod =
    bootstrap?.payment_methods.find(
      (method) =>
        method.id ===
        paymentMethod,
    ) ?? null;

  const hasRemotePaymentFeeConfiguration =
    !!paymentFeeMethod &&
    typeof paymentFeeMethod
      .processing_fee_enabled ===
      'boolean' &&
    typeof paymentFeeMethod
      .processing_fee_charge_customer ===
      'boolean';

  const paymentProcessingFee =
    hasRemotePaymentFeeConfiguration
      ? calculatePaymentProcessingFee(
          paymentFeeMethod,
          subtotal,
        )
      : LEGACY_PAYMENT_PROCESSING_FEE_FALLBACK;

  const paymentProcessingFeeLabel =
    getPaymentProcessingFeeLabelAr(
      paymentFeeMethod,
    );
""",
    'dynamic payment fee calculation',
)

source = replace_once(
    source,
    """  const paymentMethod =
    useCustomerStore(
      (state) =>
        state.paymentMethod,
    );

  const setCustomerName =
""",
    """  const setCustomerName =
""",
    'remove duplicate payment method subscription',
)

source = replace_once(
    source,
    """            >
              رسوم الدفع الإلكتروني
            </Text>
""",
    """            >
              {paymentProcessingFeeLabel}
            </Text>
""",
    'dynamic payment fee label',
)

if 'const PAYMENT_PROCESSING_FEE = 10;' in source:
    raise RuntimeError('hardcoded checkout payment fee still exists')

if source.count('calculatePaymentProcessingFee(') != 1:
    raise RuntimeError('unexpected payment fee calculation count')

CHECKOUT_PATH.write_text(source, encoding='utf-8')
print('Checkout payment fee migration applied successfully.')
