import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppBottomNavigation from '../category/app-bottom-navigation';
import { AccountScreenSkeleton } from '../components/ui/loading-skeleton';
import { useAuthSession } from '../hooks/use-auth-session';
import { supabase } from '../lib/supabase';
import {
  ensureAppSession,
} from '../services/anonymous-auth-service';
import {
  cancelMyAccountDeletionRequest,
  getMyAccountDeletionRequest,
  requestAccountDeletion,
  type AccountDeletionRequest,
} from '../services/account-deletion-service';
import { useCustomerStore } from '../store/customer-store';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

const navientyNowLogo = require(
  '../assets/images/navienty-now-logo.jpg',
);

function getAccountDisplayName(
  authState: ReturnType<
    typeof useAuthSession
  >,
): string | null {
  if (authState.status !== 'signedIn') {
    return null;
  }

  const metadata =
    authState.session.user.user_metadata as Record<
      string,
      unknown
    >;

  const values = [
    metadata.full_name,
    metadata.name,
    metadata.display_name,
  ];

  for (const value of values) {
    if (
      typeof value === 'string' &&
      value.trim().length > 0
    ) {
      return value.trim();
    }
  }

  return null;
}

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

function MenuRow({
  title,
  description,
  symbol,
  onPress,
}: {
  title: string;
  description: string;
  symbol: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${description}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.menuRow,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.menuSymbol}>
        <Text style={styles.menuSymbolText}>
          {symbol}
        </Text>
      </View>

      <View style={styles.menuCopy}>
        <Text style={styles.menuTitle}>
          {title}
        </Text>

        <Text style={styles.menuDescription}>
          {description}
        </Text>
      </View>

      <Text style={styles.menuArrow}>‹</Text>
    </Pressable>
  );
}

function ProfileField({
  label,
  value,
  placeholder,
  keyboardType,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  keyboardType?:
    | 'default'
    | 'phone-pad';
  onChangeText: (
    value: string,
  ) => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <TextInput
        accessibilityLabel={label}
        keyboardType={
          keyboardType ?? 'default'
        }
        placeholder={placeholder}
        placeholderTextColor={
          NAVIENTY_NOW_COLORS.textMuted
        }
        selectionColor={
          NAVIENTY_NOW_COLORS.primary
        }
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const authState = useAuthSession();

  const customerName =
    useCustomerStore(
      (state) => state.customerName,
    );

  const phoneNumber =
    useCustomerStore(
      (state) => state.phoneNumber,
    );

  const address =
    useCustomerStore(
      (state) => state.address,
    );

  const landmark =
    useCustomerStore(
      (state) => state.landmark,
    );

  const setCustomerName =
    useCustomerStore(
      (state) => state.setCustomerName,
    );

  const setPhoneNumber =
    useCustomerStore(
      (state) => state.setPhoneNumber,
    );

  const setAddress =
    useCustomerStore(
      (state) => state.setAddress,
    );

  const setLandmark =
    useCustomerStore(
      (state) => state.setLandmark,
    );

  const [isSigningOut, setIsSigningOut] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

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

  const isPermanentAccount =
    authState.status === 'signedIn';

  const isAnonymousAccount =
    authState.status === 'anonymous';

  const hasCustomerSession =
    isPermanentAccount ||
    isAnonymousAccount;

  const hasActiveDeletionRequest =
    deletionRequest?.status === 'pending' ||
    deletionRequest?.status === 'processing';

  const linkedDisplayName =
    getAccountDisplayName(authState);

  const displayedName =
    customerName.trim() ||
    linkedDisplayName ||
    'ضيف Navienty Now';

  const linkedContact =
    isPermanentAccount
      ? authState.session.user.email ??
        authState.session.user.phone ??
        null
      : null;

  useEffect(() => {
    let cancelled = false;

    if (!hasCustomerSession) {
      setDeletionRequest(null);
      setIsLoadingDeletionRequest(false);
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
  }, [hasCustomerSession]);

  async function submitAccountDeletionRequest() {
    if (isSubmittingDeletionRequest) {
      return;
    }

    try {
      setIsSubmittingDeletionRequest(true);
      setErrorMessage(null);

      const request =
        await requestAccountDeletion();

      setDeletionRequest(request);
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
      'سيتم تسجيل طلب لحذف الحساب والبيانات المرتبطة به. قد نحتفظ فقط بالسجلات التي يلزم الاحتفاظ بها قانونيًا أو محاسبيًا. يمكنك إلغاء الطلب قبل بدء المعالجة.',
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
    if (!isPermanentAccount) {
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

      /**
       * Logging out of a permanent account should not return the app
       * to a visible signed-out state. Immediately create a fresh
       * anonymous session so shopping can continue normally.
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
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={
          styles.pageContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityLabel="العودة"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.backButton,
                pressed &&
                  styles.rowPressed,
              ]}
              onPress={() =>
                router.back()
              }
            >
              <Text style={styles.backIcon}>
                ›
              </Text>
            </Pressable>

            <Text style={styles.pageTitle}>
              حسابي
            </Text>

            <View
              style={styles.topBarSpacer}
            />
          </View>

          <View style={styles.profileCard}>
            <Image
              accessibilityLabel="شعار Navienty Now"
              resizeMode="contain"
              source={navientyNowLogo}
              style={styles.profileLogo}
            />

            <View style={styles.profileCopy}>
              <View
                style={[
                  styles.accountStatusBadge,
                  isPermanentAccount
                    ? styles.linkedStatusBadge
                    : styles.guestStatusBadge,
                ]}
              >
                <Text
                  style={[
                    styles.accountStatusText,
                    isPermanentAccount
                      ? styles.linkedStatusText
                      : styles.guestStatusText,
                  ]}
                >
                  {isPermanentAccount
                    ? 'حساب مرتبط'
                    : 'حساب ضيف'}
                </Text>
              </View>

              <Text
                numberOfLines={1}
                style={styles.profileName}
              >
                {displayedName}
              </Text>

              <Text
                style={
                  styles.profileDescription
                }
              >
                {isPermanentAccount
                  ? linkedContact ??
                    'بيانات حسابك مرتبطة بـ Navienty Now'
                  : 'بيانات الطلب محفوظة على هذا الجهاز'}
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View
              style={
                styles.sectionHeadingRow
              }
            >
              <View>
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  بيانات التوصيل
                </Text>

                <Text
                  style={
                    styles.sectionDescription
                  }
                >
                  هنستخدمها تلقائيًا في
                  الطلبات القادمة
                </Text>
              </View>

              <View
                style={
                  styles.savedBadge
                }
              >
                <Text
                  style={
                    styles.savedBadgeText
                  }
                >
                  تحفظ تلقائيًا
                </Text>
              </View>
            </View>

            <ProfileField
              label="الاسم"
              placeholder="اكتب اسمك"
              value={customerName}
              onChangeText={
                setCustomerName
              }
            />

            <ProfileField
              keyboardType="phone-pad"
              label="رقم الهاتف"
              placeholder="01012345678"
              value={phoneNumber}
              onChangeText={
                setPhoneNumber
              }
            />

            <ProfileField
              label="العنوان"
              placeholder="اكتب عنوان التوصيل"
              value={address}
              onChangeText={
                setAddress
              }
            />

            <ProfileField
              label="علامة مميزة"
              placeholder="مثال: بجوار البوابة الرئيسية"
              value={landmark}
              onChangeText={
                setLandmark
              }
            />

            <Text style={styles.localNote}>
              البيانات دي بتتعبّى تلقائيًا
              في الـ Checkout، وتقدر
              تغيّرها في أي وقت.
            </Text>
          </View>

          <View style={styles.menuCard}>
            <MenuRow
              description="راجع كل الطلبات المحفوظة وحالتها"
              symbol="▤"
              title="طلباتي"
              onPress={() => {
                router.push('/orders');
              }}
            />

            <View
              style={styles.menuDivider}
            />

            <MenuRow
              description="راجع المنتجات الحالية قبل إتمام الطلب"
              symbol="□"
              title="سلة الطلب"
              onPress={() => {
                router.push('/cart');
              }}
            />
          </View>

          {!isPermanentAccount && (
            <View
              style={styles.linkAccountCard}
            >
              <View
                style={
                  styles.linkAccountIcon
                }
              >
                <Text
                  style={
                    styles.linkAccountIconText
                  }
                >
                  ↗
                </Text>
              </View>

              <Text
                style={
                  styles.linkAccountTitle
                }
              >
                احفظ حسابك على أي جهاز
              </Text>

              <Text
                style={
                  styles.linkAccountDescription
                }
              >
                ربط الحساب اختياري. تقدر
                تطلب من غير تسجيل دخول،
                لكن الربط يساعدك لاحقًا في
                استرجاع حسابك على جهاز آخر.
              </Text>

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.linkAccountButton,
                  pressed &&
                    styles.primaryPressed,
                ]}
                onPress={() => {
                  router.push('/login');
                }}
              >
                <Text
                  style={
                    styles.linkAccountButtonText
                  }
                >
                  ربط الحساب اختياريًا
                </Text>
              </Pressable>
            </View>
          )}

          {isAnonymousAccount && (
            <View style={styles.guestNote}>
              <Text
                style={styles.guestNoteText}
              >
                لو حذفت التطبيق أو مسحت
                بياناته قبل ربط الحساب،
                الجلسة المؤقتة وبياناتها
                ممكن ما تقدرش تسترجعها.
              </Text>
            </View>
          )}

          {hasCustomerSession && (
            <View style={styles.deletionCard}>
              <View
                style={
                  styles.deletionHeadingRow
                }
              >
                <View
                  style={
                    styles.deletionIcon
                  }
                >
                  <Text
                    style={
                      styles.deletionIconText
                    }
                  >
                    ×
                  </Text>
                </View>

                <View
                  style={
                    styles.deletionHeadingCopy
                  }
                >
                  <Text
                    style={
                      styles.deletionTitle
                    }
                  >
                    حذف الحساب والبيانات
                  </Text>

                  <Text
                    style={
                      styles.deletionDescription
                    }
                  >
                    تقدر تبدأ طلب حذف حسابك
                    من داخل التطبيق، بما في
                    ذلك حساب الضيف. قد نحتفظ
                    فقط بالسجلات المطلوبة
                    قانونيًا أو محاسبيًا.
                  </Text>
                </View>
              </View>

              {isLoadingDeletionRequest ? (
                <View
                  style={
                    styles.deletionLoadingRow
                  }
                >
                  <ActivityIndicator
                    color={
                      NAVIENTY_NOW_COLORS.error
                    }
                    size="small"
                  />
                  <Text
                    style={
                      styles.deletionLoadingText
                    }
                  >
                    جاري تحميل حالة الطلب...
                  </Text>
                </View>
              ) : hasActiveDeletionRequest &&
                deletionRequest ? (
                <View
                  style={
                    styles.deletionStatusBox
                  }
                >
                  <Text
                    style={
                      styles.deletionStatusTitle
                    }
                  >
                    {deletionRequest.status ===
                    'processing'
                      ? 'بدأت معالجة طلب الحذف'
                      : 'طلب الحذف مسجّل'}
                  </Text>

                  <Text
                    style={
                      styles.deletionStatusText
                    }
                  >
                    موعد الإكمال المستهدف:{' '}
                    {formatDeletionDate(
                      deletionRequest
                        .targetCompletionAt,
                    )}
                  </Text>

                  {deletionRequest.status ===
                    'pending' && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={
                        isCancellingDeletionRequest
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.cancelDeletionButton,
                        isCancellingDeletionRequest &&
                          styles.deletionButtonDisabled,
                        pressed &&
                          !isCancellingDeletionRequest &&
                          styles.rowPressed,
                      ]}
                      onPress={
                        confirmCancelDeletionRequest
                      }
                    >
                      {isCancellingDeletionRequest ? (
                        <ActivityIndicator
                          color={
                            NAVIENTY_NOW_COLORS.textSecondary
                          }
                          size="small"
                        />
                      ) : (
                        <Text
                          style={
                            styles.cancelDeletionButtonText
                          }
                        >
                          إلغاء طلب الحذف
                        </Text>
                      )}
                    </Pressable>
                  )}
                </View>
              ) : (
                <Pressable
                  accessibilityLabel="طلب حذف الحساب"
                  accessibilityRole="button"
                  disabled={
                    isSubmittingDeletionRequest
                  }
                  style={({ pressed }) => [
                    styles.deleteAccountButton,
                    isSubmittingDeletionRequest &&
                      styles.deletionButtonDisabled,
                    pressed &&
                      !isSubmittingDeletionRequest &&
                      styles.deleteAccountButtonPressed,
                  ]}
                  onPress={
                    confirmAccountDeletionRequest
                  }
                >
                  {isSubmittingDeletionRequest ? (
                    <ActivityIndicator
                      color={
                        NAVIENTY_NOW_COLORS.white
                      }
                      size="small"
                    />
                  ) : (
                    <Text
                      style={
                        styles.deleteAccountButtonText
                      }
                    >
                      طلب حذف الحساب
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          )}

          {errorMessage && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          )}

          {isPermanentAccount && (
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
              <View style={styles.signOutButtonContent}>
                {isSigningOut && (
                  <ActivityIndicator
                    color={NAVIENTY_NOW_COLORS.error}
                    size="small"
                  />
                )}

                <Text
                  style={
                    styles.signOutButtonText
                  }
                >
                  تسجيل الخروج
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <AppBottomNavigation
        activeTab="account"
        isSignedIn={isPermanentAccount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    flex: 1,
  },

  pageContent: {
    flexGrow: 1,
    paddingBottom:
      NAVIENTY_NOW_LAYOUT.bottomNavigationHeight +
      58,
    paddingHorizontal:
      NAVIENTY_NOW_LAYOUT.pageGutter,
    paddingTop:
      Platform.OS === 'ios' ? 30 : 20,
  },

  container: {
    alignSelf: 'center',
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    width: '100%',
  },

  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
  },

  backButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  backIcon: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 31,
    lineHeight: 32,
  },

  pageTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 20,
    fontWeight: '900',
  },

  topBarSpacer: {
    width: 40,
  },

  profileCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 22,
    padding: 18,
  },

  profileLogo: {
    borderRadius: 18,
    height: 78,
    marginRight: 16,
    width: 78,
  },

  profileCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },

  accountStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  linkedStatusBadge: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
  },

  guestStatusBadge: {
    backgroundColor: '#F3F3F5',
  },

  accountStatusText: {
    fontSize: 9,
    fontWeight: '900',
  },

  linkedStatusText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
  },

  guestStatusText: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
  },

  profileName: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 8,
    maxWidth: '100%',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  profileDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  infoCard: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    marginTop: 17,
    padding: 16,
  },

  sectionHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  sectionTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  sectionDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 9,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  savedBadge: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  savedBadgeText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 8,
    fontWeight: '900',
  },

  fieldGroup: {
    marginTop: 12,
  },

  fieldLabel: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 7,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  fieldInput: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.surface,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 13,
    minHeight: 48,
    paddingHorizontal: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  localNote: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 9,
    lineHeight: 16,
    marginTop: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  menuCard: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    marginTop: 17,
    overflow: 'hidden',
  },

  menuRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    minHeight: 82,
    padding: 15,
  },

  rowPressed: {
    opacity: 0.6,
  },

  menuSymbol: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 15,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },

  menuSymbolText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 22,
    fontWeight: '700',
  },

  menuCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginHorizontal: 13,
  },

  menuTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  menuDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  menuArrow: {
    color: NAVIENTY_NOW_COLORS.textMuted,
    fontSize: 28,
    lineHeight: 29,
  },

  menuDivider: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.border,
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 15,
  },

  linkAccountCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderColor: '#CDEAD8',
    borderRadius:
      NAVIENTY_NOW_LAYOUT.cardRadius,
    borderWidth: 1,
    marginTop: 17,
    padding: 18,
  },

  linkAccountIcon: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },

  linkAccountIconText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 24,
    fontWeight: '900',
  },

  linkAccountTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  linkAccountDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 18,
    marginTop: 7,
    maxWidth: 390,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  linkAccountButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 15,
    minHeight: 48,
    paddingHorizontal: 15,
  },

  linkAccountButtonText: {
    color:
      NAVIENTY_NOW_COLORS.white,
    fontSize: 12,
    fontWeight: '900',
  },

  primaryPressed: {
    opacity: 0.78,
  },

  guestNote: {
    backgroundColor: '#FFF9E8',
    borderColor: '#F0DDAA',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },

  guestNoteText: {
    color: '#7D652E',
    fontSize: 9,
    lineHeight: 16,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  deletionCard: {
    backgroundColor: '#FFF8F8',
    borderColor: '#EBCACA',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },

  deletionHeadingRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },

  deletionIcon: {
    alignItems: 'center',
    backgroundColor: '#FDE8E8',
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },

  deletionIconText: {
    color: NAVIENTY_NOW_COLORS.error,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 26,
  },

  deletionHeadingCopy: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: 12,
  },

  deletionTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  deletionDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 17,
    marginTop: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  deletionLoadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
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
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor: '#EEDDDD',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    padding: 13,
  },

  deletionStatusTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
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
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 12,
    fontWeight: '900',
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

  errorCard: {
    backgroundColor: '#FFF4F4',
    borderColor: '#F0CCCC',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 15,
    padding: 12,
  },

  errorText: {
    color: '#A13838',
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  signOutButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor: '#E6BEBE',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 52,
  },

  signOutButtonDisabled: {
    opacity: 0.58,
  },

  signOutButtonPressed: {
    backgroundColor: '#FFF5F5',
  },

  signOutButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
  },

  signOutButtonText: {
    color: NAVIENTY_NOW_COLORS.error,
    fontSize: 13,
    fontWeight: '900',
  },
});
