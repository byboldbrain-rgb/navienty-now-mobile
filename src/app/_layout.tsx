import {
  Stack,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import AppLaunchBlockScreen from '../components/app-launch-block-screen';
import GlobalCartDockBridge from '../components/cart/global-cart-dock-bridge';
import OrderRealtimeBridge from '../components/order-realtime-bridge';
import PaymentProofRouteBridge from '../components/payment-proof-route-bridge';
import PushNotificationsBridge from '../components/push-notifications-bridge';
import {
  ensureAppSession,
} from '../services/anonymous-auth-service';
import {
  getAppLaunchGate,
  type AppLaunchGateResult,
} from '../services/app-launch-gate-service';
import getAppBootstrap from '../services/bootstrap-service';
import { logMobileClientError } from '../services/mobile-error-telemetry-service';
import {
  recordStartupTimingOnce,
} from '../services/startup-performance-service';
import { useCartStore } from '../store/cart-store';
import { useCustomerStore } from '../store/customer-store';
import { useOrdersStore } from '../store/orders-store';
import { NAVIENTY_NOW_COLORS } from '../theme/navienty-now-theme';

/*
 * Force Expo Router to use Home as the initial route.
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

/*
 * These are bundled startup assets.
 *
 * Splash artwork intentionally stays local instead of depending on
 * Supabase/database artwork during cold start. This lets the animation
 * begin immediately after the native launch screen hands control to
 * React Native.
 */
const bootstrapFullLogo = require(
  '../assets/images/navienty-now-bootstrap-full.png',
);

const bootstrapDot = require(
  '../assets/images/navienty-now-bootstrap-dot.png',
);

const BOOTSTRAP_LOGO_ASPECT_RATIO =
  1385 / 565;

/*
 * Splash animation timing.
 *
 * Native:
 * solid Navienty green
 *
 * React Native takeover:
 * dot drops
 * -> wordmark reveals
 * -> waits only if startup is still resolving
 * -> fades directly into the app.
 */
const DOT_START_DELAY_MS = 45;

const DOT_DROP_DURATION_MS = 250;

const WORDMARK_REVEAL_DURATION_MS = 320;

const READY_HOLD_MS = 90;

const EXIT_FADE_DURATION_MS = 190;

const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000;

const LAUNCH_GATE_TIMEOUT_MS = 10000;

const DEVELOPMENT_HYDRATION_TIMEOUT_MS =
  6000;

const PRODUCTION_LIKE_STARTUP_DIAGNOSTICS_ENABLED =
  process.env
    .EXPO_PUBLIC_STARTUP_DIAGNOSTICS ===
  '1';

const DEVELOPMENT_ALLOWED_LAUNCH_GATE:
  AppLaunchGateResult = {
    status: 'allowed',
    currentVersion: null,
    minimumVersion: null,
    messageAr: null,
    updateUrl: null,
    supportWhatsapp: null,
  };

const LAUNCH_GATE_TIMEOUT_RESULT:
  AppLaunchGateResult = {
    status: 'error',
    currentVersion: null,
    minimumVersion: null,
    messageAr:
      'تعذر الاتصال بخدمة Navienty Now. تحقق من الإنترنت وحاول مرة أخرى.',
    updateUrl: null,
    supportWhatsapp: null,
  };

async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId:
    | ReturnType<typeof setTimeout>
    | null = null;

  try {
    return await Promise.race([
      task,

      new Promise<never>(
        (_resolve, reject) => {
          timeoutId = setTimeout(
            () => {
              reject(
                new Error(
                  message,
                ),
              );
            },
            timeoutMs,
          );
        },
      ),
    ]);
  } finally {
    if (
      timeoutId !== null
    ) {
      clearTimeout(
        timeoutId,
      );
    }
  }
}

/*
 * Keep the native splash visible until our React bootstrap layer has
 * physically mounted.
 *
 * This avoids:
 *
 * native splash
 * -> blank frame
 * -> animated splash
 *
 * Instead we get:
 *
 * native green
 * -> identical React green
 * -> animation
 */
void SplashScreen.preventAutoHideAsync().catch(
  () => {
    /*
     * Safe during Fast Refresh or if the
     * native splash has already disappeared.
     */
  },
);

type AppBootstrapScreenProps = {
  isReady: boolean;
  onFinished: () => void;
};

function AppBootstrapScreen({
  isReady,
  onFinished,
}: AppBootstrapScreenProps) {
  const {
    width: windowWidth,
  } = useWindowDimensions();

  const nativeSplashHiddenRef =
    useRef(false);

  const nativeHandoffCompletedRef =
    useRef(false);

  const exitStartedRef =
    useRef(false);

  const finishedRef =
    useRef(false);

  const holdTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  /*
   * Animation is deliberately prevented from starting
   * until the native splash has been hidden.
   *
   * This guarantees that no part of the animation runs
   * invisibly behind the native screen.
   */
  const [
    nativeSplashHandedOff,
    setNativeSplashHandedOff,
  ] = useState(false);

  const [
    introFinished,
    setIntroFinished,
  ] = useState(false);

  const dotOpacity = useRef(
    new Animated.Value(0),
  ).current;

  const dotTranslateY = useRef(
    new Animated.Value(-58),
  ).current;

  const dotScale = useRef(
    new Animated.Value(0.94),
  ).current;

  const revealCoverTranslateX =
    useRef(
      new Animated.Value(0),
    ).current;

  const screenOpacity = useRef(
    new Animated.Value(1),
  ).current;

  const logoWidth = Math.min(
    330,
    Math.max(
      235,
      windowWidth * 0.7,
    ),
  );

  const logoHeight =
    logoWidth /
    BOOTSTRAP_LOGO_ASPECT_RATIO;

  const hideNativeSplash =
    useCallback(() => {
      if (
        nativeSplashHiddenRef.current
      ) {
        return;
      }

      try {
        SplashScreen.hide();

        nativeSplashHiddenRef.current =
          true;
      } catch (error) {
        console.warn(
          'Unable to hide native splash screen:',
          error,
        );
      }
    }, []);

  /*
   * This is the important seamless handoff.
   *
   * The React layer already has the exact same #00B14F background.
   * Only after that layer has laid out do we remove the native screen.
   *
   * The first visible React frame is therefore visually identical
   * to the previous native frame.
   */
  const handleBootstrapLayout =
    useCallback(() => {
      if (
        nativeHandoffCompletedRef.current
      ) {
        return;
      }

      nativeHandoffCompletedRef.current =
        true;

      hideNativeSplash();

      setNativeSplashHandedOff(
        true,
      );
    }, [
      hideNativeSplash,
    ]);

  const finishBootstrap =
    useCallback(() => {
      if (
        finishedRef.current
      ) {
        return;
      }

      finishedRef.current =
        true;

      onFinished();
    }, [
      onFinished,
    ]);

  /*
   * Safety fallback.
   *
   * It should never normally be reached, but prevents the animated
   * overlay from permanently blocking the application if an animation
   * completion callback is interrupted by the OS.
   */
  useEffect(() => {
    if (!isReady) {
      return;
    }

    const fallbackTimer =
      setTimeout(
        finishBootstrap,
        2500,
      );

    return () => {
      clearTimeout(
        fallbackTimer,
      );
    };
  }, [
    finishBootstrap,
    isReady,
  ]);

  /*
   * Start animation only AFTER native splash handoff.
   *
   * Initial state:
   * green screen only.
   *
   * Then:
   * 1. white dot fades/drops into position.
   * 2. wordmark is revealed.
   */
  useEffect(() => {
    if (
      !nativeSplashHandedOff
    ) {
      return;
    }

    setIntroFinished(
      false,
    );

    dotOpacity.setValue(0);

    dotTranslateY.setValue(
      -58,
    );

    dotScale.setValue(
      0.94,
    );

    revealCoverTranslateX.setValue(
      0,
    );

    const introAnimation =
      Animated.sequence([
        Animated.delay(
          DOT_START_DELAY_MS,
        ),

        Animated.parallel([
          Animated.timing(
            dotOpacity,
            {
              toValue: 1,

              duration: 90,

              easing:
                Easing.out(
                  Easing.quad,
                ),

              useNativeDriver:
                true,
            },
          ),

          Animated.timing(
            dotTranslateY,
            {
              toValue: 0,

              duration:
                DOT_DROP_DURATION_MS,

              easing:
                Easing.bezier(
                  0.22,
                  0.84,
                  0.31,
                  1,
                ),

              useNativeDriver:
                true,
            },
          ),

          Animated.timing(
            dotScale,
            {
              toValue: 1,

              duration:
                DOT_DROP_DURATION_MS,

              easing:
                Easing.out(
                  Easing.cubic,
                ),

              useNativeDriver:
                true,
            },
          ),
        ]),

        Animated.timing(
          revealCoverTranslateX,
          {
            toValue:
              logoWidth,

            duration:
              WORDMARK_REVEAL_DURATION_MS,

            easing:
              Easing.bezier(
                0.22,
                0.72,
                0.22,
                1,
              ),

            useNativeDriver:
              true,
          },
        ),
      ]);

    introAnimation.start(
      ({
        finished,
      }) => {
        if (finished) {
          setIntroFinished(
            true,
          );
        }
      },
    );

    return () => {
      introAnimation.stop();
    };
  }, [
    dotOpacity,
    dotScale,
    dotTranslateY,
    logoWidth,
    nativeSplashHandedOff,
    revealCoverTranslateX,
  ]);

  /*
   * When BOTH:
   *
   * - animation is finished
   * - startup dependencies are ready
   *
   * fade the splash directly into the application.
   */
  useEffect(() => {
    if (
      !introFinished ||
      !isReady ||
      exitStartedRef.current
    ) {
      return;
    }

    exitStartedRef.current =
      true;

    holdTimerRef.current =
      setTimeout(() => {
        Animated.timing(
          screenOpacity,
          {
            toValue: 0,

            duration:
              EXIT_FADE_DURATION_MS,

            easing:
              Easing.inOut(
                Easing.quad,
              ),

            useNativeDriver:
              true,
          },
        ).start(() => {
          finishBootstrap();
        });
      }, READY_HOLD_MS);

    return () => {
      if (
        holdTimerRef.current
      ) {
        clearTimeout(
          holdTimerRef.current,
        );

        holdTimerRef.current =
          null;
      }
    };
  }, [
    finishBootstrap,
    introFinished,
    isReady,
    screenOpacity,
  ]);

  return (
    <Animated.View
      accessibilityLabel="Navienty Now"
      accessibilityRole="progressbar"
      onLayout={
        handleBootstrapLayout
      }
      style={[
        styles.bootstrapScreen,

        {
          opacity:
            screenOpacity,
        },
      ]}
    >
      <View
        style={[
          styles.logoStage,

          {
            height:
              logoHeight,

            width:
              logoWidth,
          },
        ]}
      >
        {/*
         * Full white logo exists underneath the green reveal cover.
         *
         * Because the cover uses the exact same green as the screen,
         * the wordmark is initially completely invisible.
         */}
        <View
          pointerEvents="none"
          style={[
            styles.wordmarkLayer,

            {
              height:
                logoHeight,

              width:
                logoWidth,
            },
          ]}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={
              bootstrapFullLogo
            }
            style={{
              height:
                logoHeight,

              width:
                logoWidth,
            }}
          />

          <Animated.View
            pointerEvents="none"
            style={[
              styles.wordmarkRevealCover,

              {
                height:
                  logoHeight,

                transform: [
                  {
                    translateX:
                      revealCoverTranslateX,
                  },
                ],

                width:
                  logoWidth,
              },
            ]}
          />
        </View>

        {/*
         * Separate dot layer.
         *
         * It falls first; the rest of the logo reveals immediately after.
         */}
        <Animated.Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={
            bootstrapDot
          }
          style={[
            styles.dotLayer,

            {
              height:
                logoHeight,

              opacity:
                dotOpacity,

              transform: [
                {
                  translateY:
                    dotTranslateY,
                },

                {
                  scale:
                    dotScale,
                },
              ],

              width:
                logoWidth,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

export function ErrorBoundary({
  error,
  retry,
}: ErrorBoundaryProps) {
  useEffect(() => {
    void logMobileClientError({
      source:
        'react_error_boundary',

      error,
    });
  }, [
    error,
  ]);

  return (
    <View
      style={
        styles.errorBoundaryScreen
      }
    >
      <Text
        style={
          styles.errorBoundaryTitle
        }
      >
        حدث خطأ غير متوقع
      </Text>

      <Text
        style={
          styles.errorBoundaryMessage
        }
      >
        لم نتمكن من عرض هذه الصفحة.
        حاول مرة أخرى، وإذا استمرت
        المشكلة تواصل مع الدعم.
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void retry();
        }}
        style={({
          pressed,
        }) => [
          styles.errorBoundaryButton,

          pressed &&
            styles.errorBoundaryButtonPressed,
        ]}
      >
        <Text
          style={
            styles.errorBoundaryButtonText
          }
        >
          إعادة المحاولة
        </Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [
    rootLayoutStartedAt,
  ] = useState(
    () => Date.now(),
  );

  const cartHasHydrated =
    useCartStore(
      (state) =>
        state.hasHydrated,
    );

  const customerHasHydrated =
    useCustomerStore(
      (state) =>
        state.hasHydrated,
    );

  const ordersHasHydrated =
    useOrdersStore(
      (state) =>
        state.hasHydrated,
    );

  const [
    authBootstrapFinished,
    setAuthBootstrapFinished,
  ] = useState(false);

  const [
    launchGate,
    setLaunchGate,
  ] =
    useState<AppLaunchGateResult | null>(
      __DEV__ &&
      !PRODUCTION_LIKE_STARTUP_DIAGNOSTICS_ENABLED
        ? DEVELOPMENT_ALLOWED_LAUNCH_GATE
        : null,
    );

  const [
    isRefreshingLaunchGate,
    setIsRefreshingLaunchGate,
  ] = useState(false);

  const [
    developmentHydrationFallbackReached,
    setDevelopmentHydrationFallbackReached,
  ] = useState(false);

  const [
    showBootstrapScreen,
    setShowBootstrapScreen,
  ] = useState(true);

  /*
   * Auth and launch gate start in parallel.
   */
  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      try {
        await withTimeout(
          ensureAppSession(),

          AUTH_BOOTSTRAP_TIMEOUT_MS,

          'Supabase auth bootstrap timed out.',
        );
      } catch (error) {
        console.warn(
          'Unable to bootstrap anonymous Supabase session:',
          error,
        );
      } finally {
        if (
          !cancelled
        ) {
          setAuthBootstrapFinished(
            true,
          );
        }
      }
    }

    void bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      __DEV__ &&
      !PRODUCTION_LIKE_STARTUP_DIAGNOSTICS_ENABLED
    ) {
      console.log(
        '[Navienty] Development launch gate bypass enabled.',
      );

      return;
    }

    let cancelled =
      false;

    async function bootstrapLaunchGate() {
      let result:
        AppLaunchGateResult;

      try {
        result =
          await withTimeout(
            getAppLaunchGate(),

            LAUNCH_GATE_TIMEOUT_MS,

            'App launch gate timed out.',
          );
      } catch (error) {
        console.warn(
          'Unable to resolve app launch gate before timeout:',
          error,
        );

        result =
          LAUNCH_GATE_TIMEOUT_RESULT;
      }

      if (
        !cancelled
      ) {
        setLaunchGate(
          result,
        );
      }
    }

    void bootstrapLaunchGate();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLaunchGate =
    useCallback(
      async () => {
        if (
          isRefreshingLaunchGate
        ) {
          return;
        }

        setIsRefreshingLaunchGate(
          true,
        );

        try {
          if (
            __DEV__ &&
            !PRODUCTION_LIKE_STARTUP_DIAGNOSTICS_ENABLED
          ) {
            setLaunchGate(
              DEVELOPMENT_ALLOWED_LAUNCH_GATE,
            );

            return;
          }

          let result:
            AppLaunchGateResult;

          try {
            result =
              await withTimeout(
                getAppLaunchGate(),

                LAUNCH_GATE_TIMEOUT_MS,

                'App launch gate refresh timed out.',
              );
          } catch (error) {
            console.warn(
              'Unable to refresh app launch gate before timeout:',
              error,
            );

            result =
              LAUNCH_GATE_TIMEOUT_RESULT;
          }

          setLaunchGate(
            result,
          );
        } finally {
          setIsRefreshingLaunchGate(
            false,
          );
        }
      },
      [
        isRefreshingLaunchGate,
      ],
    );

  const appHasHydrated =
    cartHasHydrated &&
    customerHasHydrated &&
    ordersHasHydrated;

  useEffect(() => {
    if (
      !__DEV__ ||
      PRODUCTION_LIKE_STARTUP_DIAGNOSTICS_ENABLED ||
      appHasHydrated ||
      developmentHydrationFallbackReached
    ) {
      return;
    }

    const timeoutId =
      setTimeout(() => {
        console.warn(
          '[Navienty] Development storage hydration timed out; continuing without blocking the UI.',
          {
            cartHasHydrated,
            customerHasHydrated,
            ordersHasHydrated,
          },
        );

        setDevelopmentHydrationFallbackReached(
          true,
        );
      }, DEVELOPMENT_HYDRATION_TIMEOUT_MS);

    return () => {
      clearTimeout(
        timeoutId,
      );
    };
  }, [
    appHasHydrated,
    cartHasHydrated,
    customerHasHydrated,
    developmentHydrationFallbackReached,
    ordersHasHydrated,
  ]);

  const storageBootstrapFinished =
    appHasHydrated ||
    (
      __DEV__ &&
      !PRODUCTION_LIKE_STARTUP_DIAGNOSTICS_ENABLED &&
      developmentHydrationFallbackReached
    );

  const launchGateStatus =
    launchGate?.status ??
    null;

  useEffect(() => {
    if (
      launchGateStatus !==
      'allowed'
    ) {
      return;
    }

    /*
     * Start Home bootstrap as soon as launch gate allows it.
     *
     * The request can run while the splash animation is still visible,
     * so the animation is useful startup time rather than extra delay.
     */
    void getAppBootstrap().catch(
      (error) => {
        if (__DEV__) {
          console.warn(
            'Unable to prefetch Home bootstrap during startup.',
            error,
          );
        }
      },
    );
  }, [
    launchGateStatus,
  ]);

  const startupHasResolved =
    storageBootstrapFinished &&
    (
      (
        __DEV__ &&
        !PRODUCTION_LIKE_STARTUP_DIAGNOSTICS_ENABLED
      ) ||
      authBootstrapFinished
    ) &&
    launchGate !== null;

  useEffect(() => {
    if (
      !cartHasHydrated
    ) {
      return;
    }

    recordStartupTimingOnce(
      'root-layout-to-cart-hydrated',

      Date.now() -
        rootLayoutStartedAt,

      {
        storage:
          'async-storage',
      },
    );
  }, [
    cartHasHydrated,
    rootLayoutStartedAt,
  ]);

  useEffect(() => {
    if (
      !customerHasHydrated
    ) {
      return;
    }

    recordStartupTimingOnce(
      'root-layout-to-customer-hydrated',

      Date.now() -
        rootLayoutStartedAt,

      {
        storage:
          Platform.OS ===
          'web'
            ? 'async-storage'
            : 'secure-store',
      },
    );
  }, [
    customerHasHydrated,
    rootLayoutStartedAt,
  ]);

  useEffect(() => {
    if (
      !ordersHasHydrated
    ) {
      return;
    }

    recordStartupTimingOnce(
      'root-layout-to-orders-hydrated',

      Date.now() -
        rootLayoutStartedAt,

      {
        storage:
          Platform.OS ===
          'web'
            ? 'async-storage'
            : 'secure-store',
      },
    );
  }, [
    ordersHasHydrated,
    rootLayoutStartedAt,
  ]);

  useEffect(() => {
    if (
      !authBootstrapFinished
    ) {
      return;
    }

    recordStartupTimingOnce(
      'root-layout-to-auth-finished',

      Date.now() -
        rootLayoutStartedAt,

      {
        blocking:
          !__DEV__ ||
          PRODUCTION_LIKE_STARTUP_DIAGNOSTICS_ENABLED,
      },
    );
  }, [
    authBootstrapFinished,
    rootLayoutStartedAt,
  ]);

  useEffect(() => {
    if (
      !launchGate
    ) {
      return;
    }

    recordStartupTimingOnce(
      'root-layout-to-launch-gate-resolved',

      Date.now() -
        rootLayoutStartedAt,

      {
        status:
          launchGate.status,
      },
    );
  }, [
    launchGate,
    rootLayoutStartedAt,
  ]);

  useEffect(() => {
    if (
      !startupHasResolved
    ) {
      return;
    }

    recordStartupTimingOnce(
      'root-layout-to-startup-resolved',

      Date.now() -
        rootLayoutStartedAt,

      {
        productionLikeDiagnostics:
          PRODUCTION_LIKE_STARTUP_DIAGNOSTICS_ENABLED,
      },
    );
  }, [
    rootLayoutStartedAt,
    startupHasResolved,
  ]);

  useEffect(() => {
    if (
      !__DEV__
    ) {
      return;
    }

    console.log(
      '[Navienty] Startup readiness:',
      {
        cartHasHydrated,

        customerHasHydrated,

        ordersHasHydrated,

        authBootstrapFinished,

        launchGateStatus,

        developmentHydrationFallbackReached,

        startupHasResolved,

        productionLikeStartupDiagnostics:
          PRODUCTION_LIKE_STARTUP_DIAGNOSTICS_ENABLED,
      },
    );
  }, [
    authBootstrapFinished,
    cartHasHydrated,
    customerHasHydrated,
    developmentHydrationFallbackReached,
    launchGateStatus,
    ordersHasHydrated,
    startupHasResolved,
  ]);

  const appIsAllowed =
    launchGateStatus ===
    'allowed';

  const finishBootstrap =
    useCallback(() => {
      recordStartupTimingOnce(
        'root-layout-to-bootstrap-hidden',

        Date.now() -
          rootLayoutStartedAt,

        {
          productionLikeDiagnostics:
            PRODUCTION_LIKE_STARTUP_DIAGNOSTICS_ENABLED,
        },
      );

      setShowBootstrapScreen(
        false,
      );
    }, [
      rootLayoutStartedAt,
    ]);

  return (
    <View
      style={
        styles.root
      }
    >
      <StatusBar
        style={
          showBootstrapScreen
            ? 'light'
            : 'dark'
        }
      />

      {startupHasResolved &&
      appIsAllowed ? (
        <>
          {Platform.OS !==
            'web' && (
            <PushNotificationsBridge
              enabled={
                !showBootstrapScreen
              }
            />
          )}

          <OrderRealtimeBridge />

          <PaymentProofRouteBridge />

          <Stack
            screenOptions={{
              animation:
                'fade',

              contentStyle: {
                backgroundColor:
                  NAVIENTY_NOW_COLORS.page,
              },

              headerShown:
                false,
            }}
          >
            <Stack.Screen
              name="index"
              options={{
                headerShown:
                  false,
              }}
            />

            {/*
             * `/cart` is a transparent,
             * animation-free entry gate.
             */}
            <Stack.Screen
              name="cart"
              options={{
                headerShown:
                  false,

                presentation:
                  'transparentModal',

                animation:
                  'none',

                gestureEnabled:
                  false,

                contentStyle: {
                  backgroundColor:
                    'transparent',
                },
              }}
            />

            <Stack.Screen
              name="cart-details"
              options={{
                headerShown:
                  false,
              }}
            />

            <Stack.Screen
              name="cart-picker"
              options={{
                headerShown:
                  false,

                presentation:
                  'transparentModal',

                animation:
                  'fade',

                gestureEnabled:
                  false,

                contentStyle: {
                  backgroundColor:
                    'transparent',
                },
              }}
            />

            <Stack.Screen
              name="location-picker"
              options={{
                animation:
                  'slide_from_right',

                headerShown:
                  false,
              }}
            />

            <Stack.Screen
              name="promo/[id]"
              options={{
                animation:
                  'slide_from_right',

                gestureEnabled:
                  true,

                headerShown:
                  false,
              }}
            />
          </Stack>

          <GlobalCartDockBridge
            enabled={
              !showBootstrapScreen
            }
          />
        </>
      ) : null}

      {startupHasResolved &&
      launchGate &&
      !appIsAllowed ? (
        <AppLaunchBlockScreen
          gate={
            launchGate
          }
          isRefreshing={
            isRefreshingLaunchGate
          }
          onRefresh={() => {
            void refreshLaunchGate();
          }}
        />
      ) : null}

      {showBootstrapScreen ? (
        <AppBootstrapScreen
          isReady={
            startupHasResolved
          }
          onFinished={
            finishBootstrap
          }
        />
      ) : null}
    </View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      flex: 1,
    },

    /*
     * Must be the exact same green used by the native splash.
     *
     * Native #00B14F
     * React  #00B14F
     *
     * That exact match is what removes the visible transition.
     */
    bootstrapScreen: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      bottom: 0,

      justifyContent:
        'center',

      left: 0,

      paddingHorizontal:
        24,

      position:
        'absolute',

      right: 0,

      top: 0,

      zIndex: 100,
    },

    logoStage: {
      position:
        'relative',
    },

    wordmarkLayer: {
      left: 0,

      overflow:
        'hidden',

      position:
        'absolute',

      top: 0,

      zIndex: 1,
    },

    wordmarkRevealCover: {
      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      left: 0,

      position:
        'absolute',

      top: 0,
    },

    dotLayer: {
      left: 0,

      position:
        'absolute',

      top: 0,

      zIndex: 2,
    },

    errorBoundaryScreen: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.page,

      flex: 1,

      justifyContent:
        'center',

      paddingHorizontal:
        28,
    },

    errorBoundaryTitle: {
      color:
        NAVIENTY_NOW_COLORS.textPrimary,

      fontSize: 22,

      fontWeight:
        '800',

      marginBottom:
        10,

      textAlign:
        'center',
    },

    errorBoundaryMessage: {
      color:
        NAVIENTY_NOW_COLORS.textSecondary,

      fontSize:
        14,

      lineHeight:
        22,

      marginBottom:
        22,

      textAlign:
        'center',
    },

    errorBoundaryButton: {
      alignItems:
        'center',

      backgroundColor:
        NAVIENTY_NOW_COLORS.primary,

      borderRadius:
        14,

      minWidth:
        150,

      paddingHorizontal:
        22,

      paddingVertical:
        13,
    },

    errorBoundaryButtonPressed: {
      opacity:
        0.82,
    },

    errorBoundaryButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '800',
    },
  });