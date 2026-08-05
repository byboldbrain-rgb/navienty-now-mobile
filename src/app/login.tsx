import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    useEffect,
    useState,
} from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { useAuthSession } from '../hooks/use-auth-session';
import { supabase } from '../lib/supabase';
import {
    NAVIENTY_NOW_COLORS,
    NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

const navientyNowLogo = require('../assets/images/navienty-now-logo.jpg');

type AuthStep = 'phone' | 'otp';

type FormMessage =
  | {
      type: 'error';
      text: string;
    }
  | {
      type: 'success';
      text: string;
    }
  | null;

function normalizeEgyptianPhone(
  value: string,
): string | null {
  const digits = value.replace(/\D/g, '');

  if (/^01[0125]\d{8}$/.test(digits)) {
    return `+2${digits}`;
  }

  if (/^201[0125]\d{8}$/.test(digits)) {
    return `+${digits}`;
  }

  return null;
}

function maskPhone(phone: string): string {
  if (phone.length < 8) {
    return phone;
  }

  return `${phone.slice(0, 5)}••••${phone.slice(-3)}`;
}

export default function LoginScreen() {
  const router = useRouter();
  const authState = useAuthSession();

  const [step, setStep] =
    useState<AuthStep>('phone');
  const [fullName, setFullName] =
    useState('');
  const [phoneInput, setPhoneInput] =
    useState('');
  const [verifiedPhone, setVerifiedPhone] =
    useState<string | null>(null);
  const [otpCode, setOtpCode] =
    useState('');
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [formMessage, setFormMessage] =
    useState<FormMessage>(null);

  useEffect(() => {
    if (authState.status === 'signedIn') {
      router.replace('/');
    }
  }, [authState.status, router]);

  const normalizedPhone =
    normalizeEgyptianPhone(phoneInput);

  const phoneFormIsValid =
    normalizedPhone !== null;

  const otpFormIsValid =
    /^\d{6}$/.test(otpCode);

  async function sendOtp() {
    setFormMessage(null);

    if (!normalizedPhone) {
      setFormMessage({
        type: 'error',
        text:
          'اكتب رقم موبايل مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015.',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const metadata = fullName.trim()
        ? {
            full_name: fullName.trim(),
          }
        : undefined;

      const { error } =
        await supabase.auth.signInWithOtp({
          phone: normalizedPhone,
          options: {
            data: metadata,
            shouldCreateUser: true,
          },
        });

      if (error) {
        throw error;
      }

      setVerifiedPhone(normalizedPhone);
      setStep('otp');
      setOtpCode('');
      setFormMessage({
        type: 'success',
        text:
          'تم إرسال رمز التحقق إلى رقم الموبايل.',
      });
    } catch (error) {
      setFormMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'تعذر إرسال رمز التحقق.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyOtp() {
    setFormMessage(null);

    if (!verifiedPhone || !otpFormIsValid) {
      setFormMessage({
        type: 'error',
        text: 'اكتب رمز التحقق المكوّن من 6 أرقام.',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } =
        await supabase.auth.verifyOtp({
          phone: verifiedPhone,
          token: otpCode,
          type: 'sms',
        });

      if (error) {
        throw error;
      }

      router.replace('/');
    } catch (error) {
      setFormMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'تعذر التحقق من الرمز.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function editPhone() {
    setStep('phone');
    setVerifiedPhone(null);
    setOtpCode('');
    setFormMessage(null);
  }

  if (
    authState.status === 'loading' ||
    authState.status === 'signedIn'
  ) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <Image
          accessibilityLabel="شعار Navienty Now"
          resizeMode="contain"
          source={navientyNowLogo}
          style={styles.loadingLogo}
        />
        <Text style={styles.loadingText}>
          جاري التحقق من الحساب...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
      style={styles.screen}
    >
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityLabel="العودة"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.backIcon}>›</Text>
            </Pressable>

            <Text style={styles.topBarTitle}>
              حساب Navienty Now
            </Text>

            <View style={styles.topBarSpacer} />
          </View>

          <View style={styles.brandBlock}>
            <Image
              accessibilityLabel="شعار Navienty Now"
              resizeMode="contain"
              source={navientyNowLogo}
              style={styles.logo}
            />

            <Text style={styles.pageTitle}>
              {step === 'phone'
                ? 'سجّل الدخول برقمك'
                : 'أدخل رمز التحقق'}
            </Text>

            <Text style={styles.pageDescription}>
              {step === 'phone'
                ? 'سنرسل لك رمزًا قصيرًا عبر رسالة SMS. التصفح يظل متاحًا دون تسجيل الدخول.'
                : `أرسلنا رمزًا من 6 أرقام إلى ${
                    verifiedPhone
                      ? maskPhone(verifiedPhone)
                      : 'رقمك'
                  }.`}
            </Text>
          </View>

          <View style={styles.formCard}>
            {step === 'phone' ? (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    الاسم — اختياري
                  </Text>
                  <TextInput
                    accessibilityLabel="الاسم اختياري"
                    autoCapitalize="words"
                    placeholder="اكتب اسمك"
                    placeholderTextColor={
                      NAVIENTY_NOW_COLORS.textMuted
                    }
                    selectionColor={
                      NAVIENTY_NOW_COLORS.primary
                    }
                    style={styles.input}
                    textContentType="name"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    رقم الموبايل
                  </Text>

                  <View style={styles.phoneField}>
                    <View style={styles.countryCode}>
                      <Text
                        style={styles.countryCodeText}
                      >
                        +20
                      </Text>
                    </View>

                    <TextInput
                      accessibilityLabel="رقم الموبايل المصري"
                      keyboardType="phone-pad"
                      maxLength={15}
                      placeholder="01012345678"
                      placeholderTextColor={
                        NAVIENTY_NOW_COLORS.textMuted
                      }
                      returnKeyType="done"
                      selectionColor={
                        NAVIENTY_NOW_COLORS.primary
                      }
                      style={styles.phoneInput}
                      textContentType="telephoneNumber"
                      value={phoneInput}
                      onChangeText={setPhoneInput}
                      onSubmitEditing={() => {
                        if (phoneFormIsValid) {
                          void sendOtp();
                        }
                      }}
                    />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.otpLabel}>
                  رمز التحقق
                </Text>

                <TextInput
                  accessibilityLabel="رمز التحقق المكوّن من 6 أرقام"
                  autoFocus
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor="#B9B9BE"
                  returnKeyType="done"
                  selectionColor={
                    NAVIENTY_NOW_COLORS.primary
                  }
                  style={styles.otpInput}
                  textContentType="oneTimeCode"
                  value={otpCode}
                  onChangeText={(value) => {
                    setOtpCode(
                      value
                        .replace(/\D/g, '')
                        .slice(0, 6),
                    );
                  }}
                  onSubmitEditing={() => {
                    if (otpFormIsValid) {
                      void verifyOtp();
                    }
                  }}
                />

                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.editPhoneButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={editPhone}
                >
                  <Text
                    style={styles.editPhoneText}
                  >
                    تعديل رقم الموبايل
                  </Text>
                </Pressable>
              </>
            )}

            {formMessage && (
              <View
                style={[
                  styles.messageCard,
                  formMessage.type ===
                    'success'
                    ? styles.successMessageCard
                    : styles.errorMessageCard,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    formMessage.type ===
                      'success'
                      ? styles.successMessageText
                      : styles.errorMessageText,
                  ]}
                >
                  {formMessage.text}
                </Text>
              </View>
            )}

            <Pressable
              accessibilityLabel={
                step === 'phone'
                  ? 'إرسال رمز التحقق'
                  : 'تأكيد رمز التحقق'
              }
              accessibilityRole="button"
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.submitButton,
                isSubmitting &&
                  styles.submitButtonDisabled,
                pressed &&
                  !isSubmitting &&
                  styles.submitButtonPressed,
              ]}
              onPress={() => {
                if (step === 'phone') {
                  void sendOtp();
                } else {
                  void verifyOtp();
                }
              }}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting
                  ? 'جاري التنفيذ...'
                  : step === 'phone'
                    ? 'إرسال الرمز'
                    : 'تأكيد الدخول'}
              </Text>
            </Pressable>

            {step === 'otp' && (
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.resendButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  void sendOtp();
                }}
              >
                <Text style={styles.resendButtonText}>
                  إعادة إرسال الرمز
                </Text>
              </Pressable>
            )}

            <Text style={styles.providerNotice}>
              يتطلب هذا المسار تفعيل Phone Auth ومزوّد SMS داخل Supabase.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.guestButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.guestButtonText}>
              متابعة التصفح كزائر
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    flex: 1,
  },

  pageContent: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingTop:
      Platform.OS === 'ios' ? 28 : 18,
  },

  container: {
    alignSelf: 'center',
    maxWidth: 470,
    width: '100%',
  },

  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },

  backButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  backIcon: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 31,
    lineHeight: 32,
  },

  buttonPressed: {
    opacity: 0.58,
  },

  topBarTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },

  topBarSpacer: {
    width: 40,
  },

  brandBlock: {
    alignItems: 'center',
    marginTop: 23,
  },

  logo: {
    borderRadius: 25,
    height: 124,
    width: 124,
  },

  pageTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 27,
    fontWeight: '900',
    marginTop: 20,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  pageDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 21,
    marginTop: 7,
    maxWidth: 350,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  formCard: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    borderWidth: 1,
    marginTop: 27,
    padding: 20,
  },

  fieldGroup: {
    marginBottom: 17,
  },

  fieldLabel: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 7,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  input: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 15,
    borderWidth: 1,
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 14,
    minHeight: 52,
    paddingHorizontal: 15,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  phoneField: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    overflow: 'hidden',
  },

  countryCode: {
    alignItems: 'center',
    borderRightColor:
      NAVIENTY_NOW_COLORS.border,
    borderRightWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
  },

  countryCodeText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    writingDirection: 'ltr',
  },

  phoneInput: {
    color: NAVIENTY_NOW_COLORS.text,
    flex: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 15,
    textAlign: 'left',
    writingDirection: 'ltr',
  },

  otpLabel: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 9,
    textAlign: 'center',
  },

  otpInput: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 17,
    borderWidth: 1,
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 10,
    minHeight: 66,
    paddingHorizontal: 18,
    textAlign: 'center',
    writingDirection: 'ltr',
  },

  editPhoneButton: {
    alignSelf: 'center',
    justifyContent: 'center',
    marginTop: 11,
    minHeight: 38,
    paddingHorizontal: 8,
  },

  editPhoneText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },

  messageCard: {
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 15,
    marginTop: 4,
    padding: 12,
  },

  errorMessageCard: {
    backgroundColor: '#FFF5F5',
    borderColor: '#F1CCCC',
  },

  successMessageCard: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryUltraPale,
    borderColor: '#CDEAD8',
  },

  messageText: {
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  errorMessageText: {
    color: '#A13838',
  },

  successMessageText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
  },

  submitButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
  },

  submitButtonDisabled: {
    opacity: 0.62,
  },

  submitButtonPressed: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPressed,
    transform: [{ scale: 0.99 }],
  },

  submitButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 14,
    fontWeight: '900',
  },

  resendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 42,
  },

  resendButtonText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },

  providerNotice: {
    color: NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 9,
    lineHeight: 15,
    marginTop: 10,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  guestButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 44,
  },

  guestButtonText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },

  loadingScreen: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.page,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  loadingLogo: {
    borderRadius: 24,
    height: 112,
    width: 112,
  },

  loadingText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 12,
    marginTop: 18,
  },
});
