import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';

import {
  ensureAppSession,
} from '../../services/anonymous-auth-service';
import getAppBootstrap, {
  type AppBootstrap,
} from '../../services/bootstrap-service';
import {
  buildWhatsAppUrl,
} from '../../services/promo-action-service';
import {
  cancelServiceBookingAfterOpenFailure,
  createServiceBooking,
  markServiceBookingWhatsAppOpened,
  type ServiceBooking,
} from '../../services/service-bookings-service';
import getServicePackageById, {
  type ServicePackage,
} from '../../services/service-packages-service';
import { useCustomerStore } from '../../store/customer-store';
import { CheckoutScreenSkeleton } from '../ui/loading-skeleton';

type ServicePackageCheckoutProps = {
  servicePackageId: string;
};

const BRAND_GREEN = '#00B14F';
const BRAND_GREEN_DARK = '#009B45';
const BRAND_GREEN_SOFT = '#EAF8F0';

const PAYMENT_METHOD_IMAGES:
  Record<string, ImageSourcePropType> = {
    'vodafone-cash': require(
      '../../../assets/payment-methods/vodafone-cash.png',
    ),
    'orange-cash': require(
      '../../../assets/payment-methods/orange-cash.png',
    ),
    'etisalat-cash': require(
      '../../../assets/payment-methods/etisalat-cash.png',
    ),
    instapay: require(
      '../../../assets/payment-methods/instapay.png',
    ),
  };

function formatPrice(
  value: number,
  currencySymbol: string,
) {
  if (Number.isInteger(value)) {
    return `${value} ${currencySymbol}`;
  }

  return `${value.toFixed(2)} ${currencySymbol}`;
}

function isRemoteImageUri(
  value: string | null | undefined,
) {
  if (!value) {
    return false;
  }

  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('data:image/')
  );
}

export default function ServicePackageCheckout({
  servicePackageId,
}: ServicePackageCheckoutProps) {
  const router = useRouter();

  const customerName = useCustomerStore(
    (state) => state.customerName,
  );
  const phoneNumber = useCustomerStore(
    (state) => state.phoneNumber,
  );
  const address = useCustomerStore(
    (state) => state.address,
  );
  const landmark = useCustomerStore(
    (state) => state.landmark,
  );
  const paymentMethod = useCustomerStore(
    (state) => state.paymentMethod,
  );
  const locationServiceAreaName =
    useCustomerStore(
      (state) =>
        state.locationServiceAreaName,
    );

  const setCustomerName = useCustomerStore(
    (state) => state.setCustomerName,
  );
  const setPhoneNumber = useCustomerStore(
    (state) => state.setPhoneNumber,
  );
  const setAddress = useCustomerStore(
    (state) => state.setAddress,
  );
  const setLandmark = useCustomerStore(
    (state) => state.setLandmark,
  );
  const setPaymentMethod = useCustomerStore(
    (state) => state.setPaymentMethod,
  );

  const [bootstrap, setBootstrap] =
    useState<AppBootstrap | null>(null);
  const [
    servicePackage,
    setServicePackage,
  ] = useState<ServicePackage | null>(null);
  const [isLoading, setIsLoading] =
    useState(true);
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);
  const [submitted, setSubmitted] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const [
          loadedBootstrap,
          loadedPackage,
        ] = await Promise.all([
          getAppBootstrap(),
          getServicePackageById(
            servicePackageId,
          ),
        ]);

        if (cancelled) {
          return;
        }

        setBootstrap(loadedBootstrap);

        if (!loadedPackage) {
          setServicePackage(null);
          setErrorMessage(
            'الخدمة غير متاحة حاليًا.',
          );
          return;
        }

        setServicePackage(loadedPackage);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setBootstrap(null);
        setServicePackage(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل بيانات الحجز.',
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [servicePackageId]);

  useEffect(() => {
    if (!bootstrap || !paymentMethod) {
      return;
    }

    const paymentMethodExists =
      bootstrap.payment_methods.some(
        (method) =>
          method.id === paymentMethod,
      );

    if (!paymentMethodExists) {
      setPaymentMethod(null);
    }
  }, [
    bootstrap,
    paymentMethod,
    setPaymentMethod,
  ]);

  const paymentMethods =
    bootstrap?.payment_methods ?? [];

  const selectedPaymentMethod = useMemo(
    () =>
      paymentMethods.find(
        (method) =>
          method.id === paymentMethod,
      ) ?? null,
    [paymentMethod, paymentMethods],
  );

  const normalizedPhone =
    phoneNumber.replace(/\D/g, '');

  const validation = {
    customerName:
      customerName.trim().length >= 2,
    phoneNumber:
      /^01[0125]\d{8}$/.test(
        normalizedPhone,
      ),
    address:
      address.trim().length >= 5,
    paymentMethod:
      selectedPaymentMethod !== null,
  };

  const formIsValid =
    validation.customerName &&
    validation.phoneNumber &&
    validation.address &&
    validation.paymentMethod;

  async function submitBooking() {
    setSubmitted(true);

    if (
      !bootstrap ||
      !servicePackage ||
      !selectedPaymentMethod ||
      !formIsValid ||
      isSubmitting
    ) {
      return;
    }

    const whatsappNumber =
      bootstrap.settings.support_whatsapp ||
      bootstrap.settings.whatsapp_number ||
      '';

    if (!whatsappNumber) {
      Alert.alert(
        'رقم واتساب غير متاح',
        'لم يتم إعداد رقم واتساب للحجوزات في إعدادات التطبيق.',
      );
      return;
    }

    const whatsappMessage =
      `عاوز اكد حجز ${servicePackage.nameAr} وهدفع من خلال ${selectedPaymentMethod.name_ar}`;

    const whatsappUrl = buildWhatsAppUrl(
      whatsappNumber,
      whatsappMessage,
    );

    if (!whatsappUrl) {
      Alert.alert(
        'تعذر فتح واتساب',
        'رقم واتساب غير صالح.',
      );
      return;
    }

    let createdBooking:
      ServiceBooking | null = null;
    let whatsappOpened = false;

    try {
      setIsSubmitting(true);

      await ensureAppSession();

      createdBooking =
        await createServiceBooking({
          servicePackageId:
            servicePackage.id,
          packageSlug:
            servicePackage.slug,
          packageNameAr:
            servicePackage.nameAr,
          packageNameEn:
            servicePackage.nameEn,
          packagePrice:
            servicePackage.price,
          currencyCode:
            servicePackage.currencyCode,
          currencySymbol:
            servicePackage.currencySymbol,
          packageImageUrl:
            servicePackage.imageUrl,
          paymentMethodId:
            selectedPaymentMethod.id,
          paymentMethodNameAr:
            selectedPaymentMethod.name_ar,
          customerName:
            customerName.trim(),
          customerPhone:
            normalizedPhone,
          address:
            address.trim(),
          landmark:
            landmark.trim() || null,
          serviceAreaName:
            locationServiceAreaName?.trim() ||
            null,
          whatsappNumber,
        });

      await Linking.openURL(whatsappUrl);
      whatsappOpened = true;

      try {
        createdBooking =
          await markServiceBookingWhatsAppOpened(
            createdBooking.id,
          );
      } catch (confirmationError) {
        console.warn(
          'Unable to mark service booking WhatsApp as opened.',
          confirmationError,
        );
      }

      router.replace({
        pathname: '/order-success',
        params: {
          serviceBookingId:
            createdBooking.id,
        },
      });
    } catch (error) {
      if (
        createdBooking &&
        !whatsappOpened
      ) {
        try {
          await cancelServiceBookingAfterOpenFailure(
            createdBooking.id,
            'whatsapp_open_failed',
          );
        } catch {
          // Keep the original error visible.
        }
      }

      Alert.alert(
        whatsappOpened
          ? 'تم فتح واتساب'
          : 'تعذر إرسال الحجز',
        error instanceof Error
          ? error.message
          : 'حاول مرة أخرى.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <CheckoutScreenSkeleton />;
  }

  if (!bootstrap || !servicePackage) {
    return (
      <View style={styles.stateScreen}>
        <StatusBar style="dark" />

        <View style={styles.stateIcon}>
          <Ionicons
            color="#d64b4b"
            name="alert-circle-outline"
            size={23}
          />
        </View>

        <Text style={styles.stateTitle}>
          تعذر تحميل بيانات الطلب
        </Text>

        <Text style={styles.stateText}>
          {errorMessage ||
            'الخدمة غير متاحة حاليًا.'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.stateButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.back()}
        >
          <Text style={styles.stateButtonText}>
            رجوع
          </Text>
        </Pressable>
      </View>
    );
  }

  const formattedPrice = formatPrice(
    servicePackage.price,
    servicePackage.currencySymbol,
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="رجوع"
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={21}
              color="#262626"
            />
          </Pressable>

          <View style={styles.headerContent}>
            <Text style={styles.pageTitle}>
              إتمام الطلب
            </Text>
            <Text
              style={styles.pageSubtitle}
              numberOfLines={1}
            >
              {servicePackage.nameAr}
            </Text>
          </View>
        </View>

        <View style={styles.orderStoreSection}>
          <View style={styles.storeIconContainer}>
            {servicePackage.imageUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                source={{
                  uri: servicePackage.imageUrl,
                }}
                style={styles.storeImage}
                resizeMode="cover"
              />
            ) : (
              <Ionicons
                color={BRAND_GREEN}
                name="shirt-outline"
                size={22}
              />
            )}
          </View>

          <View style={styles.storeContent}>
            <Text style={styles.storeLabel}>
              طلبك من
            </Text>
            <Text
              style={styles.storeName}
              numberOfLines={1}
            >
              Navienty Now
            </Text>
            <Text style={styles.storeMeta}>
              {servicePackage.nameAr}
              {' • '}
              {formattedPrice}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            بيانات العميل
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              الاسم بالكامل
            </Text>
            <View
              style={[
                styles.inputContainer,
                submitted &&
                  !validation.customerName &&
                  styles.inputContainerError,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={17}
                color="#777777"
              />
              <TextInput
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="اكتب اسمك بالكامل"
                placeholderTextColor="#a1a1a1"
                textAlign="right"
              />
            </View>
            {submitted &&
            !validation.customerName ? (
              <Text style={styles.errorText}>
                اكتب الاسم بالكامل.
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              رقم الهاتف
            </Text>
            <View
              style={[
                styles.inputContainer,
                submitted &&
                  !validation.phoneNumber &&
                  styles.inputContainerError,
              ]}
            >
              <Ionicons
                name="call-outline"
                size={17}
                color="#777777"
              />
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholder="01xxxxxxxxx"
                placeholderTextColor="#a1a1a1"
                textAlign="right"
              />
            </View>
            {submitted &&
            !validation.phoneNumber ? (
              <Text style={styles.errorText}>
                اكتب رقم موبايل مصري صحيح.
              </Text>
            ) : null}
          </View>

          {locationServiceAreaName ? (
            <View style={styles.areaCard}>
              <View style={styles.areaIconContainer}>
                <Ionicons
                  name="location-outline"
                  size={17}
                  color={BRAND_GREEN}
                />
              </View>
              <View style={styles.areaContent}>
                <Text style={styles.areaLabel}>
                  منطقة الخدمة
                </Text>
                <Text style={styles.areaValue}>
                  {locationServiceAreaName}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              عنوان الاستلام
            </Text>
            <View
              style={[
                styles.inputContainer,
                styles.multilineContainer,
                submitted &&
                  !validation.address &&
                  styles.inputContainerError,
              ]}
            >
              <Ionicons
                name="home-outline"
                size={17}
                color="#777777"
                style={styles.multilineIcon}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                ]}
                value={address}
                onChangeText={setAddress}
                placeholder="شارع، رقم العمارة، الدور، رقم الشقة"
                placeholderTextColor="#a1a1a1"
                multiline
                numberOfLines={4}
                textAlign="right"
                textAlignVertical="top"
              />
            </View>
            {submitted &&
            !validation.address ? (
              <Text style={styles.errorText}>
                اكتب عنوانًا واضحًا ومفصلًا للاستلام.
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              علامة مميزة
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="navigate-outline"
                size={17}
                color="#777777"
              />
              <TextInput
                style={styles.input}
                value={landmark}
                onChangeText={setLandmark}
                placeholder="اختياري"
                placeholderTextColor="#a1a1a1"
                textAlign="right"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            طريقة الدفع
          </Text>
          <Text style={styles.sectionDescription}>
            اختر طريقة الدفع المناسبة لإتمام الطلب.
          </Text>

          <View style={styles.paymentMethods}>
            {paymentMethods.map((method) => {
              const selected =
                paymentMethod === method.id;

              const localImage =
                PAYMENT_METHOD_IMAGES[
                  method.code
                ] ?? null;

              const remoteImage =
                !localImage &&
                isRemoteImageUri(method.icon_url)
                  ? method.icon_url
                  : null;

              return (
                <Pressable
                  key={method.id}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.paymentMethod,
                    selected &&
                      styles.paymentMethodSelected,
                    pressed &&
                      styles.paymentMethodPressed,
                  ]}
                  onPress={() => {
                    setPaymentMethod(method.id);
                  }}
                >
                  <View
                    style={styles.paymentIconContainer}
                  >
                    {localImage ? (
                      <Image
                        source={localImage}
                        style={styles.paymentMethodImage}
                        resizeMode="cover"
                      />
                    ) : remoteImage ? (
                      <Image
                        source={{ uri: remoteImage }}
                        style={styles.paymentMethodImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.paymentIcon}>
                        {method.icon ?? '💳'}
                      </Text>
                    )}
                  </View>

                  <View style={styles.paymentContent}>
                    <Text style={styles.paymentTitle}>
                      {method.name_ar}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.radioOuter,
                      selected &&
                        styles.radioOuterSelected,
                    ]}
                  >
                    {selected ? (
                      <View style={styles.radioInner} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {submitted &&
          !validation.paymentMethod ? (
            <Text style={styles.paymentError}>
              اختر طريقة الدفع المناسبة.
            </Text>
          ) : null}
        </View>

        <View style={styles.orderSummarySection}>
          <Text style={styles.orderSummaryTitle}>
            تفاصيل الطلب
          </Text>

          <View style={styles.itemsSummary}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryItemContent}>
                <Text
                  style={styles.summaryItemName}
                  numberOfLines={2}
                >
                  {servicePackage.nameAr}
                </Text>
                <Text
                  style={styles.summaryItemQuantity}
                >
                  الكمية: 1
                </Text>
              </View>
              <Text style={styles.summaryItemPrice}>
                {formattedPrice}
              </Text>
            </View>
          </View>

          <View style={styles.itemsDivider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              الإجمالي
            </Text>
            <Text style={styles.totalValue}>
              {formattedPrice}
            </Text>
          </View>
        </View>

        <View style={styles.whatsAppNotice}>
          <View style={styles.whatsAppIconContainer}>
            <Ionicons
              name="logo-whatsapp"
              size={20}
              color={BRAND_GREEN}
            />
          </View>
          <View style={styles.whatsAppNoticeContent}>
            <Text style={styles.whatsAppNoticeTitle}>
              تأكيد الطلب عبر واتساب
            </Text>
            <Text
              style={styles.whatsAppNoticeDescription}
            >
              بعد الضغط على إرسال الطلب سيتم فتح واتساب برسالة جاهزة لتأكيد الحجز.
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.bottomTotalRow}>
          <Text style={styles.bottomTotalLabel}>
            الإجمالي
          </Text>
          <Text style={styles.bottomTotalValue}>
            {formattedPrice}
          </Text>
        </View>

        <Pressable
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.submitButton,
            pressed &&
              !isSubmitting &&
              styles.submitButtonPressed,
            isSubmitting &&
              styles.submitButtonDisabled,
          ]}
          onPress={() => {
            void submitBooking();
          }}
        >
          <Text style={styles.submitButtonText}>
            إرسال الطلب
          </Text>

          {isSubmitting ? (
            <ActivityIndicator
              color="#ffffff"
              size="small"
            />
          ) : (
            <Ionicons
              name="logo-whatsapp"
              size={18}
              color="#ffffff"
            />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  pageContent: {
    paddingBottom: 132,
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  stateIcon: {
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    marginBottom: 15,
    width: 50,
  },
  stateTitle: {
    color: '#202020',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    color: '#858585',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  stateButton: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: 15,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 24,
  },
  stateButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e7e7e7',
    borderRadius: 23,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  headerContent: {
    flex: 1,
    marginLeft: 14,
  },
  pageTitle: {
    color: '#202020',
    fontSize: 20,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: '#8a8a8a',
    fontSize: 12,
    marginTop: 2,
  },
  orderStoreSection: {
    alignItems: 'center',
    borderBottomColor: '#eeeeee',
    borderBottomWidth: 1,
    borderTopColor: '#eeeeee',
    borderTopWidth: 1,
    flexDirection: 'row',
    marginBottom: 3,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  storeIconContainer: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderColor: '#ededed',
    borderRadius: 15,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },
  storeImage: {
    height: '100%',
    width: '100%',
  },
  storeContent: {
    flex: 1,
    marginLeft: 12,
  },
  storeLabel: {
    color: '#929292',
    fontSize: 9.5,
  },
  storeName: {
    color: '#242424',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  storeMeta: {
    color: '#818181',
    fontSize: 10.5,
    marginTop: 4,
  },
  section: {
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
    paddingBottom: 5,
    paddingHorizontal: 20,
    paddingTop: 23,
  },
  sectionTitle: {
    color: '#242424',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'right',
  },
  sectionDescription: {
    color: '#858585',
    fontSize: 11.5,
    lineHeight: 18,
    marginBottom: 14,
    textAlign: 'right',
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#373737',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 7,
    textAlign: 'right',
  },
  inputContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e2e2',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: 13,
  },
  inputContainerError: {
    borderColor: '#d64b4b',
  },
  input: {
    color: '#242424',
    flex: 1,
    fontSize: 13,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 10,
    writingDirection: 'rtl',
  },
  multilineContainer: {
    alignItems: 'flex-start',
    minHeight: 104,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 13,
  },
  multilineIcon: {
    marginTop: 14,
  },
  errorText: {
    color: '#d64b4b',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 6,
    textAlign: 'right',
  },
  areaCard: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN_SOFT,
    borderColor: '#d6f0e1',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 17,
    padding: 12,
  },
  areaIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  areaContent: {
    flex: 1,
    marginHorizontal: 11,
  },
  areaLabel: {
    color: '#638370',
    fontSize: 9.5,
    textAlign: 'right',
  },
  areaValue: {
    color: '#1c5334',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
    textAlign: 'right',
  },
  paymentMethods: {
    gap: 9,
  },
  paymentMethod: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e1e1e1',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  paymentMethodSelected: {
    backgroundColor: BRAND_GREEN_SOFT,
    borderColor: BRAND_GREEN,
    borderWidth: 1.25,
  },
  paymentMethodPressed: {
    opacity: 0.78,
  },
  paymentIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 40,
  },
  paymentMethodImage: {
    height: '100%',
    width: '100%',
  },
  paymentIcon: {
    fontSize: 19,
  },
  paymentContent: {
    flex: 1,
    marginHorizontal: 11,
  },
  paymentTitle: {
    color: '#262626',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  radioOuter: {
    alignItems: 'center',
    borderColor: '#b7b7b7',
    borderRadius: 9,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  radioOuterSelected: {
    borderColor: BRAND_GREEN,
  },
  radioInner: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 4.5,
    height: 9,
    width: 9,
  },
  paymentError: {
    color: '#d64b4b',
    fontSize: 10,
    marginTop: 7,
    textAlign: 'right',
  },
  orderSummarySection: {
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 23,
  },
  orderSummaryTitle: {
    color: '#242424',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 17,
    textAlign: 'right',
  },
  itemsSummary: {
    gap: 13,
  },
  summaryItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItemContent: {
    flex: 1,
    marginRight: 13,
  },
  summaryItemName: {
    color: '#343434',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'right',
  },
  summaryItemQuantity: {
    color: '#939393',
    fontSize: 9.5,
    marginTop: 3,
    textAlign: 'right',
  },
  summaryItemPrice: {
    color: '#343434',
    fontSize: 11.5,
    fontWeight: '700',
  },
  itemsDivider: {
    backgroundColor: '#eeeeee',
    height: 1,
    marginVertical: 17,
  },
  totalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: '#202020',
    fontSize: 14.5,
    fontWeight: '800',
  },
  totalValue: {
    color: '#202020',
    fontSize: 16,
    fontWeight: '900',
  },
  whatsAppNotice: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN_SOFT,
    borderColor: '#d5f0e0',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 17,
    padding: 13,
  },
  whatsAppIconContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  whatsAppNoticeContent: {
    flex: 1,
    marginLeft: 11,
  },
  whatsAppNoticeTitle: {
    color: '#1e3d2c',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  whatsAppNoticeDescription: {
    color: '#638370',
    fontSize: 10.5,
    lineHeight: 16,
    marginTop: 3,
    textAlign: 'right',
  },
  bottomSpacer: {
    height: 28,
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#eeeeee',
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 9,
    position: 'absolute',
    right: 0,
  },
  bottomTotalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  bottomTotalLabel: {
    color: '#777777',
    fontSize: 10.5,
  },
  bottomTotalValue: {
    color: '#202020',
    fontSize: 14,
    fontWeight: '900',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: BRAND_GREEN,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonPressed: {
    backgroundColor: BRAND_GREEN_DARK,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
