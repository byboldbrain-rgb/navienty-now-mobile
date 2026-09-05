import {
  FontAwesome,
  Ionicons,
} from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Crypto from 'expo-crypto';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useAuthSession } from '../hooks/use-auth-session';
import { useDatabaseFirstArtworkSource } from '../hooks/use-database-first-artwork';
import { supabase } from '../lib/supabase';
import {
  NAVIENTY_NOW_COLORS,
  NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

WebBrowser.maybeCompleteAuthSession();

/**
 * Transparent Hero Artwork
 *
 * src/assets/images/navienty-now-auth-hero.png
 */
const navientyNowHero = require(
  '../assets/images/navienty-now-auth-hero.png',
);

const AUTH_HERO_ARTWORK_KEY =
  'src/assets/images/navienty-now-auth-hero.png';

/**
 * Hero background.
 */
const AUTH_HERO_BACKGROUND = '#FBF7EF';
const AUTH_WHITE = '#FFFFFF';
const AUTH_BORDER = '#747474';

/**
 * ============================================================
 * RESPONSIVE LAYOUT REFERENCE
 * ============================================================
 *
 * Original design canvas:
 *
 * Width = 591
 * Height = 1280
 *
 * IMPORTANT:
 *
 * The landing page keeps its WIDTH-based scale for typography,
 * buttons, and icons, but vertical empty space is kept tighter.
 *
 * This means:
 *
 * - The content starts higher inside the white section.
 * - We do not force an artificial minimum page height.
 * - Most normal phone screens can show the login choices
 *   without requiring an unnecessary vertical scroll.
 */
const REFERENCE_WIDTH = 591;

/**
 * Approximate design dimensions, measured from the supplied
 * Navienty authentication artwork and layout reference.
 *
 * These values are then scaled according
 * to the current screen width.
 */
const REF = {
  /**
   * Hero excluding the system status-bar area,
   * because SafeAreaView already handles it.
   */
  heroHeight: 500,

  /**
   * Landing hero artwork fills the entire hero section.
   * Its size is controlled by the container itself.
   */

  /**
   * Back button.
   */
  backButtonSize: 60,
  backButtonTop: 20,
  backButtonRight: 25,
  backIconSize: 30,

  /**
   * Wave.
   */
  waveHeight: 50,

  /**
   * White content.
   */
  contentHorizontalPadding: 26,
  landingTopSpace: 24,

  /**
   * Welcome.
   */
  welcomeFontSize: 31,
  welcomeLineHeight: 42,

  descriptionFontSize: 17,
  descriptionLineHeight: 29,
  descriptionMarginTop: 14,
  descriptionMaxWidth: 475,

  /**
   * Social buttons.
   */
  providersMarginTop: 30,

  providerHeight: 69,
  providerGap: 18,

  providerFontSize: 19,
  providerLineHeight: 27,

  providerIconSize: 26,
  providerIconGap: 12,

  /**
   * Small bottom breathing room only.
   *
   * Do not force a large minimum page height here,
   * otherwise short screens get an unnecessary scroll.
   */
  bottomSpace: 20,
} as const;

type AuthStep =
  | 'landing'
  | 'phone'
  | 'otp';

type SocialProvider =
  | 'google'
  | 'apple'
  | 'facebook';

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

function maskPhone(
  phone: string,
): string {
  if (phone.length < 8) {
    return phone;
  }

  return `${phone.slice(0, 5)}••••${phone.slice(-3)}`;
}

function getSingleParam(
  value:
    | string
    | string[]
    | undefined,
): string | undefined {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function bytesToHex(
  bytes: Uint8Array,
): string {
  return Array.from(
    bytes,
    (byte) =>
      byte
        .toString(16)
        .padStart(2, '0'),
  ).join('');
}

function getErrorCode(
  error: unknown,
): string | null {
  if (
    typeof error !==
      'object' ||
    error === null ||
    !('code' in error)
  ) {
    return null;
  }

  const { code } = error;

  return typeof code ===
    'string'
    ? code
    : null;
}

/**
 * ============================================================
 * HERO WAVE
 * ============================================================
 */

type HeroWaveProps = {
  width: number;
  height: number;
};

function HeroWave({
  width,
  height,
}: HeroWaveProps) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.heroWave,
        {
          height,
        },
      ]}
    >
      <Svg
        height={height}
        preserveAspectRatio="none"
        viewBox="0 0 591 50"
        width={width}
      >
        {/*
         * Very subtle organic transition matching the
         * Navienty authentication artwork.
         *
         * It should NOT look like a big wave.
         */}
        <Path
          d="
            M0 17

            C37 16
             69 15
             102 17

            C141 19
             174 21
             208 21

            C246 21
             280 18
             314 17

            C351 16
             387 18
             421 19

            C461 21
             499 20
             534 18

            C552 17
             571 17
             591 18

            L591 50
            L0 50
            Z
          "
          fill={AUTH_WHITE}
        />
      </Svg>
    </View>
  );
}

/**
 * ============================================================
 * PROVIDER BUTTON
 * ============================================================
 */

type ProviderButtonProps = {
  label: string;

  provider:
    | SocialProvider
    | 'phone';

  disabled?: boolean;

  loading?: boolean;

  /**
   * Current design-canvas scale.
   */
  scale: number;

  onPress: () => void;
};

function ProviderButton({
  label,
  provider,
  disabled = false,
  loading = false,
  scale,
  onPress,
}: ProviderButtonProps) {
  const px = (
    value: number,
  ) => value * scale;

  function renderIcon() {
    if (loading) {
      return (
        <ActivityIndicator
          color={
            NAVIENTY_NOW_COLORS.text
          }
          size="small"
        />
      );
    }

    if (provider === 'phone') {
      return (
        <Ionicons
          color={
            NAVIENTY_NOW_COLORS.text
          }
          name="call-outline"
          size={
            px(
              REF.providerIconSize,
            )
          }
        />
      );
    }

    if (provider === 'google') {
      return (
        <FontAwesome
          color="#4285F4"
          name="google"
          size={
            px(
              REF.providerIconSize,
            )
          }
        />
      );
    }

    if (provider === 'apple') {
      return (
        <FontAwesome
          color="#000000"
          name="apple"
          size={
            px(
              REF.providerIconSize +
                2,
            )
          }
        />
      );
    }

    return (
      <FontAwesome
        color="#1877F2"
        name="facebook"
        size={
          px(
            REF.providerIconSize +
              1,
          )
        }
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({
        pressed,
      }) => [
        styles.providerButton,

        {
          borderRadius:
            px(
              REF.providerHeight /
                2,
            ),

          height:
            px(
              REF.providerHeight,
            ),

          marginBottom:
            px(
              REF.providerGap,
            ),

          paddingHorizontal:
            px(20),
        },

        pressed &&
          !disabled &&
          styles.providerButtonPressed,

        disabled &&
          styles.providerButtonDisabled,
      ]}
      onPress={onPress}
    >
      <View
        style={
          styles.providerButtonContent
        }
      >
        <Text
          style={[
            styles.providerButtonText,

            {
              fontSize:
                px(
                  REF.providerFontSize,
                ),

              lineHeight:
                px(
                  REF.providerLineHeight,
                ),
            },
          ]}
        >
          {label}
        </Text>

        <View
          style={[
            styles.providerIcon,

            {
              marginLeft:
                px(
                  REF.providerIconGap,
                ),

              minWidth:
                px(31),
            },
          ]}
        >
          {renderIcon()}
        </View>
      </View>
    </Pressable>
  );
}

type NativeAppleProviderButtonProps = {
  disabled: boolean;
  loading: boolean;
  scale: number;
  onPress: () => void;
};

function NativeAppleProviderButton({
  disabled,
  loading,
  scale,
  onPress,
}: NativeAppleProviderButtonProps) {
  const height =
    REF.providerHeight *
    scale;

  return (
    <View
      pointerEvents={
        disabled
          ? 'none'
          : 'auto'
      }
      style={[
        styles.nativeAppleButtonContainer,
        {
          height,
          marginBottom:
            REF.providerGap *
            scale,
          opacity:
            disabled
              ? 0.5
              : 1,
        },
      ]}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonStyle={
          AppleAuthentication
            .AppleAuthenticationButtonStyle
            .WHITE_OUTLINE
        }
        buttonType={
          AppleAuthentication
            .AppleAuthenticationButtonType
            .CONTINUE
        }
        cornerRadius={
          height / 2
        }
        style={
          styles.nativeAppleButton
        }
        onPress={onPress}
      />

      {loading && (
        <View
          pointerEvents="none"
          style={
            styles.nativeAppleLoadingOverlay
          }
        >
          <ActivityIndicator
            color={
              NAVIENTY_NOW_COLORS.text
            }
            size="small"
          />
        </View>
      )}
    </View>
  );
}

/**
 * ============================================================
 * SCREEN
 * ============================================================
 */

export default function LoginScreen() {
  const router = useRouter();

  const authHeroArtwork =
    useDatabaseFirstArtworkSource(
      AUTH_HERO_ARTWORK_KEY,
      navientyNowHero,
      {
        timeoutMs: 2500,
      },
    );

  const params =
    useLocalSearchParams<{
      returnTo?:
        | string
        | string[];

      storeId?:
        | string
        | string[];
    }>();

  const returnTo =
    getSingleParam(
      params.returnTo,
    );

  const returnStoreId =
    getSingleParam(
      params.storeId,
    );

  const authState =
    useAuthSession();

  const authLoadingPulse = useRef(
    new Animated.Value(0.76),
  ).current;

  useEffect(() => {
    const shouldAnimate =
      authState.status === 'loading' ||
      authState.status === 'signedIn';

    if (!shouldAnimate) {
      authLoadingPulse.stopAnimation();
      authLoadingPulse.setValue(1);
      return;
    }

    authLoadingPulse.setValue(0.76);

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(
          authLoadingPulse,
          {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          },
        ),
        Animated.timing(
          authLoadingPulse,
          {
            toValue: 0.76,
            duration: 650,
            useNativeDriver: true,
          },
        ),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [
    authLoadingPulse,
    authState.status,
  ]);

  const authLoadingScale =
    authLoadingPulse.interpolate({
      inputRange: [0.76, 1],
      outputRange: [0.985, 1],
      extrapolate: 'clamp',
    });

  const {
    height: screenHeight,
    width: screenWidth,
  } = useWindowDimensions();

  const [step, setStep] =
    useState<AuthStep>(
      'landing',
    );

  const [
    phoneInput,
    setPhoneInput,
  ] =
    useState('');

  const [
    verifiedPhone,
    setVerifiedPhone,
  ] =
    useState<
      string | null
    >(null);

  const [
    otpCode,
    setOtpCode,
  ] =
    useState('');

  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false);

  const [
    socialProvider,
    setSocialProvider,
  ] =
    useState<
      SocialProvider | null
    >(null);

  const [
    formMessage,
    setFormMessage,
  ] =
    useState<FormMessage>(
      null,
    );

  /**
   * ==========================================================
   * LANDING REFERENCE SCALE
   * ==========================================================
   *
   * This is the critical change.
   *
   * Before:
   *
   * screenHeight < 850
   *     ↓
   * compact design
   *     ↓
   * everything became too small.
   *
   * Now:
   *
   * screenWidth / 591
   *     ↓
   * same proportions as reference.
   */
  const landingScale =
    useMemo(
      () => {
        const rawScale =
          screenWidth /
          REFERENCE_WIDTH;

        /**
         * Avoid extreme layouts on
         * unusually narrow / wide
         * browser windows.
         */
        return Math.min(
          1.08,
          Math.max(
            0.64,
            rawScale,
          ),
        );
      },
      [screenWidth],
    );

  const dp = (
    value: number,
  ) =>
    value *
    landingScale;

  /**
   * ==========================================================
   * LANDING GEOMETRY
   * ==========================================================
   */

  const landingHeroHeight =
    dp(
      REF.heroHeight,
    );

  const waveHeight =
    dp(
      REF.waveHeight,
    );

  const backButtonSize =
    dp(
      REF.backButtonSize,
    );

  const backButtonTop =
    dp(
      REF.backButtonTop,
    );

  const backButtonRight =
    dp(
      REF.backButtonRight,
    );

  /**
   * Phone/OTP can still have a smaller hero
   * because the keyboard matters there.
   *
   * This DOES NOT affect the landing screen.
   */
  const secondaryHeroHeight =
    Math.min(
      330,
      Math.max(
        235,
        screenHeight *
          0.29,
      ),
    );

  const activeHeroHeight =
    step === 'landing'
      ? landingHeroHeight
      : secondaryHeroHeight;

  /**
   * Secondary-page artwork.
   */
  const secondaryArtworkWidth =
    Math.min(
      285,
      screenWidth *
        0.58,
    );

  const secondaryArtworkHeight =
    secondaryArtworkWidth *
    0.72;

  /**
   * OAuth.
   */
  const redirectTo =
    useMemo(
      () =>
        makeRedirectUri({
          scheme:
            'navientynow',

          path:
            'auth/callback',
        }),
      [],
    );

  const redirectAfterLogin =
    useCallback(() => {
      /**
       * Only allow the protected destination we explicitly
       * support here instead of blindly navigating to an
       * arbitrary route received from query params.
       */
      if (
        returnTo === '/checkout' &&
        returnStoreId
      ) {
        router.replace({
          pathname: '/checkout',
          params: {
            storeId:
              returnStoreId,
          },
        });

        return;
      }

      router.replace('/');
    }, [
      returnStoreId,
      returnTo,
      router,
    ]);

  useEffect(() => {
    if (
      authState.status ===
      'signedIn'
    ) {
      redirectAfterLogin();
    }
  }, [
    authState.status,
    redirectAfterLogin,
  ]);

  const normalizedPhone =
    normalizeEgyptianPhone(
      phoneInput,
    );

  const phoneFormIsValid =
    normalizedPhone !==
    null;

  const otpFormIsValid =
    /^\d{6}$/.test(
      otpCode,
    );

  const anythingIsLoading =
    isSubmitting ||
    socialProvider !== null;

  /**
   * ==========================================================
   * OAUTH SESSION
   * ==========================================================
   */

  async function createSessionFromUrl(
    url: string,
  ) {
    const {
      params,
      errorCode,
    } =
      QueryParams.getQueryParams(
        url,
      );

    if (errorCode) {
      throw new Error(
        String(
          errorCode,
        ),
      );
    }

    const errorDescription =
      typeof params
        .error_description ===
      'string'
        ? params
            .error_description
        : null;

    if (
      errorDescription
    ) {
      throw new Error(
        errorDescription,
      );
    }

    const code =
      typeof params.code ===
      'string'
        ? params.code
        : null;

    if (code) {
      const {
        error,
      } =
        await supabase.auth
          .exchangeCodeForSession(
            code,
          );

      if (error) {
        throw error;
      }

      return;
    }

    const accessToken =
      typeof params
        .access_token ===
      'string'
        ? params
            .access_token
        : null;

    const refreshToken =
      typeof params
        .refresh_token ===
      'string'
        ? params
            .refresh_token
        : null;

    if (
      !accessToken ||
      !refreshToken
    ) {
      throw new Error(
        'لم يتم استلام بيانات تسجيل الدخول.',
      );
    }

    const {
      error,
    } =
      await supabase.auth
        .setSession({
          access_token:
            accessToken,

          refresh_token:
            refreshToken,
        });

    if (error) {
      throw error;
    }
  }

  async function signInWithSocialProvider(
    provider: SocialProvider,
  ) {
    setFormMessage(null);

    try {
      setSocialProvider(
        provider,
      );

      if (
        provider ===
          'apple' &&
        Platform.OS ===
          'ios'
      ) {
        const rawNonce =
          bytesToHex(
            await Crypto
              .getRandomBytesAsync(
                32,
              ),
          );

        const hashedNonce =
          await Crypto
            .digestStringAsync(
              Crypto
                .CryptoDigestAlgorithm
                .SHA256,
              rawNonce,
            );

        const credential =
          await AppleAuthentication
            .signInAsync({
              nonce:
                hashedNonce,
              requestedScopes: [
                AppleAuthentication
                  .AppleAuthenticationScope
                  .FULL_NAME,
                AppleAuthentication
                  .AppleAuthenticationScope
                  .EMAIL,
              ],
            });

        if (
          !credential
            .identityToken
        ) {
          throw new Error(
            'لم يتم استلام رمز تسجيل الدخول من Apple.',
          );
        }

        const appleCredentials = {
          nonce:
            rawNonce,
          provider:
            'apple' as const,
          token:
            credential
              .identityToken,
        };

        const {
          error:
            appleAuthError,
        } =
          authState.status ===
          'anonymous'
            ? await supabase.auth
                .linkIdentity(
                  appleCredentials,
                )
            : await supabase.auth
                .signInWithIdToken(
                  appleCredentials,
                );

        if (appleAuthError) {
          throw appleAuthError;
        }

        if (
          credential.fullName
        ) {
          const fullName =
            AppleAuthentication
              .formatFullName(
                credential
                  .fullName,
              )
              .trim();

          const metadata:
            Record<
              string,
              string
            > = {};

          if (fullName) {
            metadata.full_name =
              fullName;
          }

          if (
            credential
              .fullName
              .givenName
          ) {
            metadata.given_name =
              credential
                .fullName
                .givenName;
          }

          if (
            credential
              .fullName
              .familyName
          ) {
            metadata.family_name =
              credential
                .fullName
                .familyName;
          }

          if (
            Object.keys(
              metadata,
            ).length > 0
          ) {
            const {
              error:
                metadataError,
            } =
              await supabase.auth
                .updateUser({
                  data:
                    metadata,
                });

            if (
              metadataError &&
              __DEV__
            ) {
              console.warn(
                '[Navienty] Apple name metadata could not be saved.',
                metadataError,
              );
            }
          }
        }

        redirectAfterLogin();

        return;
      }

      const {
        data,
        error,
      } =
        authState.status ===
        'anonymous'
          ? await supabase.auth
              .linkIdentity({
                provider,

                options: {
                  redirectTo,

                  skipBrowserRedirect:
                    true,
                },
              })
          : await supabase.auth
              .signInWithOAuth({
                provider,

                options: {
                  redirectTo,

                  skipBrowserRedirect:
                    true,
                },
              });

      if (error) {
        throw error;
      }

      if (!data.url) {
        throw new Error(
          'تعذر فتح صفحة تسجيل الدخول.',
        );
      }

      const result =
        await WebBrowser
          .openAuthSessionAsync(
            data.url,
            redirectTo,
          );

      if (
        result.type ===
        'success'
      ) {
        await createSessionFromUrl(
          result.url,
        );

        redirectAfterLogin();
      }
    } catch (error) {
      if (
        getErrorCode(
          error,
        ) ===
        'ERR_REQUEST_CANCELED'
      ) {
        return;
      }

      setFormMessage({
        type:
          'error',

        text:
          error instanceof
          Error
            ? error.message
            : 'تعذر تسجيل الدخول. حاول مرة أخرى.',
      });
    } finally {
      setSocialProvider(
        null,
      );
    }
  }

  /**
   * ==========================================================
   * WHATSAPP OTP
   * ==========================================================
   */

  async function sendOtp() {
    setFormMessage(null);

    if (
      !normalizedPhone
    ) {
      setFormMessage({
        type:
          'error',

        text:
          'اكتب رقم موبايل مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015.',
      });

      return;
    }

    try {
      setIsSubmitting(
        true,
      );

      const {
        error,
      } =
        await supabase.auth
          .signInWithOtp({
            phone:
              normalizedPhone,

            options: {
              channel:
                'whatsapp',

              shouldCreateUser:
                true,
            },
          });

      if (error) {
        throw error;
      }

      setVerifiedPhone(
        normalizedPhone,
      );

      setOtpCode('');

      setStep('otp');

      setFormMessage({
        type:
          'success',

        text:
          'تم إرسال رمز التحقق إليك عبر WhatsApp.',
      });
    } catch (error) {
      setFormMessage({
        type:
          'error',

        text:
          error instanceof
          Error
            ? error.message
            : 'تعذر إرسال رمز التحقق عبر WhatsApp.',
      });
    } finally {
      setIsSubmitting(
        false,
      );
    }
  }

  async function verifyOtp() {
    setFormMessage(null);

    if (
      !verifiedPhone ||
      !otpFormIsValid
    ) {
      setFormMessage({
        type:
          'error',

        text:
          'اكتب رمز التحقق المكوّن من 6 أرقام.',
      });

      return;
    }

    try {
      setIsSubmitting(
        true,
      );

      const {
        error,
      } =
        await supabase.auth
          .verifyOtp({
            phone:
              verifiedPhone,

            token:
              otpCode,

            type:
              'sms',
          });

      if (error) {
        throw error;
      }

      redirectAfterLogin();
    } catch (error) {
      setFormMessage({
        type:
          'error',

        text:
          error instanceof
          Error
            ? error.message
            : 'رمز التحقق غير صحيح أو انتهت صلاحيته.',
      });
    } finally {
      setIsSubmitting(
        false,
      );
    }
  }

  function openPhoneLogin() {
    setFormMessage(null);

    setStep(
      'phone',
    );
  }

  function goBackToLanding() {
    setPhoneInput('');

    setVerifiedPhone(
      null,
    );

    setOtpCode('');

    setFormMessage(null);

    setStep(
      'landing',
    );
  }

  function handleBack() {
    setFormMessage(null);

    if (
      step === 'otp'
    ) {
      setOtpCode('');

      setVerifiedPhone(
        null,
      );

      setStep(
        'phone',
      );

      return;
    }

    if (
      step === 'phone'
    ) {
      goBackToLanding();

      return;
    }

    /**
     * When Login was opened from the cart checkout flow,
     * the back button should return to the cart instead
     * of discarding that navigation context.
     */
    if (
      returnTo === '/checkout'
    ) {
      router.back();

      return;
    }

    router.replace('/');
  }

  /**
   * ==========================================================
   * LOADING
   * ==========================================================
   */

  if (
    authState.status ===
      'loading' ||
    authState.status ===
      'signedIn'
  ) {
    return (
      <View
        style={
          styles.loadingScreen
        }
      >
        <StatusBar
          style="dark"
        />

        <Animated.Image
          accessibilityLabel="شعار Navienty Now"
          fadeDuration={0}
          resizeMode="contain"
          source={
            authHeroArtwork.source ??
            navientyNowHero
          }
          onError={
            authHeroArtwork.onError
          }
          style={[
            styles.loadingLogo,
            {
              opacity:
                authLoadingPulse,
              transform: [
                {
                  scale:
                    authLoadingScale,
                },
              ],
            },
          ]}
        />
      </View>
    );
  }

  /**
   * ==========================================================
   * UI
   * ==========================================================
   */

  return (
    <SafeAreaView
      edges={['top']}
      style={
        styles.safeArea
      }
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
        }
        style={
          styles.screen
        }
      >
        <StatusBar
          style="dark"
        />

        <ScrollView
          bounces={false}
          contentContainerStyle={
            styles.pageContent
          }
          keyboardShouldPersistTaps="handled"
          overScrollMode="never"
          showsVerticalScrollIndicator={
            false
          }
        >
          {/* ================================================= */}
          {/* HERO                                              */}
          {/* ================================================= */}

          <View
            style={[
              styles.heroSection,

              {
                height:
                  activeHeroHeight,
              },
            ]}
          >
            {/* ============================= */}
            {/* BACK BUTTON                   */}
            {/* ============================= */}

            <Pressable
              accessibilityLabel="العودة"
              accessibilityRole="button"
              hitSlop={12}
              style={({
                pressed,
              }) => [
                styles.backButton,

                step ===
                'landing'
                  ? {
                      height:
                        backButtonSize,

                      right:
                        backButtonRight,

                      top:
                        backButtonTop,

                      width:
                        backButtonSize,
                    }
                  : styles.secondaryBackButton,

                pressed &&
                  styles.backButtonPressed,
              ]}
              onPress={
                handleBack
              }
            >
              <Ionicons
                color={
                  NAVIENTY_NOW_COLORS.text
                }
                name="arrow-forward"
                size={
                  step ===
                  'landing'
                    ? dp(
                        REF.backIconSize,
                      )
                    : 27
                }
              />
            </Pressable>

            {/* ============================= */}
            {/* LANDING ARTWORK               */}
            {/* ============================= */}

            {step ===
            'landing' ? (
              <View
                pointerEvents="none"
                style={
                  styles.heroArtworkContainer
                }
              >
                <Image
                  accessibilityLabel="Navienty Now"
                  fadeDuration={0}
                  resizeMode="cover"
                  source={
            authHeroArtwork.source ??
            navientyNowHero
          }
          onError={
            authHeroArtwork.onError
          }
                  style={
                    styles.heroArtworkImage
                  }
                />
              </View>
            ) : (
              <View
                pointerEvents="none"
                style={
                  styles.secondaryArtworkContainer
                }
              >
                <Image
                  accessibilityLabel="Navienty Now"
                  fadeDuration={0}
                  resizeMode="contain"
                  source={
            authHeroArtwork.source ??
            navientyNowHero
          }
          onError={
            authHeroArtwork.onError
          }
                  style={{
                    height:
                      secondaryArtworkHeight,

                    width:
                      secondaryArtworkWidth,
                  }}
                />
              </View>
            )}

            {/* ============================= */}
            {/* ORGANIC WAVE                  */}
            {/* ============================= */}

            <HeroWave
              height={
                step ===
                'landing'
                  ? waveHeight
                  : 34
              }
              width={
                screenWidth
              }
            />
          </View>

          {/* ================================================= */}
          {/* LANDING                                          */}
          {/* ================================================= */}

          {step ===
            'landing' && (
            <View
              style={[
                styles.landingContent,

                {
                  paddingBottom:
                    dp(
                      REF.bottomSpace,
                    ),

                  paddingHorizontal:
                    dp(
                      REF.contentHorizontalPadding,
                    ),

                  paddingTop:
                    dp(
                      REF.landingTopSpace,
                    ),
                },
              ]}
            >
              {/* =========================== */}
              {/* WELCOME                     */}
              {/* =========================== */}

              <View
                style={[
                  styles.welcomeBlock,

                  {
                    maxWidth:
                      dp(520),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.welcomeTitle,

                    {
                      fontSize:
                        dp(
                          REF.welcomeFontSize,
                        ),

                      lineHeight:
                        dp(
                          REF.welcomeLineHeight,
                        ),
                    },
                  ]}
                >
                  مرحباً!
                </Text>

                <Text
                  style={[
                    styles.welcomeDescription,

                    {
                      fontSize:
                        dp(
                          REF.descriptionFontSize,
                        ),

                      lineHeight:
                        dp(
                          REF.descriptionLineHeight,
                        ),

                      marginTop:
                        dp(
                          REF.descriptionMarginTop,
                        ),

                      maxWidth:
                        dp(
                          REF.descriptionMaxWidth,
                        ),
                    },
                  ]}
                >
                  {authState.status ===
                  'anonymous'
                    ? 'اربط حسابك اختياريًا علشان تقدر تسترجع بياناتك على جهاز آخر'
                    : 'قم بتسجيل الدخول أو الاشتراك واحصل على تجربة طلب مخصصة لك'}
                </Text>
              </View>

              {/* =========================== */}
              {/* PROVIDERS                   */}
              {/* =========================== */}

              <View
                style={[
                  styles.providersContainer,

                  {
                    marginTop:
                      dp(
                        REF.providersMarginTop,
                      ),

                    maxWidth:
                      dp(540),
                  },
                ]}
              >
                {authState.status !==
                  'anonymous' && (
                  <ProviderButton
                    disabled={
                      anythingIsLoading
                    }
                    label="الاستمرار باستخدام رقم الهاتف"
                    provider="phone"
                    scale={
                      landingScale
                    }
                    onPress={
                      openPhoneLogin
                    }
                  />
                )}

                <ProviderButton
                  disabled={
                    anythingIsLoading
                  }
                  label="إستمرار عبر جوجل"
                  loading={
                    socialProvider ===
                    'google'
                  }
                  provider="google"
                  scale={
                    landingScale
                  }
                  onPress={() => {
                    void signInWithSocialProvider(
                      'google',
                    );
                  }}
                />

                {Platform.OS ===
                'ios' ? (
                  <NativeAppleProviderButton
                    disabled={
                      anythingIsLoading
                    }
                    loading={
                      socialProvider ===
                      'apple'
                    }
                    scale={
                      landingScale
                    }
                    onPress={() => {
                      void signInWithSocialProvider(
                        'apple',
                      );
                    }}
                  />
                ) : (
                  <ProviderButton
                    disabled={
                      anythingIsLoading
                    }
                    label="إستمرار عبر Apple"
                    loading={
                      socialProvider ===
                      'apple'
                    }
                    provider="apple"
                    scale={
                      landingScale
                    }
                    onPress={() => {
                      void signInWithSocialProvider(
                        'apple',
                      );
                    }}
                  />
                )}

                <ProviderButton
                  disabled={
                    anythingIsLoading
                  }
                  label="إستمرار عبر الفيسبوك"
                  loading={
                    socialProvider ===
                    'facebook'
                  }
                  provider="facebook"
                  scale={
                    landingScale
                  }
                  onPress={() => {
                    void signInWithSocialProvider(
                      'facebook',
                    );
                  }}
                />
              </View>

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
                    {
                      formMessage.text
                    }
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ================================================= */}
          {/* PHONE                                            */}
          {/* ================================================= */}

          {step ===
            'phone' && (
            <View
              style={
                styles.formContent
              }
            >
              <View
                style={
                  styles.authFormSection
                }
              >
                <Text
                  style={
                    styles.authFormTitle
                  }
                >
                  أدخل رقم هاتفك
                </Text>

                <Text
                  style={
                    styles.authFormDescription
                  }
                >
                  هنرسل لك رمز تحقق مكوّن من 6 أرقام عبر WhatsApp
                </Text>

                <View
                  style={
                    styles.phoneField
                  }
                >
                  <View
                    style={
                      styles.countryCode
                    }
                  >
                    <Text
                      style={
                        styles.countryCodeText
                      }
                    >
                      +20
                    </Text>
                  </View>

                  <TextInput
                    accessibilityLabel="رقم الموبايل المصري"
                    autoFocus
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
                    style={
                      styles.phoneInput
                    }
                    textContentType="telephoneNumber"
                    value={
                      phoneInput
                    }
                    onChangeText={
                      setPhoneInput
                    }
                    onSubmitEditing={() => {
                      if (
                        phoneFormIsValid
                      ) {
                        void sendOtp();
                      }
                    }}
                  />
                </View>

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
                      {
                        formMessage.text
                      }
                    </Text>
                  </View>
                )}

                <Pressable
                  accessibilityRole="button"
                  disabled={
                    isSubmitting ||
                    !phoneFormIsValid
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.primaryButton,

                    (
                      !phoneFormIsValid ||
                      isSubmitting
                    ) &&
                      styles.primaryButtonDisabled,

                    pressed &&
                      phoneFormIsValid &&
                      !isSubmitting &&
                      styles.primaryButtonPressed,
                  ]}
                  onPress={() => {
                    void sendOtp();
                  }}
                >
                  <View
                    style={
                      styles.primaryButtonContent
                    }
                  >
                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      إرسال الرمز عبر WhatsApp
                    </Text>

                    {isSubmitting ? (
                      <ActivityIndicator
                        color={
                          NAVIENTY_NOW_COLORS.white
                        }
                        size="small"
                      />
                    ) : (
                      <FontAwesome
                        color="#FFFFFF"
                        name="whatsapp"
                        size={23}
                      />
                    )}
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  style={({
                    pressed,
                  }) => [
                    styles.secondaryAction,

                    pressed &&
                      styles.secondaryActionPressed,
                  ]}
                  onPress={
                    goBackToLanding
                  }
                >
                  <Text
                    style={
                      styles.secondaryActionText
                    }
                  >
                    استخدام طريقة أخرى
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ================================================= */}
          {/* OTP                                              */}
          {/* ================================================= */}

          {step ===
            'otp' && (
            <View
              style={
                styles.formContent
              }
            >
              <View
                style={
                  styles.authFormSection
                }
              >
                <Text
                  style={
                    styles.authFormTitle
                  }
                >
                  أدخل رمز التحقق
                </Text>

                <Text
                  style={
                    styles.authFormDescription
                  }
                >
                  أرسلنا رمزًا من 6 أرقام عبر WhatsApp إلى{' '}
                  {verifiedPhone
                    ? maskPhone(
                        verifiedPhone,
                      )
                    : 'رقمك'}
                </Text>

                <TextInput
                  accessibilityLabel="رمز التحقق"
                  autoFocus
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor="#B6B6BA"
                  returnKeyType="done"
                  selectionColor={
                    NAVIENTY_NOW_COLORS.primary
                  }
                  style={
                    styles.otpInput
                  }
                  textContentType="oneTimeCode"
                  value={
                    otpCode
                  }
                  onChangeText={(
                    value,
                  ) => {
                    setOtpCode(
                      value
                        .replace(
                          /\D/g,
                          '',
                        )
                        .slice(
                          0,
                          6,
                        ),
                    );
                  }}
                  onSubmitEditing={() => {
                    if (
                      otpFormIsValid
                    ) {
                      void verifyOtp();
                    }
                  }}
                />

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
                      {
                        formMessage.text
                      }
                    </Text>
                  </View>
                )}

                <Pressable
                  accessibilityRole="button"
                  disabled={
                    isSubmitting ||
                    !otpFormIsValid
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.primaryButton,

                    (
                      !otpFormIsValid ||
                      isSubmitting
                    ) &&
                      styles.primaryButtonDisabled,

                    pressed &&
                      otpFormIsValid &&
                      !isSubmitting &&
                      styles.primaryButtonPressed,
                  ]}
                  onPress={() => {
                    void verifyOtp();
                  }}
                >
                  <View
                    style={
                      styles.primaryButtonContent
                    }
                  >
                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      تأكيد الدخول
                    </Text>

                    {isSubmitting ? (
                      <ActivityIndicator
                        color={
                          NAVIENTY_NOW_COLORS.white
                        }
                        size="small"
                      />
                    ) : (
                      <Ionicons
                        color="#FFFFFF"
                        name="checkmark-circle-outline"
                        size={22}
                      />
                    )}
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  disabled={
                    isSubmitting
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.secondaryAction,

                    pressed &&
                      styles.secondaryActionPressed,
                  ]}
                  onPress={() => {
                    void sendOtp();
                  }}
                >
                  <Text
                    style={
                      styles.secondaryActionText
                    }
                  >
                    إعادة إرسال الرمز عبر WhatsApp
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  disabled={
                    isSubmitting
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.editPhoneAction,

                    pressed &&
                      styles.secondaryActionPressed,
                  ]}
                  onPress={() => {
                    setOtpCode('');

                    setFormMessage(
                      null,
                    );

                    setVerifiedPhone(
                      null,
                    );

                    setStep(
                      'phone',
                    );
                  }}
                >
                  <Text
                    style={
                      styles.editPhoneActionText
                    }
                  >
                    تعديل رقم الهاتف
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    /**
     * ========================================================
     * ROOT
     * ========================================================
     */

    safeArea: {
      backgroundColor:
        AUTH_HERO_BACKGROUND,

      flex: 1,
    },

    screen: {
      backgroundColor:
        AUTH_WHITE,

      flex: 1,
    },

    pageContent: {
      backgroundColor:
        AUTH_WHITE,

      flexGrow: 1,
    },

    /**
     * ========================================================
     * HERO
     * ========================================================
     */

    heroSection: {
      backgroundColor:
        AUTH_HERO_BACKGROUND,

      overflow:
        'hidden',

      position:
        'relative',

      width:
        '100%',
    },

    heroArtworkContainer: {
      bottom: 0,

      left: 0,

      position:
        'absolute',

      right: 0,

      top: 0,

      zIndex: 5,
    },

    heroArtworkImage: {
      height:
        '100%',

      width:
        '100%',
    },

    secondaryArtworkContainer: {
      alignItems:
        'center',

      bottom: 36,

      justifyContent:
        'center',

      left: 0,

      position:
        'absolute',

      right: 0,

      top: 25,

      zIndex: 5,
    },

    /**
     * ========================================================
     * BACK BUTTON
     * ========================================================
     */

    backButton: {
      alignItems:
        'center',

      backgroundColor:
        AUTH_WHITE,

      borderColor:
        '#DEDFE0',

      borderRadius:
        999,

      borderWidth:
        1,

      justifyContent:
        'center',

      position:
        'absolute',

      zIndex:
        50,

      shadowColor:
        '#000000',

      shadowOffset: {
        height: 1,
        width: 0,
      },

      shadowOpacity:
        0.04,

      shadowRadius:
        5,

      elevation:
        2,
    },

    secondaryBackButton: {
      height:
        52,

      right:
        NAVIENTY_NOW_LAYOUT.pageGutter,

      top:
        14,

      width:
        52,
    },

    backButtonPressed: {
      opacity:
        0.62,

      transform: [
        {
          scale:
            0.97,
        },
      ],
    },

    /**
     * ========================================================
     * WAVE
     * ========================================================
     */

    heroWave: {
      bottom:
        -1,

      left:
        0,

      position:
        'absolute',

      right:
        0,

      zIndex:
        30,
    },

    /**
     * ========================================================
     * LANDING CONTENT
     * ========================================================
     */

    landingContent: {
      backgroundColor:
        AUTH_WHITE,

      flexGrow:
        1,

      width:
        '100%',
    },

    /**
     * ========================================================
     * WELCOME
     * ========================================================
     */

    welcomeBlock: {
      alignItems:
        'center',

      alignSelf:
        'center',

      width:
        '100%',
    },

    welcomeTitle: {
      color:
        NAVIENTY_NOW_COLORS.text,

      fontWeight:
        '800',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    welcomeDescription: {
      color:
        NAVIENTY_NOW_COLORS.text,

      fontWeight:
        '400',

      paddingHorizontal:
        4,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    /**
     * ========================================================
     * PROVIDERS
     * ========================================================
     */

    providersContainer: {
      alignSelf:
        'center',

      width:
        '100%',
    },

    providerButton: {
      alignItems:
        'center',

      backgroundColor:
        AUTH_WHITE,

      borderColor:
        AUTH_BORDER,

      borderWidth:
        1.15,

      justifyContent:
        'center',

      width:
        '100%',
    },

    providerButtonPressed: {
      backgroundColor:
        '#FAFAFA',

      transform: [
        {
          scale:
            0.994,
        },
      ],
    },

    providerButtonDisabled: {
      opacity:
        0.5,
    },

    nativeAppleButtonContainer: {
      position:
        'relative',

      width:
        '100%',
    },

    nativeAppleButton: {
      height:
        '100%',

      width:
        '100%',
    },

    nativeAppleLoadingOverlay: {
      alignItems:
        'center',

      backgroundColor:
        'rgba(255, 255, 255, 0.88)',

      bottom:
        1,

      justifyContent:
        'center',

      left:
        1,

      position:
        'absolute',

      right:
        1,

      top:
        1,
    },

    providerButtonContent: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'center',
    },

    providerButtonText: {
      color:
        NAVIENTY_NOW_COLORS.text,

      fontWeight:
        '700',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    providerIcon: {
      alignItems:
        'center',

      justifyContent:
        'center',
    },

    /**
     * ========================================================
     * PHONE / OTP CONTENT
     * ========================================================
     */

    formContent: {
      backgroundColor:
        AUTH_WHITE,

      flexGrow:
        1,

      paddingBottom:
        44,

      paddingHorizontal:
        NAVIENTY_NOW_LAYOUT.pageGutter,

      paddingTop:
        48,

      width:
        '100%',
    },

    authFormSection: {
      alignSelf:
        'center',

      maxWidth:
        520,

      width:
        '100%',
    },

    authFormTitle: {
      color:
        NAVIENTY_NOW_COLORS.text,

      fontSize:
        29,

      fontWeight:
        '800',

      lineHeight:
        40,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    authFormDescription: {
      color:
        NAVIENTY_NOW_COLORS.textSecondary,

      fontSize:
        15,

      lineHeight:
        25,

      marginTop:
        12,

      paddingHorizontal:
        14,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    /**
     * ========================================================
     * PHONE
     * ========================================================
     */

    phoneField: {
      alignItems:
        'center',

      backgroundColor:
        AUTH_WHITE,

      borderColor:
        AUTH_BORDER,

      borderRadius:
        999,

      borderWidth:
        1.2,

      flexDirection:
        'row',

      height:
        64,

      marginTop:
        34,

      overflow:
        'hidden',
    },

    countryCode: {
      alignItems:
        'center',

      borderRightColor:
        NAVIENTY_NOW_COLORS.border,

      borderRightWidth:
        1,

      height:
        '100%',

      justifyContent:
        'center',

      paddingHorizontal:
        18,
    },

    countryCodeText: {
      color:
        NAVIENTY_NOW_COLORS.text,

      fontSize:
        16,

      fontWeight:
        '700',

      writingDirection:
        'ltr',
    },

    phoneInput: {
      color:
        NAVIENTY_NOW_COLORS.text,

      flex:
        1,

      fontSize:
        17,

      height:
        '100%',

      paddingHorizontal:
        18,

      textAlign:
        'left',

      writingDirection:
        'ltr',
    },

    /**
     * ========================================================
     * OTP
     * ========================================================
     */

    otpInput: {
      backgroundColor:
        AUTH_WHITE,

      borderColor:
        AUTH_BORDER,

      borderRadius:
        22,

      borderWidth:
        1.2,

      color:
        NAVIENTY_NOW_COLORS.text,

      fontSize:
        29,

      fontWeight:
        '800',

      height:
        72,

      letterSpacing:
        11,

      marginTop:
        32,

      paddingHorizontal:
        20,

      textAlign:
        'center',

      writingDirection:
        'ltr',
    },

    /**
     * ========================================================
     * PRIMARY ACTION
     * ========================================================
     */

    primaryButton: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      borderRadius:
        999,

      height:
        64,

      justifyContent:
        'center',

      marginTop:
        21,

      paddingHorizontal:
        20,
    },

    primaryButtonContent: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'center',
    },

    primaryButtonDisabled: {
      opacity:
        0.45,
    },

    primaryButtonPressed: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primaryPressed,

      transform: [
        {
          scale:
            0.994,
        },
      ],
    },

    primaryButtonText: {
      color:
        NAVIENTY_NOW_COLORS.white,

      fontSize:
        17,

      fontWeight:
        '800',

      marginRight:
        11,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    secondaryAction: {
      alignItems:
        'center',

      justifyContent:
        'center',

      marginTop:
        13,

      minHeight:
        46,
    },

    secondaryActionPressed: {
      opacity:
        0.55,
    },

    secondaryActionText: {
      color:
        NAVIENTY_NOW_COLORS.primaryDark,

      fontSize:
        14,

      fontWeight:
        '800',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    editPhoneAction: {
      alignItems:
        'center',

      justifyContent:
        'center',

      minHeight:
        42,
    },

    editPhoneActionText: {
      color:
        NAVIENTY_NOW_COLORS.textSecondary,

      fontSize:
        13,

      fontWeight:
        '700',

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    /**
     * ========================================================
     * MESSAGES
     * ========================================================
     */

    messageCard: {
      borderRadius:
        14,

      borderWidth:
        1,

      marginTop:
        17,

      paddingHorizontal:
        14,

      paddingVertical:
        11,
    },

    errorMessageCard: {
      backgroundColor:
        '#FFF5F5',

      borderColor:
        '#F1CCCC',
    },

    successMessageCard: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primaryUltraPale,

      borderColor:
        '#CDEAD8',
    },

    messageText: {
      fontSize:
        12,

      lineHeight:
        19,

      textAlign:
        'center',

      writingDirection:
        'rtl',
    },

    errorMessageText: {
      color:
        '#A13838',
    },

    successMessageText: {
      color:
        NAVIENTY_NOW_COLORS.primaryDark,
    },

    /**
     * ========================================================
     * LOADING
     * ========================================================
     */

    loadingScreen: {
      alignItems:
        'center',

      backgroundColor:
        AUTH_HERO_BACKGROUND,

      flex:
        1,

      justifyContent:
        'center',

      padding:
        24,
    },

    loadingLogo: {
      height:
        280,

      width:
        340,
    },
  });
