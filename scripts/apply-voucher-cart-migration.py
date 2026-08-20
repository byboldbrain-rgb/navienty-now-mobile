from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CART = ROOT / 'src/app/cart.tsx'
CHECKOUT = ROOT / 'src/app/checkout.tsx'
VOUCHER_STORE = ROOT / 'src/store/voucher-store.ts'
WORKFLOW = ROOT / '.github/workflows/apply-voucher-cart.yml'
SELF = Path(__file__).resolve()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Could not find expected block: {label}')
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------
# Shared voucher state: Cart owns voucher UI, Checkout consumes the quote.
# ---------------------------------------------------------------------
VOUCHER_STORE.parent.mkdir(parents=True, exist_ok=True)
VOUCHER_STORE.write_text(
    '''import { create } from 'zustand';

import type {
  VoucherQuote,
} from '../services/voucher-service';

type VoucherState = {
  vouchers: Record<
    string,
    VoucherQuote
  >;

  setVoucher: (
    storeId: string,
    voucher: VoucherQuote | null,
  ) => void;

  clearVoucher: (
    storeId: string,
  ) => void;

  clearAllVouchers: () => void;
};

/**
 * Voucher quotes intentionally stay in memory only.
 *
 * Eligibility, limits, delivery fees and expiry can change at any time,
 * so Checkout revalidates the quote against Supabase whenever the cart
 * subtotal or resolved delivery fee differs from the applied snapshot.
 */
export const useVoucherStore =
  create<VoucherState>((set) => ({
    vouchers: {},

    setVoucher: (
      storeId,
      voucher,
    ) => {
      const normalizedStoreId =
        storeId.trim();

      if (!normalizedStoreId) {
        return;
      }

      set((state) => {
        const nextVouchers = {
          ...state.vouchers,
        };

        if (voucher) {
          nextVouchers[
            normalizedStoreId
          ] = voucher;
        } else {
          delete nextVouchers[
            normalizedStoreId
          ];
        }

        return {
          vouchers: nextVouchers,
        };
      });
    },

    clearVoucher: (
      storeId,
    ) => {
      const normalizedStoreId =
        storeId.trim();

      if (!normalizedStoreId) {
        return;
      }

      set((state) => {
        if (
          !state.vouchers[
            normalizedStoreId
          ]
        ) {
          return state;
        }

        const nextVouchers = {
          ...state.vouchers,
        };

        delete nextVouchers[
          normalizedStoreId
        ];

        return {
          vouchers: nextVouchers,
        };
      });
    },

    clearAllVouchers: () => {
      set({ vouchers: {} });
    },
  }));
''',
    encoding='utf-8',
)


# ---------------------------------------------------------------------
# CART
# ---------------------------------------------------------------------
cart = CART.read_text(encoding='utf-8')

cart = replace_once(
    cart,
    """import {\n  useCartStore,\n} from '../store/cart-store';\n\nimport ServicePackageCart from '../components/service/service-package-cart';\n""",
    """import VoucherCheckoutCard from '../components/checkout/voucher-checkout-card';\nimport ServicePackageCart from '../components/service/service-package-cart';\nimport {\n  useCartStore,\n} from '../store/cart-store';\nimport {\n  useCustomerStore,\n} from '../store/customer-store';\nimport {\n  useVoucherStore,\n} from '../store/voucher-store';\n""",
    'cart imports',
)

cart = replace_once(
    cart,
    """  const storeId =\n    currentCart?.storeId ?? null;\n\n  const storeName =\n""",
    """  const storeId =\n    currentCart?.storeId ?? null;\n\n  const phoneNumber =\n    useCustomerStore(\n      (state) => state.phoneNumber,\n    );\n\n  const normalizedPhone =\n    phoneNumber.replace(\n      /\\D/g,\n      '',\n    );\n\n  const appliedVoucher =\n    useVoucherStore(\n      (state) =>\n        storeId\n          ? state.vouchers[storeId] ??\n            null\n          : null,\n    );\n\n  const setStoreVoucher =\n    useVoucherStore(\n      (state) => state.setVoucher,\n    );\n\n  const clearVoucher =\n    useVoucherStore(\n      (state) => state.clearVoucher,\n    );\n\n  const storeName =\n""",
    'cart voucher hooks',
)

cart = replace_once(
    cart,
    """  const deliveryFee =\n    Number(currentCart?.deliveryFee ?? 0);\n\n  const grandTotal =\n    Number(subtotal ?? 0) +\n    deliveryFee +\n    paymentProcessingFee;\n""",
    """  const deliveryFee =\n    Number(currentCart?.deliveryFee ?? 0);\n\n  const voucherDiscountTarget =\n    appliedVoucher?.discountTarget ??\n    'order_subtotal';\n\n  const voucherDiscountBase =\n    voucherDiscountTarget ===\n      'delivery_fee'\n      ? deliveryFee\n      : Number(subtotal ?? 0);\n\n  const voucherDiscount =\n    Math.min(\n      Math.max(\n        appliedVoucher\n          ?.discountAmount ?? 0,\n        0,\n      ),\n      Math.max(\n        Number(\n          voucherDiscountBase ?? 0,\n        ),\n        0,\n      ),\n    );\n\n  const discountedSubtotal =\n    Math.max(\n      Number(subtotal ?? 0) -\n        (\n          voucherDiscountTarget ===\n            'order_subtotal'\n            ? voucherDiscount\n            : 0\n        ),\n      0,\n    );\n\n  const discountedDeliveryFee =\n    Math.max(\n      deliveryFee -\n        (\n          voucherDiscountTarget ===\n            'delivery_fee'\n            ? voucherDiscount\n            : 0\n        ),\n      0,\n    );\n\n  const grandTotal =\n    discountedSubtotal +\n    discountedDeliveryFee +\n    paymentProcessingFee;\n""",
    'cart discount totals',
)

cart = replace_once(
    cart,
    """    clearStoreCart(storeId);\n\n    setClearModalVisible(false);\n""",
    """    clearVoucher(storeId);\n    clearStoreCart(storeId);\n\n    setClearModalVisible(false);\n""",
    'cart clear voucher',
)

cart = replace_once(
    cart,
    """        {/* ORDER DETAILS */}\n\n        <View\n""",
    """        {/* VOUCHER */}\n\n        <VoucherCheckoutCard\n          storeId={storeId}\n          subtotal={subtotal}\n          deliveryFee={deliveryFee}\n          customerPhone={\n            normalizedPhone\n          }\n          currencyCode=\"EGP\"\n          value={\n            appliedVoucher\n          }\n          onChange={(voucher) => {\n            if (!storeId) {\n              return;\n            }\n\n            setStoreVoucher(\n              storeId,\n              voucher,\n            );\n          }}\n        />\n\n        {/* ORDER DETAILS */}\n\n        <View\n""",
    'cart voucher UI',
)

cart = replace_once(
    cart,
    """          <View\n            style={styles.summaryRow}\n          >\n            <Text\n              style={styles.summaryLabel}\n            >\n              المنتجات\n            </Text>\n\n            <Text\n              style={styles.summaryValue}\n            >\n              {formatPrice(subtotal)}\n            </Text>\n          </View>\n\n          <View\n""",
    """          <View\n            style={styles.summaryRow}\n          >\n            <Text\n              style={styles.summaryLabel}\n            >\n              المنتجات\n            </Text>\n\n            <Text\n              style={styles.summaryValue}\n            >\n              {formatPrice(subtotal)}\n            </Text>\n          </View>\n\n          {voucherDiscount > 0 &&\n            voucherDiscountTarget ===\n              'order_subtotal' && (\n              <View\n                style={\n                  styles.summaryRow\n                }\n              >\n                <Text\n                  style={\n                    styles.discountLabel\n                  }\n                >\n                  خصم على الطلب\n                </Text>\n\n                <Text\n                  style={\n                    styles.discountValue\n                  }\n                >\n                  -{formatPrice(\n                    voucherDiscount,\n                  )}\n                </Text>\n              </View>\n            )}\n\n          <View\n""",
    'cart order discount row',
)

cart = replace_once(
    cart,
    """          <View\n            style={styles.summaryRow}\n          >\n            <Text\n              style={styles.summaryLabel}\n            >\n              التوصيل\n            </Text>\n\n            <Text\n              style={styles.summaryValue}\n            >\n              {formatPrice(deliveryFee)}\n            </Text>\n          </View>\n\n          <View\n""",
    """          <View\n            style={styles.summaryRow}\n          >\n            <Text\n              style={styles.summaryLabel}\n            >\n              التوصيل\n            </Text>\n\n            <Text\n              style={styles.summaryValue}\n            >\n              {formatPrice(deliveryFee)}\n            </Text>\n          </View>\n\n          {voucherDiscount > 0 &&\n            voucherDiscountTarget ===\n              'delivery_fee' && (\n              <View\n                style={\n                  styles.summaryRow\n                }\n              >\n                <Text\n                  style={\n                    styles.discountLabel\n                  }\n                >\n                  خصم على التوصيل\n                </Text>\n\n                <Text\n                  style={\n                    styles.discountValue\n                  }\n                >\n                  -{formatPrice(\n                    voucherDiscount,\n                  )}\n                </Text>\n              </View>\n            )}\n\n          <View\n""",
    'cart delivery discount row',
)

cart = replace_once(
    cart,
    """  summaryValue: {\n    color: '#303030',\n    fontSize: 13,\n    fontWeight: '600',\n  },\n\n  paymentFeeLabelContainer: {\n""",
    """  summaryValue: {\n    color: '#303030',\n    fontSize: 13,\n    fontWeight: '600',\n  },\n\n  discountLabel: {\n    color: BRAND_GREEN,\n    fontSize: 13,\n    fontWeight: '700',\n  },\n\n  discountValue: {\n    color: BRAND_GREEN,\n    fontSize: 13,\n    fontWeight: '800',\n  },\n\n  paymentFeeLabelContainer: {\n""",
    'cart discount styles',
)

CART.write_text(cart, encoding='utf-8')


# ---------------------------------------------------------------------
# CHECKOUT
# ---------------------------------------------------------------------
checkout = CHECKOUT.read_text(encoding='utf-8')

checkout = replace_once(
    checkout,
    "import VoucherCheckoutCard from '../components/checkout/voucher-checkout-card';\n",
    '',
    'checkout voucher component import',
)

checkout = replace_once(
    checkout,
    """import type {\n  VoucherQuote,\n} from '../services/voucher-service';\n""",
    """import {\n  validateVoucher,\n} from '../services/voucher-service';\n""",
    'checkout voucher service import',
)

checkout = replace_once(
    checkout,
    """import {\n  useOrdersStore,\n} from '../store/orders-store';\n""",
    """import {\n  useOrdersStore,\n} from '../store/orders-store';\nimport {\n  useVoucherStore,\n} from '../store/voucher-store';\n""",
    'checkout voucher store import',
)

checkout = replace_once(
    checkout,
    """  const [\n    appliedVoucher,\n    setAppliedVoucher,\n  ] = useState<VoucherQuote | null>(\n    null,\n  );\n\n""",
    '',
    'checkout local voucher state',
)

checkout = replace_once(
    checkout,
    """  const storeId =\n    checkoutCart?.storeId ??\n    null;\n\n  const storeName =\n""",
    """  const storeId =\n    checkoutCart?.storeId ??\n    null;\n\n  const appliedVoucher =\n    useVoucherStore(\n      (state) =>\n        storeId\n          ? state.vouchers[storeId] ??\n            null\n          : null,\n    );\n\n  const setStoreVoucher =\n    useVoucherStore(\n      (state) => state.setVoucher,\n    );\n\n  const storeName =\n""",
    'checkout shared voucher hooks',
)

checkout = replace_once(
    checkout,
    """  useEffect(() => {\n    if (!appliedVoucher) {\n      return;\n    }\n\n    const subtotalChanged =\n      Math.abs(\n        appliedVoucher\n          .subtotalBeforeDiscount -\n          subtotal,\n      ) > 0.009;\n\n    const deliveryChanged =\n      Math.abs(\n        appliedVoucher\n          .deliveryFeeBeforeDiscount -\n          deliveryFee,\n      ) > 0.009;\n\n    if (\n      !storeId ||\n      subtotalChanged ||\n      deliveryChanged\n    ) {\n      setAppliedVoucher(null);\n    }\n  }, [\n    appliedVoucher,\n    deliveryFee,\n    storeId,\n    subtotal,\n  ]);\n\n""",
    """  useEffect(() => {\n    if (\n      !appliedVoucher ||\n      !storeId\n    ) {\n      return;\n    }\n\n    const subtotalChanged =\n      Math.abs(\n        appliedVoucher\n          .subtotalBeforeDiscount -\n          subtotal,\n      ) > 0.009;\n\n    const deliveryChanged =\n      Math.abs(\n        appliedVoucher\n          .deliveryFeeBeforeDiscount -\n          deliveryFee,\n      ) > 0.009;\n\n    if (\n      !subtotalChanged &&\n      !deliveryChanged\n    ) {\n      return;\n    }\n\n    let cancelled = false;\n\n    async function refreshVoucher() {\n      try {\n        await ensureAppSession();\n\n        const voucherPhone =\n          phoneNumber.replace(\n            /\\D/g,\n            '',\n          );\n\n        const refreshedVoucher =\n          await validateVoucher({\n            code:\n              appliedVoucher.code,\n            storeId,\n            subtotal,\n            deliveryFee,\n            customerPhone:\n              voucherPhone ||\n              null,\n          });\n\n        if (!cancelled) {\n          setStoreVoucher(\n            storeId,\n            refreshedVoucher,\n          );\n        }\n      } catch {\n        if (!cancelled) {\n          setStoreVoucher(\n            storeId,\n            null,\n          );\n        }\n      }\n    }\n\n    void refreshVoucher();\n\n    return () => {\n      cancelled = true;\n    };\n  }, [\n    appliedVoucher,\n    deliveryFee,\n    phoneNumber,\n    setStoreVoucher,\n    storeId,\n    subtotal,\n  ]);\n\n""",
    'checkout voucher revalidation effect',
)

checkout = replace_once(
    checkout,
    """        <VoucherCheckoutCard\n          storeId={storeId}\n          subtotal={subtotal}\n          deliveryFee={deliveryFee}\n          customerPhone={\n            normalizedPhone\n          }\n          currencyCode={\n            currencyCode\n          }\n          value={\n            appliedVoucher\n          }\n          onChange={\n            setAppliedVoucher\n          }\n        />\n\n""",
    '',
    'checkout voucher UI',
)

checkout = replace_once(
    checkout,
    """      setPendingOrder(\n        orderForWhatsApp,\n      );\n\n      createdOrder = null;\n""",
    """      setPendingOrder(\n        orderForWhatsApp,\n      );\n\n      setStoreVoucher(\n        activeStoreId,\n        null,\n      );\n\n      createdOrder = null;\n""",
    'checkout clear voucher after order creation',
)

CHECKOUT.write_text(checkout, encoding='utf-8')


# Remove the one-off migration machinery from the migration commit itself.
for temporary in (WORKFLOW, SELF):
    try:
        temporary.unlink()
    except FileNotFoundError:
        pass

print('Voucher UI moved from Checkout to Cart successfully.')
