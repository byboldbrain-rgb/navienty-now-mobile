import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppBottomNavigation from '../category/app-bottom-navigation';
import { AccountScreenSkeleton } from '../components/ui/loading-skeleton';
import { useAuthSession } from '../hooks/use-auth-session';
import { supabase } from '../lib/supabase';
import {
  cancelMyAccountDeletionRequest,
  getMyAccountDeletionRequest,
  requestAccountDeletion,
  type AccountDeletionRequest,
} from '../services/account-deletion-service';
import {
  ensureAppSession,
} from '../services/anonymous-auth-service';
import getAppBootstrap from '../services/bootstrap-service';
import { useCustomerStore } from '../store/customer-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

const PAGE_HORIZONTAL_PADDING = 16;

const FIELD_BACKGROUND = '#F8F8F8';
const FIELD_BORDER = '#E8E8E8';
const CARD_BORDER = '#ECECEC';

function formatDeletionDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    'ar-EG',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  );
}

function normalizeLegalUrl(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();

  if (
    !normalized ||
    !/^https:\/\//i.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

type ProfileFieldProps = {
  label: string;
  value: string;
  placeholder: string;

  icon:
    | 'person-outline'
    | 'call-outline'
    | 'location-outline'
    | 'navigate-outline';

  keyboardType?:
    | 'default'
    | 'phone-pad';

  onChangeText: (
    value: string,
  ) => void;
};

function ProfileField({
  label,
  value,
  placeholder,
  icon,
  keyboardType = 'default',
  onChangeText,
}: ProfileFieldProps) {
  const [
    isFocused,
    setIsFocused,
  ] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <View
        style={[
          styles.fieldControl,

          isFocused &&
            styles.fieldControlFocused,
        ]}
      >
        <View style={styles.fieldIconContainer}>
          <Ionicons
            color={
              isFocused
                ? NAVIENTY_NOW_COLORS.primary
                : '#8B8B8F'
            }
            name={icon}
            size={18}
          />
        </View>

        <TextInput
          accessibilityLabel={label}
          autoCorrect={false}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor="#A0A0A4"
          selectionColor={
            NAVIENTY_NOW_COLORS.primary
          }
          style={styles.fieldInput}
          value={value}
          onBlur={() => {
            setIsFocused(false);
          }}
          onChangeText={onChangeText}
          onFocus={() => {
            setIsFocused(true);
          }}
        />
      </View>
    </View>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const authState = useAuthSession();

  const customerName =
    useCustomerStore(
      (state) =>
        state.customerName,
    );

  const phoneNumber =
    useCustomerStore(
      (state) =>
        state.phoneNumber,
    );

  const address =
    useCustomerStore(
      (state) =>
        state.address,
    );

  const landmark =
    useCustomerStore(
      (state) =>
        state.landmark,
    );

  const setCustomerName =
    useCustomerStore(
      (state) =>
        state.setCustomerName,
    );

  const setPhoneNumber =
    useCustomerStore(
      (state) =>
        state.setPhoneNumber,
    );

  const setAddress =
    useCustomerStore(
      (state) =>
        state.setAddress,
    );

  const setLandmark =
    useCustomerStore(
      (state) =>
        state.setLandmark,
    );

  const [
    isSigningOut,
    setIsSigningOut,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    deletionRequest,
    setDeletionRequest,
  ] = useState<AccountDeletionRequest | null>(
    null,
  );

  const [
    isLoadingDeletionRequest,
    setIsLoadingDeletionRequest,
  ] = useState(false);

  const [
    isSubmittingDeletionRequest,
    setIsSubmittingDeletionRequest,
  ] = useState(false);

  const [
    isCancellingDeletionRequest,
    setIsCancellingDeletionRequest,
  ] = useState(false);

  const [
    privacyUrl,
    setPrivacyUrl,
  ] = useState<string | null>(null);

  const [
    termsUrl,
    setTermsUrl,
  ] = useState<string | null>(null);

  const isPermanentAccount =
    authState.status === 'signedIn';

  const hasCustomerSession =
    isPermanentAccount ||
    authState.status === 'anonymous';

  const authUserId =
    hasCustomerSession
      ? authState.session.user.id
      : null;

  const hasActiveDeletionRequest =
    deletionRequest?.status === 'pending' ||
    deletionRequest?.status === 'processing';

  useEffect(() => {
    let cancelled = false;

    async function loadLegalLinks() {
      try {
        const bootstrap =
          await getAppBootstrap();

        if (cancelled) {
          return;
        }

        setPrivacyUrl(
          normalizeLegalUrl(
            bootstrap.settings.privacy_url,
          ),
        );
        setTermsUrl(
          normalizeLegalUrl(
            bootstrap.settings.terms_url,
          ),
        );
      } catch (error) {
        console.warn(
          'Unable to load legal document links.',
          error,
        );
      }
    }

    void loadLegalLinks();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!authUserId) {
      return () => {
        cancelled = true;
      };
    }

    async function loadDeletionRequest() {
      try {
        setIsLoadingDeletionRequest(true);

        const request =
          await getMyAccountDeletionRequest();

        if (!cancelled) {
          setDeletionRequest(request);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'تعذر تحميل حالة طلب حذف الحساب.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDeletionRequest(false);
        }
      }
    }

    void loadDeletionRequest();

    return () => {
      cancelled = true;
    };
  }, [authUserId]);

  async function openLegalDocument(
    title: string,
    url: string | null,
  ) {
    if (!url) {
      Alert.alert(
        title,
        'الرابط غير متاح حاليًا. تواصل مع دعم Navienty Now للحصول على نسخة.',
      );
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        `تعذر فتح ${title}`,
        error instanceof Error
          ? error.message
          : 'حاول مرة أخرى.',
      );
    }
  }

  async function submitAccountDeletionRequest() {
    if (
      !hasCustomerSession ||
      isSubmittingDeletionRequest ||
      hasActiveDeletionRequest
    ) {
      return;
    }

    try {
      setIsSubmittingDeletionRequest(true);
      setErrorMessage(null);

      const request =
        await requestAccountDeletion();

      setDeletionRequest(request);

      Alert.alert(
        'تم تسجيل طلب الحذف',
        `موعد الإكمال المستهدف: ${formatDeletionDate(
          request.targetCompletionAt,
        )}.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر إرسال طلب حذف الحساب.',
      );
    } finally {
      setIsSubmittingDeletionRequest(false);
    }
  }

  function confirmAccountDeletionRequest() {
    if (
      !hasCustomerSession ||
      isSubmittingDeletionRequest ||
      hasActiveDeletionRequest
    ) {
      return;
    }

    Alert.alert(
      'حذف الحساب والبيانات',
      'سيتم حذف الحساب والبيانات الشخصية المرتبطة به، بما في ذلك حساب الضيف. قد نحتفظ فقط بالسجلات التي يلزم الاحتفاظ بها قانونيًا أو محاسبيًا بعد إزالة البيانات التي تعرّف بك. يمكنك إلغاء الطلب قبل بدء المعالجة.',
      [
        {
          text: 'رجوع',
          style: 'cancel',
        },
        {
          text: 'طلب حذف الحساب',
          style: 'destructive',
          onPress: () => {
            void submitAccountDeletionRequest();
          },
        },
      ],
    );
  }

  async function cancelDeletionRequest() {
    if (
      deletionRequest?.status !== 'pending' ||
      isCancellingDeletionRequest
    ) {
      return;
    }

    try {
      setIsCancellingDeletionRequest(true);
      setErrorMessage(null);

      const cancelled =
        await cancelMyAccountDeletionRequest();

      if (!cancelled) {
        throw new Error(
          'تعذر إلغاء الطلب لأنه بدأ المعالجة بالفعل.',
        );
      }

      setDeletionRequest({
        ...deletionRequest,
        status: 'cancelled',
        cancelledAt:
          new Date().toISOString(),
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر إلغاء طلب حذف الحساب.',
      );
    } finally {
      setIsCancellingDeletionRequest(false);
    }
  }

  function confirmCancelDeletionRequest() {
    Alert.alert(
      'إلغاء طلب الحذف',
      'هل تريد الاحتفاظ بحسابك وإلغاء طلب الحذف؟',
      [
        {
          text: 'رجوع',
          style: 'cancel',
        },
        {
          text: 'إلغاء طلب الحذف',
          onPress: () => {
            void cancelDeletionRequest();
          },
        },
      ],
    );
  }

  async function signOutPermanentAccount() {
    if (
      !isPermanentAccount ||
      isSigningOut
    ) {
      return;
    }

    try {
      setIsSigningOut(true);
      setErrorMessage(null);

      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      /*
       * بعد تسجيل الخروج بننشئ جلسة
       * anonymous جديدة علشان المستخدم
       * يقدر يكمل استخدام التطبيق والطلب.
       */
      await ensureAppSession();

      router.replace('/');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تسجيل الخروج.',
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  if (authState.status === 'loading') {
    return (
      <>
        <StatusBar style="dark" />

        <AccountScreenSkeleton />
      </>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={styles.screen}
    >
      <StatusBar style="dark" />

      <View style={styles.pageShell}>
        <ScrollView
          contentContainerStyle={
            styles.pageContent
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          {/* ======================================= */}
          {/* HEADER                                  */}
          {/* ======================================= */}

          <View style={styles.header}>
            <Pressable
              accessibilityLabel="العودة"
              accessibilityRole="button"
              hitSlop={10}
              style={({ pressed }) => [
                styles.backButton,

                pressed &&
                  styles.backButtonPressed,
              ]}
              onPress={() => {
                router.back();
              }}
            >
              <Ionicons
                color="#242424"
                name="arrow-back"
                size={22}
              />
            </Pressable>
          </View>

          {/* ======================================= */}
          {/* PAGE HEADING                            */}
          {/* ======================================= */}

          <View style={styles.pageHeading}>
            <Text style={styles.pageTitle}>
              حسابي
            </Text>


          </View>

          {/* ======================================= */}
          {/* DELIVERY DETAILS                       */}
          {/* ======================================= */}

          <View style={styles.formCard}>
            <View
              style={styles.formCardHeader}
            >
              <View
                style={styles.formHeading}
              >
                <Text
                  style={
                    styles.formHeadingTitle
                  }
                >
                  بيانات التوصيل
                </Text>


              </View>


            </View>

            <View
              style={styles.formDivider}
            />

            <View
              style={styles.fieldsContainer}
            >
              <ProfileField
                icon="person-outline"
                label="الاسم"
                placeholder="اكتب اسمك"
                value={customerName}
                onChangeText={
                  setCustomerName
                }
              />

              <ProfileField
                icon="call-outline"
                keyboardType="phone-pad"
                label="رقم الهاتف"
                placeholder="01012345678"
                value={phoneNumber}
                onChangeText={
                  setPhoneNumber
                }
              />

              <ProfileField
                icon="location-outline"
                label="عنوان التوصيل"
                placeholder="اكتب عنوان التوصيل"
                value={address}
                onChangeText={
                  setAddress
                }
              />


            </View>


          </View>



          {/* ======================================= */}
          {/* PRIVACY AND TERMS                       */}
          {/* ======================================= */}



          {/* ======================================= */}
          {/* ACCOUNT DELETION                        */}
          {/* ======================================= */}



          {/* ======================================= */}
          {/* ERROR                                   */}
          {/* ======================================= */}

          {errorMessage && (
            <View style={styles.errorCard}>
              <Ionicons
                color={
                  NAVIENTY_NOW_COLORS.error
                }
                name="alert-circle-outline"
                size={18}
              />

              <Text
                style={styles.errorText}
              >
                {errorMessage}
              </Text>
            </View>
          )}

          {/* ======================================= */}
          {/* SIGN OUT                                */}
          {/* ======================================= */}

          {isPermanentAccount && (
            <View
              style={
                styles.accountActionsSection
              }
            >
              <View
                style={
                  styles.accountActionsDivider
                }
              />

              <Pressable
                accessibilityLabel="تسجيل الخروج"
                accessibilityRole="button"
                disabled={isSigningOut}
                style={({ pressed }) => [
                  styles.signOutButton,

                  isSigningOut &&
                    styles.signOutButtonDisabled,

                  pressed &&
                    !isSigningOut &&
                    styles.signOutButtonPressed,
                ]}
                onPress={() => {
                  void signOutPermanentAccount();
                }}
              >
                <View
                  style={
                    styles.signOutIconContainer
                  }
                >
                  {isSigningOut ? (
                    <ActivityIndicator
                      color={
                        NAVIENTY_NOW_COLORS.error
                      }
                      size="small"
                    />
                  ) : (
                    <Ionicons
                      color={
                        NAVIENTY_NOW_COLORS.error
                      }
                      name="log-out-outline"
                      size={19}
                    />
                  )}
                </View>

                <Text
                  style={
                    styles.signOutButtonText
                  }
                >
                  تسجيل الخروج
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>

      <AppBottomNavigation
        activeTab="account"
        isSignedIn={
          isPermanentAccount
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* ========================================================= */
  /* SCREEN                                                    */
  /* ========================================================= */

  screen: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,

    flex: 1,
  },

  pageShell: {
    alignSelf: 'center',

    backgroundColor:
      NAVIENTY_NOW_COLORS.white,

    flex: 1,

    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth,

    width: '100%',
  },

  pageContent: {
    flexGrow: 1,

    paddingBottom:
      NAVIENTY_NOW_LAYOUT.bottomNavigationHeight +
      48,

    paddingHorizontal:
      PAGE_HORIZONTAL_PADDING,
  },

  /* ========================================================= */
  /* HEADER                                                    */
  /* ========================================================= */

  header: {
    alignItems: 'center',

    flexDirection: 'row',

    minHeight: 66,

    paddingTop: 8,
  },

  backButton: {
    alignItems: 'center',

    backgroundColor:
      NAVIENTY_NOW_COLORS.white,

    borderColor: '#E1E1E1',

    borderRadius: 23,
    borderWidth: 1,

    height: 46,

    justifyContent: 'center',

    width: 46,
  },

  backButtonPressed: {
    backgroundColor: '#F7F7F7',

    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  /* ========================================================= */
  /* PAGE HEADING                                              */
  /* ========================================================= */

  pageHeading: {
    alignItems: 'flex-end',

    marginTop: 8,

    paddingHorizontal: 1,
  },

  pageTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,

    fontSize: 24,

    fontWeight: '800',

    letterSpacing: -0.45,

    textAlign: 'right',

    writingDirection: 'rtl',
  },

  pageSubtitle: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,

    fontSize: 12,

    lineHeight: 19,

    marginTop: 5,

    textAlign: 'right',

    writingDirection: 'rtl',
  },

  /* ========================================================= */
  /* FORM CARD                                                 */
  /* ========================================================= */

  formCard: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,

    borderColor: CARD_BORDER,

    borderRadius: 20,

    borderWidth: 1,

    marginTop: 24,

    paddingHorizontal: 15,

    paddingVertical: 16,
  },

  formCardHeader: {
    alignItems: 'center',

    flexDirection: 'row-reverse',

    justifyContent:
      'space-between',
  },

  formHeading: {
    alignItems: 'flex-end',

    flex: 1,

    paddingLeft: 12,
  },

  formHeadingTitle: {
    color:
      NAVIENTY_NOW_COLORS.text,

    fontSize: 15,

    fontWeight: '800',

    textAlign: 'right',

    writingDirection: 'rtl',
  },

  formHeadingDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,

    fontSize: 10,

    lineHeight: 16,

    marginTop: 3,

    textAlign: 'right',

    writingDirection: 'rtl',
  },

  savedBadge: {
    alignItems: 'center',

    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,

    borderRadius: 999,

    flexDirection: 'row-reverse',

    gap: 4,

    paddingHorizontal: 9,

    paddingVertical: 6,
  },

  savedBadgeText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,

    fontSize: 8.5,

    fontWeight: '800',
  },

  formDivider: {
    backgroundColor: '#EEEEEE',

    height:
      StyleSheet.hairlineWidth,

    marginTop: 15,
  },

  fieldsContainer: {
    paddingTop: 2,
  },

  /* ========================================================= */
  /* FIELD                                                     */
  /* ========================================================= */

  fieldGroup: {
    marginTop: 15,
  },

  fieldLabel: {
    color: '#47474A',

    fontSize: 11,

    fontWeight: '700',

    marginBottom: 7,

    marginRight: 2,

    textAlign: 'right',

    writingDirection: 'rtl',
  },

  fieldControl: {
    alignItems: 'center',

    backgroundColor:
      FIELD_BACKGROUND,

    borderColor: FIELD_BORDER,

    borderRadius: 14,

    borderWidth: 1,

    flexDirection: 'row-reverse',

    height: 52,

    paddingHorizontal: 12,
  },

  fieldControlFocused: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,

    borderColor:
      NAVIENTY_NOW_COLORS.primary,
  },

  fieldIconContainer: {
    alignItems: 'center',

    height: 30,

    justifyContent: 'center',

    marginLeft: 7,

    width: 28,
  },

  fieldInput: {
    color:
      NAVIENTY_NOW_COLORS.text,

    flex: 1,

    fontSize: 13,

    fontWeight: '400',

    height: '100%',

    paddingHorizontal: 0,

    paddingVertical: 0,

    textAlign: 'right',

    writingDirection: 'rtl',
  },

  /* ========================================================= */
  /* SAVE HINT                                                 */
  /* ========================================================= */

  autoSaveHint: {
    alignItems: 'center',

    flexDirection: 'row-reverse',

    marginTop: 16,

    paddingHorizontal: 2,
  },

  autoSaveHintText: {
    color: '#747478',

    flex: 1,

    fontSize: 9.5,

    lineHeight: 16,

    marginRight: 6,

    textAlign: 'right',

    writingDirection: 'rtl',
  },

  /* ========================================================= */
  /* NOTIFICATION DEV TOOLS                                    */
  /* ========================================================= */

  notificationDevCard: {
    alignItems: 'center',

    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,

    borderColor: '#D8EDE5',

    borderRadius: 16,
    borderWidth: 1,

    flexDirection: 'row-reverse',

    marginTop: 14,

    paddingHorizontal: 13,
    paddingVertical: 12,
  },

  notificationDevCardPressed: {
    opacity: 0.82,
  },

  notificationDevIcon: {
    alignItems: 'center',

    backgroundColor:
      NAVIENTY_NOW_COLORS.white,

    borderRadius: 12,

    height: 38,

    justifyContent: 'center',

    marginLeft: 10,

    width: 38,
  },

  notificationDevCopy: {
    alignItems: 'flex-end',

    flex: 1,
  },

  notificationDevTitle: {
    color: NAVIENTY_NOW_COLORS.text,

    fontSize: 12,
    fontWeight: '800',

    textAlign: 'right',
    writingDirection: 'rtl',
  },

  notificationDevDescription: {
    color: NAVIENTY_NOW_COLORS.textSecondary,

    fontSize: 9.5,
    lineHeight: 15,

    marginTop: 2,

    textAlign: 'right',
    writingDirection: 'rtl',
  },

  /* ========================================================= */
  /* PRIVACY AND ACCOUNT DELETION                              */
  /* ========================================================= */

  legalCard: {
    backgroundColor: '#F8FBFA',
    borderColor: '#DDEBE5',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 16,
    padding: 15,
  },

  legalHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
  },

  legalIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },

  legalHeadingCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 11,
  },

  legalTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  legalDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  legalLinks: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECE9',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 13,
    overflow: 'hidden',
  },

  legalLink: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 13,
  },

  legalLinkPressed: {
    opacity: 0.65,
  },

  legalLinkText: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  legalLinkDivider: {
    backgroundColor: '#EAEFED',
    height: StyleSheet.hairlineWidth,
  },

  deletionCard: {
    backgroundColor: '#FFF8F8',
    borderColor: '#EBCACA',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 16,
    padding: 15,
  },

  deletionHeadingRow: {
    alignItems: 'flex-start',
    flexDirection: 'row-reverse',
  },

  deletionIcon: {
    alignItems: 'center',
    backgroundColor: '#FDE8E8',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },

  deletionHeadingCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 11,
  },

  deletionTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  deletionDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  anonymousDeletionNote: {
    alignItems: 'center',
    backgroundColor: '#FFF9E8',
    borderColor: '#F0DDAA',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    marginTop: 12,
    padding: 10,
  },

  anonymousDeletionNoteText: {
    color: '#806724',
    flex: 1,
    fontSize: 9,
    lineHeight: 15,
    marginRight: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  deletionLoadingRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    marginTop: 15,
  },

  deletionLoadingText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
  },

  deletionStatusBox: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EEDDDD',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    padding: 13,
  },

  deletionStatusTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  deletionStatusText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 17,
    marginTop: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  deleteAccountButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.error,
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 15,
    minHeight: 48,
    paddingHorizontal: 16,
  },

  deleteAccountButtonPressed: {
    opacity: 0.82,
  },

  deleteAccountButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  cancelDeletionButton: {
    alignItems: 'center',
    borderColor: '#D8C7C7',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 11,
    minHeight: 42,
  },

  cancelDeletionButtonText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },

  deletionButtonDisabled: {
    opacity: 0.55,
  },

  /* ========================================================= */
  /* ERROR                                                     */
  /* ========================================================= */

  errorCard: {
    alignItems: 'center',

    backgroundColor: '#FFF7F7',

    borderColor: '#F1D6D6',

    borderRadius: 14,

    borderWidth: 1,

    flexDirection: 'row-reverse',

    marginTop: 14,

    paddingHorizontal: 12,

    paddingVertical: 11,
  },

  errorText: {
    color: '#A33E3E',

    flex: 1,

    fontSize: 10,

    lineHeight: 17,

    marginRight: 7,

    textAlign: 'right',

    writingDirection: 'rtl',
  },

  /* ========================================================= */
  /* ACCOUNT ACTIONS                                           */
  /* ========================================================= */

  accountActionsSection: {
    marginTop: 24,
  },

  accountActionsDivider: {
    backgroundColor: '#EEEEEE',

    height:
      StyleSheet.hairlineWidth,

    marginBottom: 10,
  },

  signOutButton: {
    alignItems: 'center',

    borderRadius: 14,

    flexDirection: 'row-reverse',

    justifyContent: 'flex-start',

    minHeight: 50,

    paddingHorizontal: 10,
  },

  signOutButtonPressed: {
    backgroundColor: '#FFF7F7',
  },

  signOutButtonDisabled: {
    opacity: 0.5,
  },

  signOutIconContainer: {
    alignItems: 'center',

    backgroundColor: '#FFF1F1',

    borderRadius: 12,

    height: 36,

    justifyContent: 'center',

    width: 36,
  },

  signOutButtonText: {
    color:
      NAVIENTY_NOW_COLORS.error,

    fontSize: 12,

    fontWeight: '700',

    marginRight: 11,

    textAlign: 'right',

    writingDirection: 'rtl',
  },
});
