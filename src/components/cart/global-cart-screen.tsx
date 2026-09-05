import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GLOBAL_CART_DELIVERY_FEE } from '../../config/global-cart';
import {
  isPrintJobCartItem,
  selectAllCartItemCount,
  selectAllCartSubtotal,
  useCartStore,
} from '../../store/cart-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';

const money = (value: number) => `${Number(value ?? 0).toFixed(2)} ج.م`;

export default function GlobalCartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const carts = useCartStore((state) => state.carts);
  const itemCount = useCartStore(selectAllCartItemCount);
  const subtotal = useCartStore(selectAllCartSubtotal);
  const increase = useCartStore((state) => state.increaseStoreItem);
  const decrease = useCartStore((state) => state.decreaseStoreItem);
  const removeLine = useCartStore((state) => state.removeStoreLine);
  const clearStore = useCartStore((state) => state.clearStoreCart);
  const clearAll = useCartStore((state) => state.clearAllCarts);

  const groups = useMemo(
    () => Object.values(carts).filter((group) => group.items.length > 0),
    [carts],
  );
  const total = itemCount > 0 ? subtotal + GLOBAL_CART_DELIVERY_FEE : 0;

  const confirmClearAll = () => Alert.alert(
    'إفراغ السلة؟',
    'سيتم حذف كل المنتجات من جميع المتاجر.',
    [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إفراغ السلة', style: 'destructive', onPress: clearAll },
    ],
  );

  if (itemCount <= 0) {
    return (
      <View style={[styles.emptyScreen, { paddingTop: Math.max(insets.top, 16) }]}>
        <StatusBar style="dark" />
        <Pressable style={styles.circleButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={23} color={NAVIENTY_NOW_COLORS.text} />
        </Pressable>
        <View style={styles.emptyBody}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bag-handle-outline" size={42} color={NAVIENTY_NOW_COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>السلة لسه فاضية</Text>
          <Text style={styles.emptyDescription}>
            ضيف اللي محتاجه من أي متجر. كل المنتجات هتفضل في سلة واحدة.
          </Text>
          <Pressable style={styles.shopButton} onPress={() => router.replace('/')}>
            <Text style={styles.shopButtonText}>ابدأ التسوق</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <Pressable style={styles.circleButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={23} color={NAVIENTY_NOW_COLORS.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>السلة</Text>
          <Text style={styles.headerSubtitle}>
            {itemCount} {itemCount === 1 ? 'منتج' : 'منتجات'} من {groups.length} {groups.length === 1 ? 'متجر' : 'متاجر'}
          </Text>
        </View>
        <Pressable style={styles.clearButton} onPress={confirmClearAll}>
          <Ionicons name="trash-outline" size={20} color="#C83E3E" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.notice}>
          <Ionicons name="layers-outline" size={20} color={NAVIENTY_NOW_COLORS.primary} />
          <Text style={styles.noticeText}>
            اطلب من أكتر من متجر في نفس السلة وادفع رسوم توصيل 25 جنيه مرة واحدة بس.
          </Text>
        </View>

        {groups.map((group) => {
          const groupSubtotal = group.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
          );

          return (
            <View key={group.storeId} style={styles.storeCard}>
              <View style={styles.storeHeader}>
                <Pressable
                  hitSlop={8}
                  style={styles.storeRemove}
                  onPress={() => Alert.alert(
                    `حذف ${group.storeName}؟`,
                    'سيتم حذف منتجات هذا المتجر فقط من السلة.',
                    [
                      { text: 'إلغاء', style: 'cancel' },
                      { text: 'حذف', style: 'destructive', onPress: () => clearStore(group.storeId) },
                    ],
                  )}
                >
                  <Ionicons name="close" size={18} color={NAVIENTY_NOW_COLORS.textSecondary} />
                </Pressable>
                <View style={styles.storeIdentity}>
                  <View style={styles.storeCopy}>
                    <Text style={styles.storeName} numberOfLines={1}>{group.storeName}</Text>
                    <Text style={styles.storeSubtotal}>{money(groupSubtotal)}</Text>
                  </View>
                  <View style={styles.storeIcon}><Text style={styles.emoji}>{group.storeIcon || '🏪'}</Text></View>
                </View>
              </View>

              {group.items.map((item, index) => {
                const printJob = isPrintJobCartItem(item);
                return (
                  <View key={item.lineId}>
                    {index > 0 ? <View style={styles.divider} /> : null}
                    <View style={styles.itemRow}>
                      <View style={styles.itemVisual}><Text style={styles.itemEmoji}>{item.icon || '📦'}</Text></View>
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                        {item.variantName ? <Text style={styles.variant} numberOfLines={2}>{item.variantName}</Text> : null}
                        <Text style={styles.itemPrice}>{money(item.price * item.quantity)}</Text>
                      </View>
                      {printJob ? (
                        <Pressable
                          style={styles.deleteButton}
                          onPress={() => removeLine(group.storeId, item.lineId)}
                        >
                          <Ionicons name="trash-outline" size={19} color="#C83E3E" />
                        </Pressable>
                      ) : (
                        <View style={styles.stepper}>
                          <Pressable
                            style={styles.stepButton}
                            onPress={() => increase(group.storeId, item.id, item.variantId)}
                          >
                            <Ionicons name="add" size={18} color={NAVIENTY_NOW_COLORS.primary} />
                          </Pressable>
                          <Text style={styles.quantity}>{item.quantity}</Text>
                          <Pressable
                            style={styles.stepButton}
                            onPress={() => decrease(group.storeId, item.id, item.variantId)}
                          >
                            <Ionicons
                              name={item.quantity <= 1 ? 'trash-outline' : 'remove'}
                              size={17}
                              color={item.quantity <= 1 ? '#C83E3E' : NAVIENTY_NOW_COLORS.primary}
                            />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>ملخص الطلب</Text>
          <SummaryRow label="إجمالي المنتجات" value={money(subtotal)} />
          <View style={styles.summaryRow}>
            <View style={styles.deliveryLabel}>
              <View style={styles.onceBadge}><Text style={styles.onceText}>مرة واحدة</Text></View>
              <Text style={styles.summaryLabel}>التوصيل</Text>
            </View>
            <Text style={styles.summaryValue}>{money(GLOBAL_CART_DELIVERY_FEE)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <SummaryRow label="الإجمالي قبل رسوم الدفع" value={money(total)} total />
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={styles.checkoutButton} onPress={() => router.push('/global-location-picker')}>
          <Text style={styles.checkoutTotal}>{money(total)}</Text>
          <Text style={styles.checkoutText}>تابع للدفع</Text>
          <View style={styles.checkoutIcon}>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function SummaryRow({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return (
    <View style={[styles.summaryRow, total && styles.totalRow]}>
      <Text style={total ? styles.totalLabel : styles.summaryLabel}>{label}</Text>
      <Text style={total ? styles.totalValue : styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: NAVIENTY_NOW_COLORS.page, flex: 1 },
  emptyScreen: { backgroundColor: NAVIENTY_NOW_COLORS.page, flex: 1, paddingHorizontal: 16 },
  emptyBody: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  emptyIcon: { alignItems: 'center', backgroundColor: NAVIENTY_NOW_COLORS.primaryUltraPale, borderRadius: 38, height: 76, justifyContent: 'center', width: 76 },
  emptyTitle: { color: NAVIENTY_NOW_COLORS.text, fontSize: 21, fontWeight: '900', marginTop: 18 },
  emptyDescription: { color: NAVIENTY_NOW_COLORS.textSecondary, fontSize: 13, lineHeight: 22, marginTop: 8, maxWidth: 330, textAlign: 'center', writingDirection: 'rtl' },
  shopButton: { alignItems: 'center', backgroundColor: NAVIENTY_NOW_COLORS.primary, borderRadius: 999, justifyContent: 'center', marginTop: 22, minHeight: 52, minWidth: 190, paddingHorizontal: 28 },
  shopButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  header: { alignItems: 'center', borderBottomColor: '#EEEEEE', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 78, paddingBottom: 12, paddingHorizontal: 16 },
  circleButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E1E1E1', borderRadius: 23, borderWidth: 1, height: 46, justifyContent: 'center', width: 46 },
  clearButton: { alignItems: 'center', backgroundColor: '#FFF5F5', borderRadius: 23, height: 46, justifyContent: 'center', width: 46 },
  headerCopy: { alignItems: 'center', flex: 1, paddingHorizontal: 8 },
  headerTitle: { color: NAVIENTY_NOW_COLORS.text, fontSize: 18, fontWeight: '900' },
  headerSubtitle: { color: NAVIENTY_NOW_COLORS.textSecondary, fontSize: 10.5, marginTop: 2, writingDirection: 'rtl' },
  scroll: { flex: 1 },
  content: { alignSelf: 'center', maxWidth: NAVIENTY_NOW_LAYOUT.contentMaxWidth, paddingBottom: 24, paddingHorizontal: 16, width: '100%' },
  notice: { alignItems: 'center', backgroundColor: NAVIENTY_NOW_COLORS.primaryUltraPale, borderColor: '#DDF3E6', borderRadius: 18, borderWidth: 1, flexDirection: 'row-reverse', marginTop: 14, padding: 13 },
  noticeText: { color: NAVIENTY_NOW_COLORS.text, flex: 1, fontSize: 11.5, fontWeight: '700', lineHeight: 19, marginRight: 10, textAlign: 'right', writingDirection: 'rtl' },
  storeCard: { backgroundColor: '#FFFFFF', borderColor: NAVIENTY_NOW_COLORS.border, borderRadius: NAVIENTY_NOW_LAYOUT.cardRadius, borderWidth: 1, marginTop: 14, overflow: 'hidden', padding: 14 },
  storeHeader: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  storeIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row-reverse' },
  storeIcon: { alignItems: 'center', backgroundColor: NAVIENTY_NOW_COLORS.surface, borderRadius: 18, height: 42, justifyContent: 'center', width: 42 },
  emoji: { fontSize: 22 },
  storeCopy: { alignItems: 'flex-end', flex: 1, marginRight: 10 },
  storeName: { color: NAVIENTY_NOW_COLORS.text, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  storeSubtotal: { color: NAVIENTY_NOW_COLORS.textSecondary, fontSize: 10.5, fontWeight: '700', marginTop: 3 },
  storeRemove: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  divider: { backgroundColor: '#F0F0F0', height: StyleSheet.hairlineWidth, marginLeft: 58 },
  itemRow: { alignItems: 'center', flexDirection: 'row-reverse', minHeight: 90, paddingVertical: 11 },
  itemVisual: { alignItems: 'center', backgroundColor: NAVIENTY_NOW_COLORS.surface, borderRadius: 14, height: 54, justifyContent: 'center', width: 54 },
  itemEmoji: { fontSize: 25 },
  itemCopy: { alignItems: 'flex-end', flex: 1, marginHorizontal: 10 },
  itemName: { color: NAVIENTY_NOW_COLORS.text, fontSize: 13, fontWeight: '800', lineHeight: 19, textAlign: 'right', writingDirection: 'rtl' },
  variant: { color: NAVIENTY_NOW_COLORS.textSecondary, fontSize: 9.5, lineHeight: 15, marginTop: 2, textAlign: 'right', writingDirection: 'rtl' },
  itemPrice: { color: NAVIENTY_NOW_COLORS.primaryDark, fontSize: 11.5, fontWeight: '900', marginTop: 5 },
  stepper: { alignItems: 'center', backgroundColor: NAVIENTY_NOW_COLORS.surface, borderColor: NAVIENTY_NOW_COLORS.border, borderRadius: 999, borderWidth: 1, flexDirection: 'row-reverse', padding: 3 },
  stepButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, height: 31, justifyContent: 'center', width: 31 },
  quantity: { color: NAVIENTY_NOW_COLORS.text, fontSize: 12, fontWeight: '900', minWidth: 28, textAlign: 'center' },
  deleteButton: { alignItems: 'center', backgroundColor: '#FFF5F5', borderRadius: 18, height: 38, justifyContent: 'center', width: 38 },
  summaryCard: { backgroundColor: '#FFFFFF', borderColor: NAVIENTY_NOW_COLORS.border, borderRadius: NAVIENTY_NOW_LAYOUT.cardRadius, borderWidth: 1, marginTop: 14, padding: 15 },
  summaryTitle: { color: NAVIENTY_NOW_COLORS.text, fontSize: 15, fontWeight: '900', marginBottom: 10, textAlign: 'right', writingDirection: 'rtl' },
  summaryRow: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', minHeight: 38 },
  deliveryLabel: { alignItems: 'center', flexDirection: 'row-reverse' },
  summaryLabel: { color: NAVIENTY_NOW_COLORS.textSecondary, fontSize: 11, writingDirection: 'rtl' },
  summaryValue: { color: NAVIENTY_NOW_COLORS.text, fontSize: 12, fontWeight: '800' },
  onceBadge: { backgroundColor: NAVIENTY_NOW_COLORS.primaryUltraPale, borderRadius: 999, marginRight: 7, paddingHorizontal: 7, paddingVertical: 3 },
  onceText: { color: NAVIENTY_NOW_COLORS.primaryDark, fontSize: 8.5, fontWeight: '900' },
  summaryDivider: { backgroundColor: '#EAEAEA', height: StyleSheet.hairlineWidth, marginVertical: 8 },
  totalRow: { minHeight: 44 },
  totalLabel: { color: NAVIENTY_NOW_COLORS.text, fontSize: 12.5, fontWeight: '900', writingDirection: 'rtl' },
  totalValue: { color: NAVIENTY_NOW_COLORS.primaryDark, fontSize: 18, fontWeight: '900' },
  bottomBar: { backgroundColor: '#FFFFFF', borderTopColor: '#EEEEEE', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 11 },
  checkoutButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: NAVIENTY_NOW_COLORS.primary, borderRadius: 999, flexDirection: 'row', height: 56, justifyContent: 'space-between', maxWidth: NAVIENTY_NOW_LAYOUT.contentMaxWidth, paddingHorizontal: 8, width: '100%' },
  checkoutTotal: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', minWidth: 100, paddingLeft: 10, textAlign: 'left' },
  checkoutText: { color: '#FFFFFF', flex: 1, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  checkoutIcon: { alignItems: 'center', backgroundColor: NAVIENTY_NOW_COLORS.primaryDark, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
});
