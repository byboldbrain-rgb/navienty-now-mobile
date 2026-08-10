import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    useState,
} from 'react';
import {
    Image,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import AppBottomNavigation from '../category/app-bottom-navigation';
import { useAuthSession } from '../hooks/use-auth-session';
import { supabase } from '../lib/supabase';
import {
    NAVIENTY_NOW_COLORS,
    NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

const navientyNowLogo = require('../assets/images/navienty-now-logo.jpg');

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

export default function AccountScreen() {
  const router = useRouter();
  const authState = useAuthSession();
  const [isSigningOut, setIsSigningOut] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const isSignedIn =
    authState.status === 'signedIn';

  const displayName =
    getAccountDisplayName(authState);

  async function signOut() {
    try {
      setIsSigningOut(true);
      setErrorMessage(null);

      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

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
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <Image
          accessibilityLabel="شعار Navienty Now"
          resizeMode="contain"
          source={navientyNowLogo}
          style={styles.loadingLogo}
        />
        <Text style={styles.loadingText}>
          جاري تحميل الحساب...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityLabel="العودة"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.rowPressed,
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.backIcon}>›</Text>
            </Pressable>

            <Text style={styles.pageTitle}>
              الحساب
            </Text>

            <View style={styles.topBarSpacer} />
          </View>

          {isSignedIn ? (
            <>
              <View style={styles.profileCard}>
                <Image
                  accessibilityLabel="شعار Navienty Now"
                  resizeMode="contain"
                  source={navientyNowLogo}
                  style={styles.profileLogo}
                />

                <View style={styles.profileCopy}>
                  <Text style={styles.profileGreeting}>
                    أهلاً بك
                  </Text>

                  {displayName && (
                    <Text
                      style={styles.profileName}
                    >
                      {displayName}
                    </Text>
                  )}

                  <Text
                    numberOfLines={1}
                    style={styles.profileEmail}
                  >
                    {authState.session.user.email ??
                      'حساب مسجل'}
                  </Text>
                </View>
              </View>

              <View style={styles.menuCard}>
                <MenuRow
                  description="راجع الطلبات المحفوظة وحالتها"
                  symbol="▤"
                  title="طلباتي"
                  onPress={() => {
                    router.push('/orders');
                  }}
                />

                <View style={styles.menuDivider} />

                <MenuRow
                  description="راجع المنتجات الحالية قبل الإرسال"
                  symbol="□"
                  title="سلة الطلب"
                  onPress={() => {
                    router.push('/cart');
                  }}
                />
              </View>

              {errorMessage && (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>
                    {errorMessage}
                  </Text>
                </View>
              )}

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
                  void signOut();
                }}
              >
                <Text
                  style={styles.signOutButtonText}
                >
                  {isSigningOut
                    ? 'جاري تسجيل الخروج...'
                    : 'تسجيل الخروج'}
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.signedOutCard}>
              <Image
                accessibilityLabel="شعار Navienty Now"
                resizeMode="contain"
                source={navientyNowLogo}
                style={styles.signedOutLogo}
              />

              <Text style={styles.signedOutTitle}>
                سجّل الدخول إلى حسابك
              </Text>

              <Text
                style={styles.signedOutDescription}
              >
                يمكنك متابعة التصفح كزائر، وتسجيل الدخول عند الحاجة إلى تجربة أكثر تخصيصًا.
              </Text>

              {authState.status === 'error' && (
                <Text
                  style={styles.authErrorText}
                >
                  {authState.errorMessage}
                </Text>
              )}

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.loginButton,
                  pressed &&
                    styles.loginButtonPressed,
                ]}
                onPress={() => {
                  router.push('/login');
                }}
              >
                <Text style={styles.loginButtonText}>
                  تسجيل الدخول
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.browseButton,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => {
                  router.replace('/');
                }}
              >
                <Text
                  style={styles.browseButtonText}
                >
                  العودة للرئيسية
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <AppBottomNavigation
        activeTab="account"
        isSignedIn={isSignedIn}
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
      52,
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
    padding: 20,
  },

  profileLogo: {
    borderRadius: 20,
    height: 90,
    marginRight: 17,
    width: 90,
  },

  profileCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },

  profileGreeting: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },

  profileName: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  profileEmail: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 11,
    marginTop: 6,
    textAlign: 'right',
    writingDirection: 'ltr',
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
    minHeight: 86,
    padding: 15,
  },

  rowPressed: {
    opacity: 0.6,
  },

  menuSymbol: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPale,
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },

  menuSymbolText: {
    color:
      NAVIENTY_NOW_COLORS.primaryDark,
    fontSize: 24,
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

  signOutButtonText: {
    color: NAVIENTY_NOW_COLORS.error,
    fontSize: 13,
    fontWeight: '900',
  },

  signedOutCard: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderColor:
      NAVIENTY_NOW_COLORS.border,
    borderRadius:
      NAVIENTY_NOW_LAYOUT.majorRadius,
    borderWidth: 1,
    marginTop: 30,
    padding: 27,
  },

  signedOutLogo: {
    borderRadius: 24,
    height: 120,
    width: 120,
  },

  signedOutTitle: {
    color: NAVIENTY_NOW_COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 20,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  signedOutDescription: {
    color:
      NAVIENTY_NOW_COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 340,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  authErrorText: {
    color: NAVIENTY_NOW_COLORS.error,
    fontSize: 10,
    lineHeight: 17,
    marginTop: 10,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  loginButton: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 21,
    minHeight: 52,
    paddingHorizontal: 28,
  },

  loginButtonPressed: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primaryPressed,
    transform: [{ scale: 0.99 }],
  },

  loginButtonText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 14,
    fontWeight: '900',
  },

  browseButton: {
    justifyContent: 'center',
    marginTop: 13,
    minHeight: 42,
  },

  browseButtonText: {
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
    borderRadius: 23,
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
