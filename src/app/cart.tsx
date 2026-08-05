import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    selectCartItemCount,
    selectCartSubtotal,
    selectCartTotal,
    useCartStore,
} from '../store/cart-store';

export default function CartScreen() {
  const router = useRouter();

  const [clearModalVisible, setClearModalVisible] =
    useState(false);

  const items = useCartStore((state) => state.items);
  const storeId = useCartStore((state) => state.storeId);
  const storeName = useCartStore((state) => state.storeName);
  const storeIcon = useCartStore((state) => state.storeIcon);
  const deliveryFee = useCartStore(
    (state) => state.deliveryFee,
  );
  const minimumOrder = useCartStore(
    (state) => state.minimumOrder,
  );

  const increaseItem = useCartStore(
    (state) => state.increaseItem,
  );
  const decreaseItem = useCartStore(
    (state) => state.decreaseItem,
  );
  const removeItem = useCartStore(
    (state) => state.removeItem,
  );
  const clearCart = useCartStore(
    (state) => state.clearCart,
  );

  const itemCount = useCartStore(selectCartItemCount);
  const subtotal = useCartStore(selectCartSubtotal);
  const total = useCartStore(selectCartTotal);

  const remainingForMinimum = Math.max(
    minimumOrder - subtotal,
    0,
  );

  const minimumReached =
    items.length > 0 && subtotal >= minimumOrder;

  function handleClearCart() {
    clearCart();
    setClearModalVisible(false);
  }

  function continueShopping() {
    if (storeId) {
      router.replace({
        pathname: '/store/[id]',
        params: {
          id: storeId,
        },
      });

      return;
    }

    router.replace('/');
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>🛒</Text>
          </View>

          <Text style={styles.emptyTitle}>
            السلة فارغة
          </Text>

          <Text style={styles.emptyDescription}>
            لم تضف أي منتجات إلى طلبك حتى الآن.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.primaryButtonText}>
              ابدأ التسوق
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryButtonText}>
              رجوع
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.backIcon}>›</Text>
            </Pressable>

            <View style={styles.titleContainer}>
              <Text style={styles.pageTitle}>
                سلة الطلب
              </Text>

              <Text style={styles.itemCountText}>
                {itemCount} منتجات
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setClearModalVisible(true)}
            >
              <Text style={styles.clearButtonText}>
                إفراغ
              </Text>
            </Pressable>
          </View>

          <View style={styles.storeCard}>
            <View style={styles.storeIconContainer}>
              <Text style={styles.storeIcon}>
                {storeIcon ?? '🏪'}
              </Text>
            </View>

            <View style={styles.storeContent}>
              <Text style={styles.storeLabel}>
                طلبك من
              </Text>

              <Text
                style={styles.storeName}
                numberOfLines={1}
              >
                {storeName ?? 'المتجر'}
              </Text>

              <Text style={styles.oneStoreNotice}>
                يمكن إضافة منتجات من متجر واحد لكل طلب
              </Text>
            </View>
          </View>

          {!minimumReached ? (
            <View style={styles.minimumWarning}>
              <View style={styles.minimumMessage}>
                <Text style={styles.minimumWarningTitle}>
                  أضف منتجات بقيمة {remainingForMinimum} ج.م
                </Text>

                <Text style={styles.minimumWarningDescription}>
                  للوصول إلى الحد الأدنى للطلب
                </Text>
              </View>

              <Text style={styles.minimumWarningIcon}>
                🛍️
              </Text>
            </View>
          ) : (
            <View style={styles.minimumSuccess}>
              <View style={styles.minimumMessage}>
                <Text style={styles.minimumSuccessTitle}>
                  وصلت إلى الحد الأدنى للطلب
                </Text>

                <Text style={styles.minimumSuccessDescription}>
                  يمكنك الآن متابعة تنفيذ الطلب
                </Text>
              </View>

              <Text style={styles.minimumSuccessIcon}>
                ✓
              </Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionCount}>
              {itemCount} منتجات
            </Text>

            <Text style={styles.sectionTitle}>
              المنتجات
            </Text>
          </View>

          <View style={styles.itemsList}>
            {items.map((item) => {
              const itemTotal =
                item.price * item.quantity;

              return (
                <View
                  key={item.id}
                  style={styles.itemCard}
                >
                  <View style={styles.itemImage}>
                    <Text style={styles.itemIcon}>
                      {item.icon}
                    </Text>
                  </View>

                  <View style={styles.itemContent}>
                    <Text
                      style={styles.itemName}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>

                    <Text
                      style={styles.itemDescription}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>

                    <View style={styles.itemPriceRow}>
                      <Text style={styles.itemTotal}>
                        {itemTotal} ج.م
                      </Text>

                      <Text style={styles.itemUnitPrice}>
                        {item.price} ج.م للوحدة
                      </Text>
                    </View>

                    <View style={styles.itemActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.removeButton,
                          pressed && styles.buttonPressed,
                        ]}
                        onPress={() => removeItem(item.id)}
                      >
                        <Text style={styles.removeButtonText}>
                          حذف
                        </Text>
                      </Pressable>

                      <View style={styles.quantityControl}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.quantityButton,
                            pressed && styles.buttonPressed,
                          ]}
                          onPress={() =>
                            increaseItem(item.id)
                          }
                        >
                          <Text
                            style={styles.quantityButtonText}
                          >
                            +
                          </Text>
                        </Pressable>

                        <Text style={styles.quantityText}>
                          {item.quantity}
                        </Text>

                        <Pressable
                          style={({ pressed }) => [
                            styles.quantityButton,
                            pressed && styles.buttonPressed,
                          ]}
                          onPress={() =>
                            decreaseItem(item.id)
                          }
                        >
                          <Text
                            style={styles.quantityButtonText}
                          >
                            −
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.continueShoppingButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={continueShopping}
          >
            <Text style={styles.continueShoppingText}>
              + إضافة منتجات أخرى
            </Text>
          </Pressable>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              ملخص الطلب
            </Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>
                {subtotal} ج.م
              </Text>

              <Text style={styles.summaryLabel}>
                إجمالي المنتجات
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryValue}>
                {deliveryFee} ج.م
              </Text>

              <Text style={styles.summaryLabel}>
                رسوم التوصيل
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalValue}>
                {total} ج.م
              </Text>

              <Text style={styles.totalLabel}>
                الإجمالي
              </Text>
            </View>
          </View>

          <View style={styles.paymentNotice}>
            <Text style={styles.paymentNoticeText}>
              سيتم تأكيد تفاصيل الطلب وطريقة الدفع عبر واتساب
            </Text>

            <Text style={styles.paymentNoticeIcon}>
              💬
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.checkoutBarWrapper}>
        <View style={styles.checkoutBarContainer}>
          <Pressable
            disabled={!minimumReached}
            style={({ pressed }) => [
              styles.checkoutButton,
              !minimumReached &&
                styles.checkoutButtonDisabled,
              pressed &&
                minimumReached &&
                styles.checkoutButtonPressed,
            ]}
            onPress={() => router.push('/checkout')}
          >
            <View style={styles.checkoutTotal}>
              <Text style={styles.checkoutTotalValue}>
                {total} ج.م
              </Text>

              <Text style={styles.checkoutTotalLabel}>
                الإجمالي
              </Text>
            </View>

            <Text
              style={[
                styles.checkoutButtonText,
                !minimumReached &&
                  styles.checkoutButtonTextDisabled,
              ]}
            >
              {minimumReached
                ? 'متابعة الطلب'
                : `متبقي ${remainingForMinimum} ج.م`}
            </Text>

            <View
              style={[
                styles.checkoutArrowContainer,
                !minimumReached &&
                  styles.checkoutArrowDisabled,
              ]}
            >
              <Text style={styles.checkoutArrow}>
                ‹
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={clearModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setClearModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <Text style={styles.modalIcon}>🗑️</Text>
            </View>

            <Text style={styles.modalTitle}>
              إفراغ سلة الطلب؟
            </Text>

            <Text style={styles.modalDescription}>
              سيتم حذف جميع المنتجات الموجودة في السلة.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.dangerButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleClearCart}
            >
              <Text style={styles.dangerButtonText}>
                نعم، إفراغ السلة
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.modalCancelButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() =>
                setClearModalVisible(false)
              }
            >
              <Text style={styles.modalCancelButtonText}>
                إلغاء
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f7f7fa',
    flex: 1,
  },

  pageContent: {
    flexGrow: 1,
    paddingBottom: 135,
    paddingHorizontal: 18,
    paddingTop: 42,
  },

  container: {
    alignSelf: 'center',
    maxWidth: 520,
    width: '100%',
  },

  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  backButton: {
    alignItems: 'center',
    backgroundColor: '#eeeafd',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },

  backIcon: {
    color: '#5d47d2',
    fontSize: 33,
    lineHeight: 35,
  },

  titleContainer: {
    alignItems: 'center',
  },

  pageTitle: {
    color: '#202025',
    fontSize: 23,
    fontWeight: '900',
  },

  itemCountText: {
    color: '#898992',
    fontSize: 11,
    marginTop: 4,
  },

  clearButton: {
    alignItems: 'center',
    backgroundColor: '#fff0f0',
    borderRadius: 13,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
  },

  clearButtonText: {
    color: '#d64b4b',
    fontSize: 12,
    fontWeight: '800',
  },

  storeCard: {
    alignItems: 'center',
    backgroundColor: '#6d56df',
    borderRadius: 24,
    flexDirection: 'row',
    marginTop: 26,
    padding: 18,
  },

  storeIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },

  storeIcon: {
    fontSize: 31,
  },

  storeContent: {
    flex: 1,
    marginLeft: 15,
  },

  storeLabel: {
    color: '#dcd7ff',
    fontSize: 11,
    textAlign: 'right',
  },

  storeName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'right',
  },

  oneStoreNotice: {
    color: '#e9e6ff',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 6,
    textAlign: 'right',
  },

  minimumWarning: {
    alignItems: 'center',
    backgroundColor: '#fff3d6',
    borderRadius: 17,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    padding: 15,
  },

  minimumMessage: {
    flex: 1,
  },

  minimumWarningTitle: {
    color: '#7a5a13',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },

  minimumWarningDescription: {
    color: '#9a7a31',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },

  minimumWarningIcon: {
    fontSize: 21,
    marginLeft: 10,
  },

  minimumSuccess: {
    alignItems: 'center',
    backgroundColor: '#e6f8ed',
    borderRadius: 17,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    padding: 15,
  },

  minimumSuccessTitle: {
    color: '#197642',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },

  minimumSuccessDescription: {
    color: '#4f906c',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },

  minimumSuccessIcon: {
    color: '#197642',
    fontSize: 22,
    fontWeight: '900',
    marginLeft: 12,
  },

  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 29,
  },

  sectionTitle: {
    color: '#202025',
    fontSize: 20,
    fontWeight: '900',
  },

  sectionCount: {
    color: '#888891',
    fontSize: 12,
    fontWeight: '700',
  },

  itemsList: {
    gap: 13,
  },

  itemCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 21,
    flexDirection: 'row',
    minHeight: 150,
    padding: 14,
  },

  itemImage: {
    alignItems: 'center',
    backgroundColor: '#f1efff',
    borderRadius: 18,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },

  itemIcon: {
    fontSize: 35,
  },

  itemContent: {
    flex: 1,
    marginLeft: 14,
  },

  itemName: {
    color: '#202025',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },

  itemDescription: {
    color: '#777781',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'right',
  },

  itemPriceRow: {
    alignItems: 'flex-end',
    marginTop: 8,
  },

  itemTotal: {
    color: '#5d47d2',
    fontSize: 14,
    fontWeight: '900',
  },

  itemUnitPrice: {
    color: '#9a9aa2',
    fontSize: 9,
    marginTop: 2,
  },

  itemActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 11,
  },

  removeButton: {
    paddingHorizontal: 6,
    paddingVertical: 5,
  },

  removeButtonText: {
    color: '#d64b4b',
    fontSize: 11,
    fontWeight: '800',
  },

  quantityControl: {
    alignItems: 'center',
    backgroundColor: '#f1efff',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 9,
    padding: 4,
  },

  quantityButton: {
    alignItems: 'center',
    backgroundColor: '#6d56df',
    borderRadius: 9,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },

  quantityButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 21,
  },

  quantityText: {
    color: '#25252b',
    fontSize: 14,
    fontWeight: '900',
    minWidth: 22,
    textAlign: 'center',
  },

  continueShoppingButton: {
    alignItems: 'center',
    borderColor: '#d9d3fa',
    borderRadius: 17,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    marginTop: 16,
    paddingVertical: 15,
  },

  continueShoppingText: {
    color: '#5d47d2',
    fontSize: 13,
    fontWeight: '900',
  },

  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    marginTop: 27,
    padding: 20,
  },

  summaryTitle: {
    color: '#202025',
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 18,
    textAlign: 'right',
  },

  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  summaryLabel: {
    color: '#777781',
    fontSize: 13,
    fontWeight: '600',
  },

  summaryValue: {
    color: '#303036',
    fontSize: 13,
    fontWeight: '800',
  },

  summaryDivider: {
    backgroundColor: '#eeeeF2',
    height: 1,
    marginBottom: 16,
  },

  totalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  totalLabel: {
    color: '#202025',
    fontSize: 16,
    fontWeight: '900',
  },

  totalValue: {
    color: '#5d47d2',
    fontSize: 19,
    fontWeight: '900',
  },

  paymentNotice: {
    alignItems: 'center',
    backgroundColor: '#e9f7ee',
    borderRadius: 17,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
    marginTop: 16,
    padding: 15,
  },

  paymentNoticeText: {
    color: '#347052',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'right',
  },

  paymentNoticeIcon: {
    fontSize: 21,
    marginLeft: 10,
  },

  checkoutBarWrapper: {
    bottom: 0,
    left: 0,
    paddingBottom: 18,
    paddingHorizontal: 18,
    position: 'absolute',
    right: 0,
  },

  checkoutBarContainer: {
    alignSelf: 'center',
    maxWidth: 520,
    width: '100%',
  },

  checkoutButton: {
    alignItems: 'center',
    backgroundColor: '#6d56df',
    borderRadius: 20,
    flexDirection: 'row',
    minHeight: 70,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },

  checkoutButtonDisabled: {
    backgroundColor: '#d9d9df',
  },

  checkoutButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  checkoutTotal: {
    flex: 1,
  },

  checkoutTotalValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },

  checkoutTotalLabel: {
    color: '#dcd7ff',
    fontSize: 10,
    marginTop: 2,
  },

  checkoutButtonText: {
    color: '#ffffff',
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },

  checkoutButtonTextDisabled: {
    color: '#777781',
  },

  checkoutArrowContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 11,
    height: 35,
    justifyContent: 'center',
    width: 35,
  },

  checkoutArrowDisabled: {
    backgroundColor: '#eeeeF2',
  },

  checkoutArrow: {
    color: '#5d47d2',
    fontSize: 27,
    lineHeight: 30,
  },

  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(22, 19, 33, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },

  modalCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 26,
    maxWidth: 440,
    padding: 24,
    width: '100%',
  },

  modalIconContainer: {
    alignItems: 'center',
    backgroundColor: '#fff0f0',
    borderRadius: 22,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },

  modalIcon: {
    fontSize: 34,
  },

  successModalIcon: {
    alignItems: 'center',
    backgroundColor: '#e6f8ed',
    borderRadius: 38,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },

  successModalEmoji: {
    color: '#197642',
    fontSize: 35,
    fontWeight: '900',
  },

  modalTitle: {
    color: '#222228',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 18,
    textAlign: 'center',
  },

  modalDescription: {
    color: '#777781',
    fontSize: 13,
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
  },

  dangerButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#d64b4b',
    borderRadius: 16,
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  dangerButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },

  modalCancelButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#f1f1f5',
    borderRadius: 16,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  modalCancelButtonText: {
    color: '#61616a',
    fontSize: 14,
    fontWeight: '800',
  },

  checkoutSummary: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#f1efff',
    borderRadius: 17,
    marginTop: 20,
    padding: 16,
  },

  checkoutSummaryValue: {
    color: '#5d47d2',
    fontSize: 22,
    fontWeight: '900',
  },

  checkoutSummaryLabel: {
    color: '#7d72b2',
    fontSize: 11,
    marginTop: 4,
  },

  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#6d56df',
    borderRadius: 16,
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },

  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#eeeafd',
    borderRadius: 16,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  secondaryButtonText: {
    color: '#5d47d2',
    fontSize: 14,
    fontWeight: '900',
  },

  buttonPressed: {
    opacity: 0.75,
  },

  emptyScreen: {
    alignItems: 'center',
    backgroundColor: '#f7f7fa',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },

  emptyContainer: {
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
  },

  emptyIconContainer: {
    alignItems: 'center',
    backgroundColor: '#eeeafd',
    borderRadius: 42,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },

  emptyIcon: {
    fontSize: 39,
  },

  emptyTitle: {
    color: '#222228',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 20,
  },

  emptyDescription: {
    color: '#777781',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
});