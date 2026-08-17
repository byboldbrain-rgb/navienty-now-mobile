import { Stack } from 'expo-router';
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
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import AppLaunchBlockScreen from '../components/app-launch-block-screen';
import OrderRealtimeBridge from '../components/order-realtime-bridge';
import {
  getAppLaunchGate,
  type AppLaunchGateResult,
} from '../services/app-launch-gate-service';
import {
  ensureAppSession,
} from '../services/anonymous-auth-service';
import { useCartStore } from '../store/cart-store';
import { useCustomerStore } from '../store/customer-store';
import { useOrdersStore } from '../store/orders-store';
import { NAVIENTY_NOW_COLORS } from '../theme/navienty-now-theme';

const bootstrapFullLogo = require(
  '../assets/images/navienty-now-bootstrap-full.png',
);

const bootstrapDot = require(
  '../assets/images/navienty-now-bootstrap-dot.png',
);

const BOOTSTRAP_LOGO_ASPECT_RATIO = 1385 / 565;

const DOT_START_DELAY_MS = 70;
const DOT_DROP_DURATION_MS = 330;
const WORDMARK_REVEAL_DURATION_MS = 420;
const READY_HOLD_MS = 150;
const EXIT_FADE_DURATION_MS = 260;

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Safe during Fast Refresh / environments where the native splash
  // may already be hidden.
});

type AppBootstrapScreenProps = {
  isReady: boolean;
  onFinished: () => void;
};

function AppBootstrapScreen({
  isReady,
  onFinished,
}: AppBootstrapScreenProps) {
  const { width: windowWidth } = useWindowDimensions();

  const nativeSplashHiddenRef = useRef(false);
  const exitStartedRef = useRef(false);
  const holdTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const [introFinished, setIntroFinished] =
    useState(false);

  const dotOpacity = useRef(
    new Animated.Value(0),
  ).current;

  const dotTranslateY = useRef(
    new Animated.Value(-58),
  ).current;

  const dotScale = useRef(
    new Animated.Value(0.94),
  ).current;

  // This value controls the actual visible width of the logo.
  // Unlike the previous green-cover technique, this physically clips
  // the wordmark from 0px to its full width, so Android cannot leave
  // a green overlay stuck above the artwork.
  const revealWidth = useRef(
    new Animated.Value(0),
  ).current;

  const screenOpacity = useRef(
    new Animated.Value(1),
  ).current;

  const logoWidth = Math.min(
    330,
    Math.max(235, windowWidth * 0.7),
  );

  const logoHeight =
    logoWidth / BOOTSTRAP_LOGO_ASPECT_RATIO;

  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHiddenRef.current) {
      return;
    }

    nativeSplashHiddenRef.current = true;

    void SplashScreen.hideAsync().catch(() => {
      // Safe in Expo Go / Fast Refresh.
    });
  }, []);

  useEffect(() => {
    revealWidth.setValue(0);

    const introAnimation = Animated.sequence([
      Animated.delay(DOT_START_DELAY_MS),

      Animated.parallel([
        Animated.timing(dotOpacity, {
          toValue: 1,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),

        Animated.timing(dotTranslateY, {
          toValue: 0,
          duration: DOT_DROP_DURATION_MS,
          easing: Easing.bezier(
            0.22,
            0.84,
            0.31,
            1,
          ),
          useNativeDriver: true,
        }),

        Animated.timing(dotScale, {
          toValue: 1,
          duration: DOT_DROP_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      Animated.timing(revealWidth, {
        toValue: logoWidth,
        duration: WORDMARK_REVEAL_DURATION_MS,
        easing: Easing.bezier(
          0.22,
          0.72,
          0.22,
          1,
        ),
        useNativeDriver: false,
      }),
    ]);

    introAnimation.start(({ finished }) => {
      if (finished) {
        setIntroFinished(true);
      }
    });

    return () => {
      introAnimation.stop();
    };
  }, [
    dotOpacity,
    dotScale,
    dotTranslateY,
    logoWidth,
    revealWidth,
  ]);

  useEffect(() => {
    if (
      !introFinished ||
      !isReady ||
      exitStartedRef.current
    ) {
      return;
    }

    exitStartedRef.current = true;

    holdTimerRef.current = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: EXIT_FADE_DURATION_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onFinished();
        }
      });
    }, READY_HOLD_MS);

    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [
    introFinished,
    isReady,
    onFinished,
    screenOpacity,
  ]);

  return (
    <Animated.View
      accessibilityLabel="Navienty Now"
      accessibilityRole="progressbar"
      style={[
        styles.bootstrapScreen,
        {
          opacity: screenOpacity,
        },
      ]}
      onLayout={hideNativeSplash}
    >
      <View
        style={[
          styles.logoStage,
          {
            height: logoHeight,
            width: logoWidth,
          },
        ]}
      >
        {/* Real wordmark reveal: the clipping container grows from
            0px to the full logo width. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wordmarkClip,
            {
              height: logoHeight,
              width: revealWidth,
            },
          ]}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={bootstrapFullLogo}
            style={{
              height: logoHeight,
              width: logoWidth,
            }}
          />
        </Animated.View>

        {/* Separate i-dot lands first and remains above the full logo.
            When the full logo reveal reaches the i position, both dots
            overlap pixel-for-pixel so there is no visual jump. */}
        <Animated.Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={bootstrapDot}
          style={[
            styles.dotLayer,
            {
              height: logoHeight,
              opacity: dotOpacity,
              transform: [
                {
                  translateY: dotTranslateY,
                },
                {
                  scale: dotScale,
                },
              ],
              width: logoWidth,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

export default function RootLayout() {
  const cartHasHydrated = useCartStore(
    (state) => state.hasHydrated,
  );

  const customerHasHydrated =
    useCustomerStore(
      (state) => state.hasHydrated,
    );

  const ordersHasHydrated =
    useOrdersStore(
      (state) => state.hasHydrated,
    );

  const [
    authBootstrapFinished,
    setAuthBootstrapFinished,
  ] = useState(false);

  const [
    launchGate,
    setLaunchGate,
  ] = useState<AppLaunchGateResult | null>(
    null,
  );

  const [
    isRefreshingLaunchGate,
    setIsRefreshingLaunchGate,
  ] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      try {
        /**
         * If a permanent or anonymous session is already stored,
         * keep it. Otherwise create one anonymous Supabase user.
         *
         * This happens silently: the customer never sees a Login
         * screen just to browse, use the cart, or place an order.
         */
        await ensureAppSession();
      } catch (error) {
        /**
         * Do not trap the app forever on the splash screen if Auth
         * is temporarily unavailable. The launch gate will surface
         * a recoverable connectivity error when bootstrap also fails.
         */
        console.warn(
          'Unable to bootstrap anonymous Supabase session:',
          error,
        );
      } finally {
        if (!cancelled) {
          setAuthBootstrapFinished(true);
        }
      }
    }

    void bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authBootstrapFinished) {
      return;
    }

    let cancelled = false;

    async function bootstrapLaunchGate() {
      const result =
        await getAppLaunchGate();

      if (!cancelled) {
        setLaunchGate(result);
      }
    }

    void bootstrapLaunchGate();

    return () => {
      cancelled = true;
    };
  }, [authBootstrapFinished]);

  const refreshLaunchGate =
    useCallback(async () => {
      if (isRefreshingLaunchGate) {
        return;
      }

      setIsRefreshingLaunchGate(true);

      try {
        const result =
          await getAppLaunchGate();

        setLaunchGate(result);
      } finally {
        setIsRefreshingLaunchGate(false);
      }
    }, [isRefreshingLaunchGate]);

  const appHasHydrated =
    cartHasHydrated &&
    customerHasHydrated &&
    ordersHasHydrated;

  const startupHasResolved =
    appHasHydrated &&
    authBootstrapFinished &&
    launchGate !== null;

  const appIsAllowed =
    launchGate?.status === 'allowed';

  const [
    showBootstrapScreen,
    setShowBootstrapScreen,
  ] = useState(true);

  const finishBootstrap = useCallback(() => {
    setShowBootstrapScreen(false);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar
        style={
          showBootstrapScreen
            ? 'light'
            : 'dark'
        }
      />

      {startupHasResolved && appIsAllowed ? (
        <>
          <OrderRealtimeBridge />

          <Stack
            screenOptions={{
              animation: 'fade',
              contentStyle: {
                backgroundColor:
                  NAVIENTY_NOW_COLORS.page,
              },
              headerShown: false,
            }}
          >
            <Stack.Screen
              name="location-picker"
              options={{
                animation:
                  'slide_from_right',
                headerShown: false,
              }}
            />

            <Stack.Screen
              name="promo/[id]"
              options={{
                animation: 'slide_from_right',
                gestureEnabled: true,
                headerShown: false,
              }}
            />
          </Stack>
        </>
      ) : null}

      {startupHasResolved &&
      launchGate &&
      !appIsAllowed ? (
        <AppLaunchBlockScreen
          gate={launchGate}
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
          isReady={startupHasResolved}
          onFinished={finishBootstrap}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    flex: 1,
  },

  bootstrapScreen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 100,
  },

  logoStage: {
    position: 'relative',
  },

  wordmarkClip: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    zIndex: 1,
  },

  dotLayer: {
    left: 0,
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
});
