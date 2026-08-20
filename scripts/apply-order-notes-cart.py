from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CART = ROOT / 'src/app/cart.tsx'
CHECKOUT = ROOT / 'src/app/checkout.tsx'
WORKFLOW = ROOT / '.github/workflows/apply-order-notes-cart.yml'
SCRIPT = ROOT / 'scripts/apply-order-notes-cart.py'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


cart = CART.read_text(encoding='utf-8')
checkout = CHECKOUT.read_text(encoding='utf-8')

# ============================================================
# CART
# ============================================================

cart = replace_once(
    cart,
    "  ScrollView,\n  StyleSheet,\n  Text,\n  View,\n",
    "  ScrollView,\n  StyleSheet,\n  Text,\n  TextInput,\n  View,\n",
    'cart TextInput import',
)

cart = replace_once(
    cart,
    "import {\n  useCustomerStore,\n} from '../store/customer-store';\nimport {\n  useVoucherStore,\n} from '../store/voucher-store';\n",
    "import {\n  useCustomerStore,\n} from '../store/customer-store';\nimport {\n  useOrderNotesStore,\n} from '../store/order-notes-store';\nimport {\n  useVoucherStore,\n} from '../store/voucher-store';\n",
    'cart order notes import',
)

cart = replace_once(
    cart,
    "  const clearVoucher =\n    useVoucherStore(\n      (state) => state.clearVoucher,\n    );\n\n",
    "  const clearVoucher =\n    useVoucherStore(\n      (state) => state.clearVoucher,\n    );\n\n  const orderNotes =\n    useOrderNotesStore(\n      (state) =>\n        storeId\n          ? state.notes[storeId] ??\n            ''\n          : '',\n    );\n\n  const setOrderNote =\n    useOrderNotesStore(\n      (state) => state.setNote,\n    );\n\n  const clearOrderNotes =\n    useOrderNotesStore(\n      (state) => state.clearNote,\n    );\n\n",
    'cart order notes hooks',
)

cart = replace_once(
    cart,
    "    clearVoucher(storeId);\n    clearStoreCart(storeId);\n",
    "    clearVoucher(storeId);\n    clearOrderNotes(storeId);\n    clearStoreCart(storeId);\n",
    'cart clear notes on clear cart',
)

# Clear notes if the customer removes the final item one-by-one.
cart = replace_once(
    cart,
    "                          if (\n                            item.quantity <= 1\n                          ) {\n                            removeStoreItem(\n",
    "                          if (\n                            item.quantity <= 1\n                          ) {\n                            if (\n                              items.length === 1\n                            ) {\n                              clearOrderNotes(\n                                storeId,\n                              );\n                            }\n\n                            removeStoreItem(\n",
    'cart clear notes on last item removal',
)

cart = replace_once(
    cart,
    "      <ScrollView\n        contentContainerStyle={\n          styles.pageContent\n        }\n        showsVerticalScrollIndicator={\n          false\n        }\n      >\n",
    "      <ScrollView\n        contentContainerStyle={\n          styles.pageContent\n        }\n        keyboardShouldPersistTaps=\"handled\"\n        showsVerticalScrollIndicator={\n          false\n        }\n      >\n",
    'cart keyboard handling',
)

notes_ui = r'''
        {/* ORDER NOTES */}

        <View
          style={
            styles.orderNotesSection
          }
        >
          <View
            style={
              styles.orderNotesHeader
            }
          >
            <View
              style={
                styles.orderNotesIcon
              }
            >
              <Ionicons
                name="chatbox-ellipses-outline"
                size={18}
                color={BRAND_GREEN}
              />
            </View>

            <View
              style={
                styles.orderNotesHeaderCopy
              }
            >
              <Text
                style={
                  styles.orderNotesTitle
                }
              >
                ملاحظات إضافية على الطلب
              </Text>

              <Text
                style={
                  styles.orderNotesOptional
                }
              >
                اختياري
              </Text>
            </View>
          </View>

          <TextInput
            style={
              styles.orderNotesInput
            }
            value={orderNotes}
            onChangeText={(value) => {
              if (!storeId) {
                return;
              }

              setOrderNote(
                storeId,
                value,
              );
            }}
            placeholder="أي تفاصيل مهمة للمتجر أو المندوب"
            placeholderTextColor="#a0a0a0"
            multiline
            numberOfLines={3}
            textAlign="right"
            textAlignVertical="top"
          />
        </View>

'''

cart = replace_once(
    cart,
    "        {/* VOUCHER */}\n",
    notes_ui + "        {/* VOUCHER */}\n",
    'cart notes UI insertion',
)

notes_styles = r'''
  /* ---------------------------------- */
  /* ORDER NOTES                        */
  /* ---------------------------------- */

  orderNotesSection: {
    backgroundColor: '#ffffff',
    borderColor: '#e9e9e9',
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 14,
  },

  orderNotesHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
  },

  orderNotesIcon: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN_SOFT,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },

  orderNotesHeaderCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 10,
  },

  orderNotesTitle: {
    color: '#242424',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  orderNotesOptional: {
    color: '#929292',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  orderNotesInput: {
    backgroundColor: '#f7f7f7',
    borderColor: '#ebebeb',
    borderRadius: 13,
    borderWidth: 1,
    color: '#252525',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingTop: 11,
    writingDirection: 'rtl',
  },

'''

cart = replace_once(
    cart,
    "  /* ---------------------------------- */\n  /* SUMMARY                            */\n  /* ---------------------------------- */\n",
    notes_styles + "  /* ---------------------------------- */\n  /* SUMMARY                            */\n  /* ---------------------------------- */\n",
    'cart notes styles insertion',
)

# ============================================================
# CHECKOUT
# ============================================================

checkout = replace_once(
    checkout,
    "import {\n  useOrdersStore,\n} from '../store/orders-store';\nimport {\n  useVoucherStore,\n} from '../store/voucher-store';\n",
    "import {\n  useOrdersStore,\n} from '../store/orders-store';\nimport {\n  useOrderNotesStore,\n} from '../store/order-notes-store';\nimport {\n  useVoucherStore,\n} from '../store/voucher-store';\n",
    'checkout order notes import',
)

checkout = replace_once(
    checkout,
    "  const setStoreVoucher =\n    useVoucherStore(\n      (state) => state.setVoucher,\n    );\n\n",
    "  const setStoreVoucher =\n    useVoucherStore(\n      (state) => state.setVoucher,\n    );\n\n  const notes =\n    useOrderNotesStore(\n      (state) =>\n        storeId\n          ? state.notes[storeId] ??\n            ''\n          : '',\n    );\n\n  const clearOrderNotes =\n    useOrderNotesStore(\n      (state) => state.clearNote,\n    );\n\n",
    'checkout order notes hooks',
)

checkout = replace_once(
    checkout,
    "  const [\n    notes,\n    setNotes,\n  ] = useState('');\n\n",
    "",
    'checkout local notes state removal',
)

notes_block_pattern = re.compile(
    r"\n\s*<View\n\s*style=\{styles\.field\}\n\s*>\n"
    r"\s*<Text\n\s*style=\{\n\s*styles\.fieldLabel\n\s*\}\n\s*>\n"
    r"\s*ملاحظات على الطلب\n\s*</Text>\n"
    r".*?"
    r"\s*</View>\n\s*</View>\n\n"
    r"\s*\{\(requiresPrescription",
    re.DOTALL,
)

match = notes_block_pattern.search(checkout)
if not match:
    raise RuntimeError('checkout notes UI block not found')

matched = match.group(0)
# Preserve the closing View for the section and the following pharmacy condition.
replacement = "\n        </View>\n\n        {(requiresPrescription"
checkout = checkout[:match.start()] + replacement + checkout[match.end():]

checkout = replace_once(
    checkout,
    "      setStoreVoucher(\n        activeStoreId,\n        null,\n      );\n\n",
    "      setStoreVoucher(\n        activeStoreId,\n        null,\n      );\n\n      clearOrderNotes(\n        activeStoreId,\n      );\n\n",
    'checkout clear notes after order creation',
)

# Static assertions.
assert 'ملاحظات إضافية على الطلب' in cart
assert 'useOrderNotesStore' in cart
assert 'useOrderNotesStore' in checkout
assert 'ملاحظات على الطلب' not in checkout
assert 'setNotes' not in checkout
assert 'notes,' in checkout
assert 'clearOrderNotes(' in checkout

CART.write_text(cart, encoding='utf-8')
CHECKOUT.write_text(checkout, encoding='utf-8')

# Remove the temporary migration files so the resulting branch only keeps
# the product changes.
if WORKFLOW.exists():
    WORKFLOW.unlink()
if SCRIPT.exists():
    SCRIPT.unlink()

print('Moved order notes from Checkout to Cart successfully.')
