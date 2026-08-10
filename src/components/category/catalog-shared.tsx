import { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import type { CatalogProduct } from '../../services/catalog-service';

export function formatCurrency(
  value: number,
  currencySymbol: string,
): string {
  const formatted = new Intl.NumberFormat(
    'ar-EG',
    {
      maximumFractionDigits: 2,
    },
  ).format(value);

  return `${formatted} ${currencySymbol || 'ج.م'}`;
}

type StateScreenProps = {
  isLoading?: boolean;
  icon?: string;
  title: string;
  description: string;
  accentColor: string;
  onRetry?: () => void;
  onBack?: () => void;
};

export function CatalogStateScreen({
  isLoading = false,
  icon = '📦',
  title,
  description,
  accentColor,
  onRetry,
  onBack,
}: StateScreenProps) {
  return (
    <View style={sharedStyles.stateScreen}>
      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={accentColor}
        />
      ) : (
        <Text style={sharedStyles.stateIcon}>
          {icon}
        </Text>
      )}

      <Text style={sharedStyles.stateTitle}>
        {title}
      </Text>
      <Text
        style={sharedStyles.stateDescription}
      >
        {description}
      </Text>

      {!isLoading && onRetry && (
        <Pressable
          style={({ pressed }) => [
            sharedStyles.primaryStateButton,
            {
              backgroundColor: accentColor,
            },
            pressed && sharedStyles.pressed,
          ]}
          onPress={onRetry}
        >
          <Text
            style={
              sharedStyles.primaryStateButtonText
            }
          >
            إعادة المحاولة
          </Text>
        </Pressable>
      )}

      {!isLoading && onBack && (
        <Pressable
          style={({ pressed }) => [
            sharedStyles.secondaryStateButton,
            pressed && sharedStyles.pressed,
          ]}
          onPress={onBack}
        >
          <Text
            style={
              sharedStyles.secondaryStateButtonText
            }
          >
            العودة للرئيسية
          </Text>
        </Pressable>
      )}
    </View>
  );
}

type ProductArtworkProps = {
  product: CatalogProduct;
  backgroundColor: string;
  size?: number;
};

export function ProductArtwork({
  product,
  backgroundColor,
  size = 92,
}: ProductArtworkProps) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const imageUrl =
    product.imageUrl ??
    product.images.find((image) => image.isCover)
      ?.imageUrl ??
    product.images[0]?.imageUrl ??
    null;

  const canShowImage =
    Boolean(imageUrl) && !imageFailed;

  return (
    <View
      style={[
        sharedStyles.productArtwork,
        {
          width: size,
          height: size,
          backgroundColor,
        },
      ]}
    >
      {canShowImage ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`صورة ${product.name}`}
          resizeMode="cover"
          source={{ uri: imageUrl ?? '' }}
          style={sharedStyles.productImage}
          onError={() => {
            setImageFailed(true);
          }}
        />
      ) : (
        <Text
          style={[
            sharedStyles.productFallback,
            {
              fontSize: Math.max(28, size * 0.38),
            },
          ]}
        >
          {product.icon || '📦'}
        </Text>
      )}
    </View>
  );
}

type QuantityControlProps = {
  quantity: number;
  accentColor: string;
  disabled?: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
};

export function QuantityControl({
  quantity,
  accentColor,
  disabled = false,
  onIncrease,
  onDecrease,
}: QuantityControlProps) {
  if (quantity <= 0) {
    return (
      <Pressable
        accessibilityLabel="إضافة المنتج إلى السلة"
        accessibilityRole="button"
        disabled={disabled}
        style={({ pressed }) => [
          sharedStyles.addButton,
          {
            backgroundColor: disabled
              ? '#D7D7DB'
              : accentColor,
          },
          pressed &&
            !disabled &&
            sharedStyles.pressed,
        ]}
        onPress={onIncrease}
      >
        <Text style={sharedStyles.addButtonText}>
          +
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={sharedStyles.quantityControl}>
      <Pressable
        accessibilityLabel="تقليل الكمية"
        accessibilityRole="button"
        disabled={disabled}
        style={({ pressed }) => [
          sharedStyles.quantityButton,
          {
            borderColor: accentColor,
          },
          pressed &&
            !disabled &&
            sharedStyles.pressed,
        ]}
        onPress={onDecrease}
      >
        <Text
          style={[
            sharedStyles.quantityButtonText,
            { color: accentColor },
          ]}
        >
          −
        </Text>
      </Pressable>

      <Text style={sharedStyles.quantityValue}>
        {quantity}
      </Text>

      <Pressable
        accessibilityLabel="زيادة الكمية"
        accessibilityRole="button"
        disabled={disabled}
        style={({ pressed }) => [
          sharedStyles.quantityButton,
          {
            borderColor: accentColor,
            backgroundColor: accentColor,
          },
          pressed &&
            !disabled &&
            sharedStyles.pressed,
        ]}
        onPress={onIncrease}
      >
        <Text
          style={[
            sharedStyles.quantityButtonText,
            { color: '#FFFFFF' },
          ]}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}

type CartBarProps = {
  itemCount: number;
  subtotal: number;
  currencySymbol: string;
  storeName: string | null;
  accentColor: string;
  onPress: () => void;
};

export function CatalogCartBar({
  itemCount,
  subtotal,
  currencySymbol,
  storeName,
  accentColor,
  onPress,
}: CartBarProps) {
  if (itemCount <= 0) {
    return null;
  }

  return (
    <View style={sharedStyles.cartBarWrapper}>
      <View style={sharedStyles.cartBarContainer}>
        <Pressable
          accessibilityLabel="عرض السلة"
          accessibilityRole="button"
          style={({ pressed }) => [
            sharedStyles.cartBar,
            { backgroundColor: accentColor },
            pressed && sharedStyles.cartBarPressed,
          ]}
          onPress={onPress}
        >
          <View style={sharedStyles.cartCount}>
            <Text style={sharedStyles.cartCountText}>
              {itemCount}
            </Text>
          </View>

          <View style={sharedStyles.cartAction}>
            <Text
              style={sharedStyles.cartActionTitle}
            >
              عرض السلة
            </Text>
            {storeName && (
              <Text
                numberOfLines={1}
                style={
                  sharedStyles.cartActionSubtitle
                }
              >
                {storeName}
              </Text>
            )}
          </View>

          <View style={sharedStyles.cartPriceBox}>
            <Text style={sharedStyles.cartPrice}>
              {formatCurrency(
                subtotal,
                currencySymbol,
              )}
            </Text>
            <Text style={sharedStyles.cartPriceLabel}>
              المنتجات
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

type ReplaceCartModalProps = {
  product: CatalogProduct | null;
  currentCartStoreName: string | null;
  accentColor: string;
  onCancel: () => void;
  onReplace: () => void;
  onOpenCart: () => void;
};

export function ReplaceCartModal({
  product,
  currentCartStoreName,
  accentColor,
  onCancel,
  onReplace,
  onOpenCart,
}: ReplaceCartModalProps) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={Boolean(product)}
      onRequestClose={onCancel}
    >
      <View style={sharedStyles.modalBackdrop}>
        <View style={sharedStyles.modalCard}>
          <Text style={sharedStyles.modalIcon}>
            🛒
          </Text>
          <Text style={sharedStyles.modalTitle}>
            السلة تحتوي طلبًا من متجر آخر
          </Text>
          <Text style={sharedStyles.modalDescription}>
            {currentCartStoreName
              ? `السلة الحالية مرتبطة بـ ${currentCartStoreName}. لا يمكن جمع منتجات من متجرين في طلب واحد.`
              : 'لا يمكن جمع منتجات من متجرين مختلفين في طلب واحد.'}
          </Text>

          <Pressable
            style={({ pressed }) => [
              sharedStyles.modalPrimaryButton,
              { backgroundColor: accentColor },
              pressed && sharedStyles.pressed,
            ]}
            onPress={onReplace}
          >
            <Text
              style={
                sharedStyles.modalPrimaryButtonText
              }
            >
              إفراغ السلة وإضافة المنتج
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              sharedStyles.modalSecondaryButton,
              pressed && sharedStyles.pressed,
            ]}
            onPress={onOpenCart}
          >
            <Text
              style={
                sharedStyles.modalSecondaryButtonText
              }
            >
              فتح السلة الحالية
            </Text>
          </Pressable>

          <Pressable
            hitSlop={8}
            style={({ pressed }) => [
              sharedStyles.modalCancelButton,
              pressed && sharedStyles.pressed,
            ]}
            onPress={onCancel}
          >
            <Text
              style={
                sharedStyles.modalCancelButtonText
              }
            >
              إلغاء
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const sharedStyles = StyleSheet.create({
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.985 }],
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  stateIcon: {
    fontSize: 54,
    marginBottom: 16,
  },
  stateTitle: {
    color: '#17171A',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 18,
    textAlign: 'center',
  },
  stateDescription: {
    color: '#72727A',
    fontSize: 14,
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 360,
    textAlign: 'center',
  },
  primaryStateButton: {
    alignItems: 'center',
    borderRadius: 16,
    marginTop: 24,
    minWidth: 190,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  primaryStateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryStateButton: {
    alignItems: 'center',
    borderColor: '#E5E5E8',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    minWidth: 190,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  secondaryStateButtonText: {
    color: '#4D4D54',
    fontSize: 14,
    fontWeight: '700',
  },
  productArtwork: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImage: {
    height: '100%',
    width: '100%',
  },
  productFallback: {
    textAlign: 'center',
  },
  addButton: {
    alignItems: 'center',
    borderRadius: 13,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 26,
  },
  quantityControl: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  quantityButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  quantityValue: {
    color: '#1D1D21',
    fontSize: 14,
    fontWeight: '900',
    minWidth: 18,
    textAlign: 'center',
  },
  cartBarWrapper: {
    bottom: 0,
    left: 0,
    paddingBottom: 10,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 0,
  },
  cartBarContainer: {
    alignSelf: 'center',
    maxWidth: 560,
    width: '100%',
  },
  cartBar: {
    alignItems: 'center',
    borderRadius: 20,
    elevation: 9,
    flexDirection: 'row',
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  cartBarPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  cartCount: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 13,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  cartCountText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  cartAction: {
    flex: 1,
    marginHorizontal: 12,
  },
  cartActionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  cartActionSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    marginTop: 3,
    textAlign: 'right',
  },
  cartPriceBox: {
    alignItems: 'flex-start',
  },
  cartPrice: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  cartPriceLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    marginTop: 3,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(14,14,18,0.58)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modalCard: {
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    maxWidth: 420,
    padding: 24,
    width: '100%',
  },
  modalIcon: {
    fontSize: 42,
    textAlign: 'center',
  },
  modalTitle: {
    color: '#17171A',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 13,
    textAlign: 'center',
  },
  modalDescription: {
    color: '#6D6D74',
    fontSize: 13,
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
  },
  modalPrimaryButton: {
    alignItems: 'center',
    borderRadius: 15,
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  modalSecondaryButton: {
    alignItems: 'center',
    backgroundColor: '#F2F2F4',
    borderRadius: 15,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalSecondaryButtonText: {
    color: '#333339',
    fontSize: 14,
    fontWeight: '800',
  },
  modalCancelButton: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 5,
  },
  modalCancelButtonText: {
    color: '#77777E',
    fontSize: 13,
    fontWeight: '700',
  },
});
