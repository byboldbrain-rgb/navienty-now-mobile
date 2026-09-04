import { Ionicons } from '@expo/vector-icons';
import {
    useFocusEffect,
    useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    Fragment,
    useCallback,
    useState,
} from 'react';
import {
    Alert,
    Image,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    buildWhatsAppUrl,
} from '../../services/promo-action-service';
import {
    getServiceBookingById,
    submitServiceBookingForConfirmation,
    type ServiceBooking,
    type ServiceBookingStatus,
} from '../../services/service-bookings-service';
import {
    NAVIENTY_NOW_COLORS,
} from '../../theme/navienty-now-theme';
import { OrderDetailsScreenSkeleton } from '../ui/loading-skeleton';

type ServiceBookingSuccessProps = {
  serviceBookingId: string;
};

type TrackingStep = {
  key:
    | 'confirmation'
    | 'pickup'
    | 'processing'
    | 'delivery'
    | 'delivered';
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const POLL_INTERVAL_MS = 8000;

const TRACKING_STEPS: TrackingStep[] = [
  {
    key: 'confirmation',
    title: 'تأكيد الحجز',
    icon: 'checkmark',
  },
  {
    key: 'pickup',
    title: 'استلام الغسيل',
    icon: 'bag-handle-outline',
  },
  {
    key: 'processing',
    title: 'غسيل ومكواة',
    icon: 'sparkles-outline',
  },
  {
    key: 'delivery',
    title: 'في الطريق',
    icon: 'bicycle-outline',
  },
  {
    key: 'delivered',
    title: 'تم التسليم',
    icon: 'home-outline',
  },
];

function getTrackingStage(
  status: ServiceBookingStatus,
): number {
  switch (status) {
    case 'awaiting-whatsapp-send':
    case 'waiting-confirmation':
    case 'confirmed':
      return 0;
    case 'picked-up':
      return 1;
    case 'processing':
    case 'ready-for-delivery':
      return 2;
    case 'out-for-delivery':
      return 3;
    case 'delivered':
      return 4;
    case 'cancelled':
      return -1;
    default:
      return 0;
  }
}

function getStatusCopy(
  status: ServiceBookingStatus,
) {
  switch (status) {
    case 'awaiting-whatsapp-send':
      return {
        title: 'جاري تسجيل الحجز',
        description:
          'تم حفظ حجزك وسيحاول التطبيق إرساله للمراجعة تلقائيًا.',
      };
    case 'waiting-confirmation':
      return {
        title: 'جاري تأكيد الحجز',
        description:
          'استلمنا حجزك وجاري مراجعة التفاصيل مع فريق Navienty Now.',
      };
    case 'confirmed':
      return {
        title: 'تم تأكيد الحجز',
        description:
          'تم تأكيد باقة الغسيل وسيتم تنسيق موعد الاستلام.',
      };
    case 'picked-up':
      return {
        title: 'تم استلام الغسيل',
        description:
          'استلمنا الغسيل وهنبدأ التجهيز.',
      };
    case 'processing':
      return {
        title: 'جاري الغسيل والمكواة',
        description:
          'الغسيل موجود حاليًا في مرحلة الغسيل والمكواة.',
      };
    case 'ready-for-delivery':
      return {
        title: 'جاهز للتوصيل',
        description:
          'الغسيل جاهز وهيتحرك للتوصيل قريبًا.',
      };
    case 'out-for-delivery':
      return {
        title: 'الغسيل في الطريق',
        description:
          'طلبك خرج للتوصيل وهو في طريقه إليك.',
      };
    case 'delivered':
      return {
        title: 'تم التسليم',
        description:
          'تم توصيل الغسيل بنجاح. نتمنى لك تجربة رائعة مع Navienty Now.',
      };
    case 'cancelled':
      return {
        title: 'تم إلغاء الحجز',
        description:
          'تم إلغاء هذا الحجز ولن يتم استكمال تنفيذه.',
      };
    default:
      return {
        title: 'جاري تحديث الحجز',
        description:
          'يتم الآن الحصول على أحدث حالة للحجز.',
      };
  }
}

function formatMoney(
  value: number,
  currencySymbol: string,
) {
  if (Number.isInteger(value)) {
    return `${value} ${currencySymbol}`;
  }

  return `${value.toFixed(2)} ${currencySymbol}`;
}

export default function ServiceBookingSuccess({
  serviceBookingId,
}: ServiceBookingSuccessProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [booking, setBooking] =
    useState<ServiceBooking | null>(null);
  const [isLoading, setIsLoading] =
    useState(true);
  const [
    refreshError,
    setRefreshError,
  ] = useState<string | null>(null);
  const [
    isOpeningCancellation,
    setIsOpeningCancellation,
  ] = useState(false);

  const refreshBooking = useCallback(
    async (
      options?: {
        silent?: boolean;
      },
    ) => {
      const silent = options?.silent === true;

      try {
        if (!silent) {
          setIsLoading(true);
        }

        let latestBooking =
          await getServiceBookingById(
            serviceBookingId,
          );

        if (!latestBooking) {
          setRefreshError(
            'لم يتم العثور على الحجز.',
          );
          return;
        }

        let submissionError:
          string | null = null;

        if (
          latestBooking.status ===
          'awaiting-whatsapp-send'
        ) {
          try {
            latestBooking =
              await submitServiceBookingForConfirmation(
                latestBooking.id,
              );
          } catch (error) {
            submissionError =
              error instanceof Error
                ? error.message
                : 'تعذر إرسال الحجز للمراجعة.';
          }
        }

        setBooking(latestBooking);
        setRefreshError(
          submissionError,
        );
      } catch (error) {
        setRefreshError(
          error instanceof Error
            ? error.message
            : 'تعذر تحديث حالة الحجز.',
        );
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [serviceBookingId],
  );

  useFocusEffect(
    useCallback(() => {
      void refreshBooking();

      const timer = setInterval(() => {
        void (async () => {
          const latest =
            await getServiceBookingById(
              serviceBookingId,
            );

          if (
            latest?.status === 'delivered' ||
            latest?.status === 'cancelled'
          ) {
            setBooking(latest);
            return;
          }

          await refreshBooking({
            silent: true,
          });
        })();
      }, POLL_INTERVAL_MS);

      return () => {
        clearInterval(timer);
      };
    }, [
      refreshBooking,
      serviceBookingId,
    ]),
  );

  function returnToHome() {
    router.replace('/');
  }

  async function openCancellationWhatsApp() {
    if (!booking || isOpeningCancellation) {
      return;
    }

    const message =
      `عاوز ألغي حجز ${booking.packageNameAr} رقم ${booking.bookingCode}`;

    const url = buildWhatsAppUrl(
      booking.whatsappNumber,
      message,
    );

    if (!url) {
      Alert.alert(
        'تعذر فتح واتساب',
        'رقم واتساب الخاص بالحجز غير متاح.',
      );
      return;
    }

    try {
      setIsOpeningCancellation(true);
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        'تعذر فتح واتساب',
        error instanceof Error
          ? error.message
          : 'حاول مرة أخرى.',
      );
    } finally {
      setIsOpeningCancellation(false);
    }
  }

  function requestCancellation() {
    if (
      !booking ||
      booking.status === 'delivered' ||
      booking.status === 'cancelled'
    ) {
      return;
    }

    Alert.alert(
      'إلغاء الحجز',
      'هل أنت متأكد أنك تريد طلب إلغاء حجز الخدمة؟ سيتم فتح واتساب للتواصل مع فريق Navienty Now.',
      [
        {
          text: 'لا، رجوع',
          style: 'cancel',
        },
        {
          text: 'طلب الإلغاء',
          style: 'destructive',
          onPress: () => {
            void openCancellationWhatsApp();
          },
        },
      ],
    );
  }

  if (isLoading && !booking) {
    return <OrderDetailsScreenSkeleton />;
  }

  if (!booking) {
    return (
      <View style={styles.stateScreen}>
        <StatusBar style="dark" />

        <View style={styles.stateIcon}>
          <Ionicons
            color={NAVIENTY_NOW_COLORS.primary}
            name="receipt-outline"
            size={27}
          />
        </View>

        <Text style={styles.stateTitle}>
          لم يتم العثور على الحجز
        </Text>

        <Text style={styles.stateDescription}>
          {refreshError ||
            'تعذر الوصول إلى تفاصيل هذا الحجز.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.statePrimaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => {
            void refreshBooking();
          }}
        >
          <Text
            style={styles.statePrimaryButtonText}
          >
            إعادة المحاولة
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.stateSecondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={returnToHome}
        >
          <Text
            style={styles.stateSecondaryButtonText}
          >
            العودة للرئيسية
          </Text>
        </Pressable>
      </View>
    );
  }

  const currentStage = getTrackingStage(
    booking.status,
  );
  const currentCopy = getStatusCopy(
    booking.status,
  );
  const isCancelled =
    booking.status === 'cancelled';
  const isDelivered =
    booking.status === 'delivered';
  const formattedPrice = formatMoney(
    booking.packagePrice,
    booking.currencySymbol,
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.hero,
            {
              paddingTop:
                Math.max(insets.top, 12) + 8,
            },
          ]}
        >
          <View style={styles.heroHeader}>
            <Pressable
              accessibilityLabel="إغلاق"
              style={({ pressed }) => [
                styles.closeButton,
                pressed &&
                  styles.closeButtonPressed,
              ]}
              onPress={returnToHome}
            >
              <Ionicons
                color={NAVIENTY_NOW_COLORS.text}
                name="close"
                size={24}
              />
            </Pressable>

            <View style={styles.heroTitleGroup}>
              <Text style={styles.heroBrand}>
                Navienty Now
              </Text>
              <Text style={styles.heroSubtitle}>
                تتبع حجزك
              </Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.trackingCard}>
            <View style={styles.trackingTopRow}>
              <View style={styles.serviceLogo}>
                {booking.packageImageUrl ? (
                  <Image
                    accessibilityLabel={
                      booking.packageNameAr
                    }
                    resizeMode="cover"
                    source={{
                      uri: booking.packageImageUrl,
                    }}
                    style={styles.serviceLogoImage}
                  />
                ) : (
                  <Ionicons
                    color={NAVIENTY_NOW_COLORS.primary}
                    name="shirt-outline"
                    size={28}
                  />
                )}
              </View>

              <View style={styles.trackingHeading}>
                <Text
                  numberOfLines={1}
                  style={styles.trackingServiceName}
                >
                  {booking.packageNameAr}
                </Text>
                <Text style={styles.bookingCode}>
                  حجز #{booking.bookingCode}
                </Text>
              </View>
            </View>

            {isCancelled ? (
              <View style={styles.cancelledCard}>
                <View style={styles.cancelledIcon}>
                  <Ionicons
                    color="#FFFFFF"
                    name="close"
                    size={18}
                  />
                </View>

                <View style={styles.cancelledContent}>
                  <Text style={styles.cancelledTitle}>
                    تم إلغاء الحجز
                  </Text>
                  <Text
                    style={styles.cancelledDescription}
                  >
                    {booking.cancellationReason ||
                      'تم إلغاء هذا الحجز ولن يتم استكمال تنفيذه.'}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.currentStatus}>
                  <Text
                    style={styles.currentStatusTitle}
                  >
                    {currentCopy.title}
                  </Text>
                  <Text
                    style={
                      styles.currentStatusDescription
                    }
                  >
                    {currentCopy.description}
                  </Text>
                </View>

                <View style={styles.progressSection}>
                  <View style={styles.progressRow}>
                    {TRACKING_STEPS.map(
                      (step, index) => {
                        const completed =
                          currentStage > index;
                        const active =
                          currentStage === index;
                        const reached =
                          completed || active;

                        return (
                          <Fragment key={step.key}>
                            <View
                              style={styles.progressStep}
                            >
                              <View
                                style={[
                                  styles.progressCircle,
                                  reached &&
                                    styles.progressCircleReached,
                                  active &&
                                    styles.progressCircleActive,
                                ]}
                              >
                                {completed ? (
                                  <Ionicons
                                    color="#FFFFFF"
                                    name="checkmark"
                                    size={13}
                                  />
                                ) : (
                                  <Ionicons
                                    color={
                                      reached
                                        ? '#FFFFFF'
                                        : '#AAAAAA'
                                    }
                                    name={step.icon}
                                    size={12}
                                  />
                                )}
                              </View>

                              <Text
                                numberOfLines={2}
                                style={[
                                  styles.progressLabel,
                                  reached &&
                                    styles.progressLabelReached,
                                ]}
                              >
                                {step.title}
                              </Text>
                            </View>

                            {index <
                            TRACKING_STEPS.length - 1 ? (
                              <View
                                style={[
                                  styles.progressConnector,
                                  currentStage > index &&
                                    styles.progressConnectorReached,
                                ]}
                              />
                            ) : null}
                          </Fragment>
                        );
                      },
                    )}
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.contentSheet}>
          {refreshError ? (
            <View style={styles.refreshErrorCard}>
              <Ionicons
                color="#9A6516"
                name="cloud-offline-outline"
                size={17}
              />
              <Text style={styles.refreshErrorText}>
                تعذر تحديث الحالة الآن. سيتم المحاولة تلقائيًا مرة أخرى.
              </Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                color={NAVIENTY_NOW_COLORS.primary}
                name="location-outline"
                size={18}
              />
              <Text style={styles.sectionTitle}>
                عنوان الاستلام والتوصيل
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoMainText}>
                {booking.address}
              </Text>
              {booking.landmark ? (
                <Text style={styles.infoSubText}>
                  علامة مميزة: {booking.landmark}
                </Text>
              ) : null}
              {booking.serviceAreaName ? (
                <Text style={styles.infoSubText}>
                  {booking.serviceAreaName}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                color={NAVIENTY_NOW_COLORS.primary}
                name="receipt-outline"
                size={18}
              />
              <Text style={styles.sectionTitle}>
                تفاصيل الحجز
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  الباقة
                </Text>
                <Text
                  numberOfLines={2}
                  style={styles.summaryValue}
                >
                  {booking.packageNameAr}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  طريقة الدفع
                </Text>
                <Text style={styles.summaryValue}>
                  {booking.paymentMethodNameAr}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>
                  الإجمالي
                </Text>
                <Text style={styles.totalValue}>
                  {formattedPrice}
                </Text>
              </View>
            </View>
          </View>

          {!isCancelled && !isDelivered ? (
            <Pressable
              disabled={isOpeningCancellation}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed &&
                  !isOpeningCancellation &&
                  styles.buttonPressed,
                isOpeningCancellation &&
                  styles.disabled,
              ]}
              onPress={requestCancellation}
            >
              <Text style={styles.cancelButtonText}>
                طلب إلغاء الحجز
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.homeButton,
              pressed &&
                styles.homeButtonPressed,
            ]}
            onPress={returnToHome}
          >
            <Text style={styles.homeButtonText}>
              العودة للرئيسية
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    paddingBottom: 26,
    paddingHorizontal: 18,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  closeButtonPressed: {
    opacity: 0.8,
  },
  heroTitleGroup: {
    alignItems: 'center',
  },
  heroBrand: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 19,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  headerSpacer: {
    height: 44,
    width: 44,
  },
  trackingCard: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderRadius: 25,
    padding: 18,
  },
  trackingTopRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
  },
  serviceLogo: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 17,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  serviceLogoImage: {
    height: '100%',
    width: '100%',
  },
  trackingHeading: {
    flex: 1,
  },
  trackingServiceName: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  bookingCode: {
    color: NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'right',
  },
  currentStatus: {
    marginTop: 18,
  },
  currentStatusTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  currentStatusDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'right',
  },
  progressSection: {
    marginTop: 20,
  },
  progressRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  progressStep: {
    alignItems: 'center',
    width: 48,
  },
  progressCircle: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  progressCircleReached: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
  },
  progressCircleActive: {
    borderColor:
      NAVIENTY_NOW_COLORS.primaryDark,
    borderWidth: 2,
  },
  progressLabel: {
    color: '#A0A0A0',
    fontSize: 8.5,
    fontWeight: '700',
    lineHeight: 12,
    marginTop: 7,
    textAlign: 'center',
  },
  progressLabelReached: {
    color: NAVIENTY_NOW_COLORS.text,
  },
  progressConnector: {
    backgroundColor: '#EAEAEA',
    flex: 1,
    height: 2,
    marginHorizontal: -5,
    marginTop: 16,
  },
  progressConnectorReached: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
  },
  cancelledCard: {
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    borderRadius: 16,
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 18,
    padding: 13,
  },
  cancelledIcon: {
    alignItems: 'center',
    backgroundColor: '#D64B4B',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  cancelledContent: {
    flex: 1,
  },
  cancelledTitle: {
    color: '#A63535',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  cancelledDescription: {
    color: '#8A5A5A',
    fontSize: 10.5,
    lineHeight: 16,
    marginTop: 3,
    textAlign: 'right',
  },
  contentSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    flex: 1,
    marginTop: -1,
    paddingBottom: 34,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  refreshErrorCard: {
    alignItems: 'center',
    backgroundColor: '#FFF7E8',
    borderRadius: 14,
    flexDirection: 'row-reverse',
    gap: 9,
    marginBottom: 18,
    padding: 12,
  },
  refreshErrorText: {
    color: '#8A651F',
    flex: 1,
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: 'right',
  },
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 7,
    marginBottom: 10,
  },
  sectionTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  infoCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 17,
    padding: 14,
  },
  infoMainText: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 12.5,
    fontWeight: '800',
    lineHeight: 19,
    textAlign: 'right',
  },
  infoSubText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10.5,
    lineHeight: 16,
    marginTop: 5,
    textAlign: 'right',
  },
  summaryCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 17,
    paddingHorizontal: 14,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 14,
    justifyContent: 'space-between',
    minHeight: 52,
  },
  summaryLabel: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  summaryValue: {
    color: NAVIENTY_NOW_COLORS.text,
    flex: 1,
    fontSize: 11.5,
    fontWeight: '800',
    textAlign: 'left',
  },
  summaryDivider: {
    backgroundColor: '#EAEAEA',
    height: StyleSheet.hairlineWidth,
  },
  totalLabel: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },
  totalValue: {
    color: NAVIENTY_NOW_COLORS.primary,
    fontSize: 14.5,
    fontWeight: '900',
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#E6BABA',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  cancelButtonText: {
    color: '#B13D3D',
    fontSize: 12.5,
    fontWeight: '900',
  },
  homeButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 52,
  },
  homeButtonPressed: {
    opacity: 0.88,
  },
  homeButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 14,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  stateIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 27,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  stateTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 15,
    textAlign: 'center',
  },
  stateDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11.5,
    lineHeight: 18,
    marginTop: 7,
    textAlign: 'center',
  },
  statePrimaryButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 15,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 24,
  },
  statePrimaryButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 13,
    fontWeight: '900',
  },
  stateSecondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 9,
    minHeight: 42,
    paddingHorizontal: 20,
  },
  stateSecondaryButtonText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
});
