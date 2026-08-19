import { Ionicons } from '@expo/vector-icons';
import {
  Slot,
  useLocalSearchParams,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getOrderRating,
  submitOrderRating,
  type OrderRating,
} from '../../services/rating-service';
import { useOrdersStore } from '../../store/orders-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../../theme/navienty-now-theme';

const EMPTY_RATING: OrderRating = {
  rated: false,
  rating: null,
  createdAt: null,
};

function normalizeOrderId(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default function OrderLayout() {
  const params =
    useLocalSearchParams<{
      id?: string | string[];
    }>();

  const orderId =
    normalizeOrderId(params.id);

  const order =
    useOrdersStore(
      (state) => {
        if (!orderId) {
          return null;
        }

        return (
          state.orders.find(
            (currentOrder) =>
              currentOrder.id ===
              orderId,
          ) ??
          (state.pendingOrder?.id ===
          orderId
            ? state.pendingOrder
            : null)
        );
      },
    );

  const shouldShowRating =
    order?.status === 'delivered';

  const [
    orderRating,
    setOrderRating,
  ] = useState<OrderRating>(
    EMPTY_RATING,
  );

  const [
    selectedRating,
    setSelectedRating,
  ] = useState<number | null>(
    null,
  );

  const [
    isLoadingRating,
    setIsLoadingRating,
  ] = useState(false);

  const [
    isSubmittingRating,
    setIsSubmittingRating,
  ] = useState(false);

  const [
    ratingError,
    setRatingError,
  ] = useState<string | null>(
    null,
  );

  const loadRating =
    useCallback(async () => {
      if (
        !orderId ||
        !shouldShowRating
      ) {
        setOrderRating(
          EMPTY_RATING,
        );
        setSelectedRating(null);
        setRatingError(null);
        return;
      }

      try {
        setIsLoadingRating(true);
        setRatingError(null);

        const result =
          await getOrderRating(
            orderId,
          );

        setOrderRating(result);
        setSelectedRating(
          result.rating,
        );
      } catch (error) {
        setRatingError(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل التقييم.',
        );
      } finally {
        setIsLoadingRating(false);
      }
    }, [
      orderId,
      shouldShowRating,
    ]);

  useEffect(() => {
    void loadRating();
  }, [loadRating]);

  async function handleSubmitRating() {
    if (
      !orderId ||
      !selectedRating ||
      orderRating.rated ||
      isSubmittingRating
    ) {
      return;
    }

    try {
      setIsSubmittingRating(true);
      setRatingError(null);

      const result =
        await submitOrderRating(
          orderId,
          selectedRating,
        );

      setOrderRating({
        rated: true,
        rating: result.rating,
        createdAt:
          result.createdAt,
      });

      setSelectedRating(
        result.rating,
      );
    } catch (error) {
      setRatingError(
        error instanceof Error
          ? error.message
          : 'تعذر إرسال التقييم. حاول مرة أخرى.',
      );
    } finally {
      setIsSubmittingRating(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Slot />
      </View>

      {shouldShowRating && (
        <View style={styles.ratingShell}>
          <View style={styles.ratingCard}>
            {isLoadingRating ? (
              <View
                style={
                  styles.loadingRow
                }
              >
                <ActivityIndicator
                  size="small"
                  color={
                    NAVIENTY_NOW_COLORS.primary
                  }
                />

                <Text
                  style={
                    styles.loadingText
                  }
                >
                  جاري تحميل التقييم...
                </Text>
              </View>
            ) : (
              <>
                <View
                  style={
                    styles.ratingHeader
                  }
                >
                  <View
                    style={
                      styles.ratingTitleGroup
                    }
                  >
                    <Text
                      style={
                        styles.ratingTitle
                      }
                      numberOfLines={1}
                    >
                      قيّم تجربتك مع{' '}
                      {order?.storeName ??
                        'المطعم'}
                    </Text>

                    <Text
                      style={
                        styles.ratingSubtitle
                      }
                    >
                      تقييمك يساعدنا نحسن التجربة
                    </Text>
                  </View>

                  {orderRating.rated && (
                    <View
                      style={
                        styles.submittedBadge
                      }
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={15}
                        color="#079447"
                      />

                      <Text
                        style={
                          styles.submittedText
                        }
                      >
                        تم التقييم
                      </Text>
                    </View>
                  )}
                </View>

                <View
                  style={
                    styles.ratingActions
                  }
                >
                  {!orderRating.rated && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={
                        !selectedRating ||
                        isSubmittingRating
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.submitButton,
                        (!selectedRating ||
                          isSubmittingRating) &&
                          styles.submitButtonDisabled,
                        pressed &&
                          selectedRating &&
                          !isSubmittingRating &&
                          styles.buttonPressed,
                      ]}
                      onPress={() => {
                        void handleSubmitRating();
                      }}
                    >
                      {isSubmittingRating ? (
                        <ActivityIndicator
                          size="small"
                          color="#FFFFFF"
                        />
                      ) : (
                        <Text
                          style={
                            styles.submitButtonText
                          }
                        >
                          إرسال
                        </Text>
                      )}
                    </Pressable>
                  )}

                  <View
                    accessibilityRole="radiogroup"
                    style={styles.starsRow}
                  >
                    {[1, 2, 3, 4, 5].map(
                      (star) => {
                        const activeRating =
                          orderRating.rating ??
                          selectedRating ??
                          0;

                        const isFilled =
                          star <=
                          activeRating;

                        return (
                          <Pressable
                            key={star}
                            accessibilityRole="radio"
                            accessibilityLabel={`${star} نجوم`}
                            accessibilityState={{
                              checked:
                                selectedRating ===
                                star,
                              disabled:
                                orderRating.rated,
                            }}
                            disabled={
                              orderRating.rated ||
                              isSubmittingRating
                            }
                            hitSlop={4}
                            style={({
                              pressed,
                            }) => [
                              styles.starButton,
                              pressed &&
                                !orderRating.rated &&
                                styles.starPressed,
                            ]}
                            onPress={() =>
                              setSelectedRating(
                                star,
                              )
                            }
                          >
                            <Ionicons
                              name={
                                isFilled
                                  ? 'star'
                                  : 'star-outline'
                              }
                              size={29}
                              color={
                                isFilled
                                  ? '#F4AF00'
                                  : '#B8B8BD'
                              }
                            />
                          </Pressable>
                        );
                      },
                    )}
                  </View>
                </View>

                {ratingError && (
                  <View
                    style={
                      styles.ratingErrorRow
                    }
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={13}
                      color="#A34444"
                    />

                    <Text
                      style={
                        styles.ratingErrorText
                      }
                    >
                      {ratingError}
                    </Text>

                    {!orderRating.rated &&
                      !isSubmittingRating && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            void loadRating();
                          }}
                        >
                          <Text
                            style={
                              styles.retryText
                            }
                          >
                            إعادة
                          </Text>
                        </Pressable>
                      )}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      backgroundColor: '#FFFFFF',
      flex: 1,
    },

    content: {
      flex: 1,
    },

    ratingShell: {
      backgroundColor: '#FFFFFF',
      borderTopColor: '#ECECEF',
      borderTopWidth:
        StyleSheet.hairlineWidth,
      paddingBottom: 10,
      paddingHorizontal:
        NAVIENTY_NOW_LAYOUT.pageGutter,
      paddingTop: 9,
    },

    ratingCard: {
      alignSelf: 'center',
      backgroundColor: '#FFFFFF',
      maxWidth:
        NAVIENTY_NOW_LAYOUT.contentMaxWidth,
      width: '100%',
    },

    loadingRow: {
      alignItems: 'center',
      flexDirection: 'row-reverse',
      gap: 8,
      justifyContent: 'center',
      minHeight: 74,
    },

    loadingText: {
      color: '#66666C',
      fontSize: 11,
      writingDirection: 'rtl',
    },

    ratingHeader: {
      alignItems: 'center',
      flexDirection: 'row-reverse',
      gap: 10,
      justifyContent:
        'space-between',
    },

    ratingTitleGroup: {
      flex: 1,
    },

    ratingTitle: {
      color: '#202024',
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 19,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    ratingSubtitle: {
      color: '#85858B',
      fontSize: 9.5,
      lineHeight: 14,
      marginTop: 1,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    submittedBadge: {
      alignItems: 'center',
      backgroundColor: '#ECF9F1',
      borderRadius: 12,
      flexDirection: 'row-reverse',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },

    submittedText: {
      color: '#08783C',
      fontSize: 9.5,
      fontWeight: '700',
    },

    ratingActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent:
        'space-between',
      marginTop: 7,
    },

    starsRow: {
      alignItems: 'center',
      direction: 'ltr',
      flexDirection: 'row',
      gap: 2,
    },

    starButton: {
      alignItems: 'center',
      height: 36,
      justifyContent: 'center',
      width: 36,
    },

    starPressed: {
      transform: [
        {
          scale: 0.9,
        },
      ],
    },

    submitButton: {
      alignItems: 'center',
      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,
      borderRadius: 10,
      justifyContent: 'center',
      minHeight: 36,
      minWidth: 72,
      paddingHorizontal: 14,
    },

    submitButtonDisabled: {
      opacity: 0.42,
    },

    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },

    buttonPressed: {
      opacity: 0.72,
    },

    ratingErrorRow: {
      alignItems: 'center',
      flexDirection: 'row-reverse',
      gap: 5,
      marginTop: 4,
    },

    ratingErrorText: {
      color: '#A34444',
      flex: 1,
      fontSize: 9,
      lineHeight: 13,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    retryText: {
      color:
        NAVIENTY_NOW_COLORS.primary,
      fontSize: 9.5,
      fontWeight: '800',
    },
  });
