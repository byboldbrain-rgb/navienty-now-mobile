import { Alert } from 'react-native';

export function showClosedStoreAlert(
  storeName?: string | null,
  note?: string | null,
  source: 'store' | 'product' = 'store',
): void {
  const normalizedStoreName =
    storeName?.trim() ?? '';

  const fallbackMessage =
    source === 'product'
      ? normalizedStoreName
        ? `المنتج موجود في ${normalizedStoreName}، لكن المتجر مغلق حاليًا ومش متاح للطلب.`
        : 'المنتج موجود، لكن المتجر مغلق حاليًا ومش متاح للطلب.'
      : normalizedStoreName
        ? `${normalizedStoreName} مغلق حاليًا ومش متاح للطلب.`
        : 'المتجر مغلق حاليًا ومش متاح للطلب.';

  Alert.alert(
    'المتجر مغلق حاليًا',
    note?.trim() || fallbackMessage,
  );
}
