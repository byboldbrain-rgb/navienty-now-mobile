from pathlib import Path

CART_PATH = Path('src/app/cart-details.tsx')


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(
            f'{label}: expected exactly one match, found {count}'
        )
    return source.replace(old, new, 1)


source = CART_PATH.read_text(encoding='utf-8')

source = replace_once(
    source,
    """import {
    supabase
} from '../lib/supabase';
import {
    type CatalogProduct,
    type StoreCatalog,
    getStoreCatalog,
} from '../services/catalog-service';
""",
    """import {
    supabase
} from '../lib/supabase';
import {
    calculatePaymentProcessingFee,
} from '../domain/payment-method';
import getAppBootstrap, {
    type PaymentMethod,
} from '../services/bootstrap-service';
import {
    type CatalogProduct,
    type StoreCatalog,
    getStoreCatalog,
} from '../services/catalog-service';
""",
    'payment configuration imports',
)

source = replace_once(
    source,
    """/**
 * Electronic payment fee remains fixed for now.
 * Delivery fee is store/area-specific and comes from the cart/catalog.
 */
const FIXED_PAYMENT_PROCESSING_FEE = 10;
""",
    """/**
 * Backward-compatibility only. Current bootstrap responses expose the
 * payment-method fee configuration from Supabase. This keeps old cached or
 * mixed-version clients on the existing 10 EGP preview if that configuration
 * is temporarily unavailable, without blocking the Cart screen.
 */
const LEGACY_PAYMENT_PROCESSING_FEE_FALLBACK = 10;
""",
    'legacy payment fee constant',
)

source = replace_once(
    source,
    """  const [
    catalog,
    setCatalog,
  ] = useState<StoreCatalog | null>(null);

  const [
    failedImages,
""",
    """  const [
    catalog,
    setCatalog,
  ] = useState<StoreCatalog | null>(null);

  const [
    paymentMethods,
    setPaymentMethods,
  ] = useState<PaymentMethod[]>([]);

  const [
    failedImages,
""",
    'payment methods state',
)

source = replace_once(
    source,
    """  const phoneNumber =
    useCustomerStore(
      (state) => state.phoneNumber,
    );

  const normalizedPhone =
""",
    """  const phoneNumber =
    useCustomerStore(
      (state) => state.phoneNumber,
    );

  const paymentMethod =
    useCustomerStore(
      (state) => state.paymentMethod,
    );

  const normalizedPhone =
""",
    'selected payment method subscription',
)

source = replace_once(
    source,
    """  const minimumOrder =
    currentCart?.minimumOrder ?? 0;

  useEffect(() => {
    let cancelled = false;

    async function loadSpinStatus() {
""",
    """  const minimumOrder =
    currentCart?.minimumOrder ?? 0;

  /*
   * Payment configuration is a non-blocking Cart enhancement. Checkout and
   * Supabase remain authoritative. If bootstrap cannot be refreshed here,
   * Cart keeps the legacy fee preview rather than becoming unavailable.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadPaymentConfiguration() {
      try {
        const bootstrap =
          await getAppBootstrap();

        if (cancelled) {
          return;
        }

        setPaymentMethods(
          Array.isArray(
            bootstrap.payment_methods,
          )
            ? bootstrap.payment_methods
            : [],
        );
      } catch {
        if (!cancelled) {
          setPaymentMethods([]);
        }
      }
    }

    void loadPaymentConfiguration();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSpinStatus() {
""",
    'non-blocking bootstrap payment config effect',
)

source = replace_once(
    source,
    """  const paymentProcessingFee =
    FIXED_PAYMENT_PROCESSING_FEE;

  const deliveryFee =
""",
    """  const paymentFeeMethod =
    paymentMethods.find(
      (method) =>
        method.id === paymentMethod,
    ) ??
    paymentMethods[0] ??
    null;

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

  const deliveryFee =
""",
    'dynamic cart payment fee calculation',
)

source = replace_once(
    source,
    """  const spinProcessingFeeDiscount =
    !spinRewardPaused &&
    spinReward?.type ===
      'processing_fee_waiver'
      ? Math.min(
          Math.max(
            Number(spinReward.value ?? 0),
            0,
          ),
          paymentProcessingFee,
        )
      : 0;

  const effectivePaymentProcessingFee =
""",
    """  const spinProcessingFeeDiscount =
    !spinRewardPaused &&
    spinReward?.type ===
      'processing_fee_waiver'
      ? Math.min(
          Math.max(
            Number(spinReward.value ?? 0),
            0,
          ),
          paymentProcessingFee,
        )
      : 0;

  const spinProcessingFeeRewardDisplayValue =
    spinReward?.type ===
      'processing_fee_waiver'
      ? Math.min(
          Math.max(
            Number(spinReward.value ?? 0),
            0,
          ),
          paymentProcessingFee,
        )
      : 0;

  const effectivePaymentProcessingFee =
""",
    'dynamic spin fee reward display value',
)

source = replace_once(
    source,
    """    if (
      spinReward.type ===
      'processing_fee_waiver'
    ) {
      return '10ج';
    }
""",
    """    if (
      spinReward.type ===
      'processing_fee_waiver'
    ) {
      return `${formatSummaryAmount(
        spinProcessingFeeRewardDisplayValue,
      )}ج`;
    }
""",
    'spin result hero fee value',
)

source = replace_once(
    source,
    """                  {spinReward?.type ===
                  'processing_fee_waiver'
                    ? '10'
                    : String(
                        spinReward?.value ??
                          0,
                      )}
""",
    """                  {spinReward?.type ===
                  'processing_fee_waiver'
                    ? formatSummaryAmount(
                        spinProcessingFeeRewardDisplayValue,
                      )
                    : String(
                        spinReward?.value ??
                          0,
                      )}
""",
    'spin reward card fee value',
)

if 'const FIXED_PAYMENT_PROCESSING_FEE = 10;' in source:
    raise RuntimeError('hardcoded cart payment fee still exists')

if source.count('calculatePaymentProcessingFee(') != 1:
    raise RuntimeError('unexpected cart payment fee calculation count')

if "return '10ج';" in source:
    raise RuntimeError('hardcoded spin processing fee hero still exists')

CART_PATH.write_text(source, encoding='utf-8')
print('Cart payment fee migration applied successfully.')
