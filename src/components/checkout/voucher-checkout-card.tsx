import { Ionicons } from '@expo/vector-icons';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ensureAppSession,
} from '../../services/anonymous-auth-service';
import {
  validateVoucher,
  type VoucherQuote,
} from '../../services/voucher-service';

type VoucherCheckoutCardProps = {
  storeId: string | null;
  subtotal: number;
  deliveryFee: number;
  customerPhone: string;
  currencyCode: string;
  value: VoucherQuote | null;
  onChange: (
    voucher: VoucherQuote | null,
  ) => void;
};

function formatMoney(
  value: number,
  currencyCode: string,
): string {
  const label =
    currencyCode
      .trim()
      .toUpperCase() === 'EGP'
      ? 'ج.م'
      : currencyCode;

  const formatted =
    Number.isInteger(value)
      ? String(value)
      : value.toFixed(2);

  return `${formatted} ${label}`;
}

export default function VoucherCheckoutCard({
  storeId,
  subtotal,
  deliveryFee,
  customerPhone,
  currencyCode,
  value,
  onChange,
}: VoucherCheckoutCardProps) {
  const [
    code,
    setCode,
  ] = useState(
    value?.code ?? '',
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    isApplying,
    setIsApplying,
  ] = useState(false);

  const appliedSnapshotRef =
    useRef<{
      storeId: string;
      subtotal: number;
      deliveryFee: number;
    } | null>(
      value && storeId
        ? {
            storeId,
            subtotal:
              value.subtotalBeforeDiscount,
            deliveryFee:
              value.deliveryFeeBeforeDiscount,
          }
        : null,
    );

  useEffect(() => {
    if (!value) {
      appliedSnapshotRef.current =
        null;
      return;
    }

    const snapshot =
      appliedSnapshotRef.current;

    if (
      !storeId ||
      !snapshot ||
      snapshot.storeId !== storeId ||
      Math.abs(
        snapshot.subtotal -
          subtotal,
      ) > 0.009 ||
      Math.abs(
        snapshot.deliveryFee -
          deliveryFee,
      ) > 0.009
    ) {
      onChange(null);
      setErrorMessage(
        'تغيّرت السلة أو رسوم التوصيل. طبّق الكوبون مرة أخرى.',
      );
    }
  }, [
    deliveryFee,
    onChange,
    storeId,
    subtotal,
    value,
  ]);

  function handleCodeChange(
    nextCode: string,
  ) {
    const normalized =
      nextCode
        .replace(/\s+/g, '')
        .toUpperCase()
        .slice(0, 32);

    setCode(normalized);
    setErrorMessage(null);

    if (
      value &&
      normalized !== value.code
    ) {
      onChange(null);
      appliedSnapshotRef.current =
        null;
    }
  }

  function removeVoucher() {
    onChange(null);
    appliedSnapshotRef.current =
      null;
    setCode('');
    setErrorMessage(null);
  }

  async function applyVoucher() {
    if (
      isApplying ||
      !storeId
    ) {
      return;
    }

    const normalizedCode =
      code
        .trim()
        .toUpperCase();

    if (
      normalizedCode.length < 3
    ) {
      setErrorMessage(
        'اكتب كود الكوبون أولًا.',
      );
      onChange(null);
      return;
    }

    try {
      setIsApplying(true);
      setErrorMessage(null);

      await ensureAppSession();

      const quote =
        await validateVoucher({
          code: normalizedCode,
          storeId,
          subtotal,
          deliveryFee,
          customerPhone:
            customerPhone || null,
        });

      setCode(quote.code);
      appliedSnapshotRef.current = {
        storeId,
        subtotal,
        deliveryFee,
      };
      onChange(quote);
    } catch (error) {
      onChange(null);
      appliedSnapshotRef.current =
        null;

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تطبيق الكوبون.',
      );
    } finally {
      setIsApplying(false);
    }
  }

  const targetLabel =
    value?.discountTarget ===
      'delivery_fee'
      ? 'من قيمة التوصيل'
      : 'من قيمة الطلب';

  return (
    <View
      style={
        styles.section
      }
    >
      <View
        style={
          styles.titleRow
        }
      >
        <View
          style={
            styles.titleIcon
          }
        >
          <Ionicons
            name="ticket-outline"
            size={21}
            color="#00B14F"
          />
        </View>

        <View
          style={
            styles.titleCopy
          }
        >
          <Text
            style={
              styles.title
            }
          >
            كوبون خصم
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            عندك كود؟ طبّقه قبل إتمام الطلب
          </Text>
        </View>
      </View>

      {value ? (
        <View
          style={
            styles.appliedCard
          }
        >
          <View
            style={
              styles.appliedIcon
            }
          >
            <Ionicons
              name="checkmark"
              size={19}
              color="#FFFFFF"
            />
          </View>

          <View
            style={
              styles.appliedCopy
            }
          >
            <Text
              style={
                styles.appliedTitle
              }
              numberOfLines={1}
            >
              {value.code}
            </Text>

            <Text
              style={
                styles.appliedDescription
              }
              numberOfLines={2}
            >
              وفرت {formatMoney(
                value.discountAmount,
                currencyCode,
              )}{' '}
              {targetLabel}
              {value.titleAr
                ? ` • ${value.titleAr}`
                : ''}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إزالة الكوبون"
            hitSlop={8}
            style={({
              pressed,
            }) => [
              styles.removeButton,
              pressed &&
                styles.pressed,
            ]}
            onPress={
              removeVoucher
            }
          >
            <Text
              style={
                styles.removeText
              }
            >
              إزالة
            </Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={
            styles.inputRow
          }
        >
          <View
            style={
              styles.inputContainer
            }
          >
            <Ionicons
              name="pricetag-outline"
              size={19}
              color="#777777"
            />

            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isApplying}
              maxLength={32}
              placeholder="مثال: NOW20"
              placeholderTextColor="#A1A1A1"
              returnKeyType="done"
              style={
                styles.input
              }
              value={code}
              onChangeText={
                handleCodeChange
              }
              onSubmitEditing={() => {
                void applyVoucher();
              }}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="تطبيق الكوبون"
            disabled={
              isApplying ||
              !storeId ||
              code.trim().length < 3
            }
            style={({
              pressed,
            }) => [
              styles.applyButton,
              (
                isApplying ||
                !storeId ||
                code.trim().length < 3
              ) &&
                styles.applyButtonDisabled,
              pressed &&
                !isApplying &&
                styles.applyButtonPressed,
            ]}
            onPress={() => {
              void applyVoucher();
            }}
          >
            {isApplying ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.applyText
                }
              >
                تطبيق
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {errorMessage && (
        <View
          style={
            styles.errorRow
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={15}
            color="#D64B4B"
          />

          <Text
            style={
              styles.errorText
            }
          >
            {errorMessage}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    section: {
      borderBottomColor:
        '#F0F0F0',
      borderBottomWidth: 1,
      paddingBottom: 27,
      paddingHorizontal: 24,
      paddingTop: 27,
    },

    titleRow: {
      alignItems: 'center',
      flexDirection: 'row-reverse',
      marginBottom: 16,
    },

    titleIcon: {
      alignItems: 'center',
      backgroundColor: '#EAF8F0',
      borderRadius: 19,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },

    titleCopy: {
      flex: 1,
      marginRight: 11,
    },

    title: {
      color: '#242424',
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    subtitle: {
      color: '#888888',
      fontSize: 11.5,
      lineHeight: 17,
      marginTop: 3,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    inputRow: {
      alignItems: 'center',
      flexDirection: 'row-reverse',
      gap: 9,
    },

    inputContainer: {
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderColor: '#DFDFDF',
      borderRadius: 15,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row-reverse',
      minHeight: 52,
      paddingHorizontal: 13,
    },

    input: {
      color: '#242424',
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      minHeight: 50,
      paddingHorizontal: 10,
      textAlign: 'right',
    },

    applyButton: {
      alignItems: 'center',
      backgroundColor: '#242424',
      borderRadius: 15,
      justifyContent: 'center',
      minHeight: 52,
      minWidth: 82,
      paddingHorizontal: 14,
    },

    applyButtonDisabled: {
      opacity: 0.42,
    },

    applyButtonPressed: {
      opacity: 0.78,
      transform: [
        {
          scale: 0.98,
        },
      ],
    },

    applyText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },

    appliedCard: {
      alignItems: 'center',
      backgroundColor: '#EAF8F0',
      borderColor: '#CDECD9',
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row-reverse',
      paddingHorizontal: 13,
      paddingVertical: 12,
    },

    appliedIcon: {
      alignItems: 'center',
      backgroundColor: '#00B14F',
      borderRadius: 17,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },

    appliedCopy: {
      flex: 1,
      marginHorizontal: 11,
    },

    appliedTitle: {
      color: '#1E5B37',
      fontSize: 13.5,
      fontWeight: '900',
      textAlign: 'right',
    },

    appliedDescription: {
      color: '#527563',
      fontSize: 11,
      lineHeight: 17,
      marginTop: 3,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    removeButton: {
      paddingHorizontal: 5,
      paddingVertical: 8,
    },

    removeText: {
      color: '#8B3E3E',
      fontSize: 11.5,
      fontWeight: '800',
    },

    errorRow: {
      alignItems: 'flex-start',
      flexDirection: 'row-reverse',
      gap: 6,
      marginTop: 9,
    },

    errorText: {
      color: '#D64B4B',
      flex: 1,
      fontSize: 11,
      lineHeight: 17,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    pressed: {
      opacity: 0.65,
    },
  });
