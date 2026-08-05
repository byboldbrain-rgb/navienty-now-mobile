import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { APP_CONFIG } from '../config/app-config';
import { useCartStore } from '../store/cart-store';
import { useCustomerStore } from '../store/customer-store';
import { useOrdersStore } from '../store/orders-store';
import { NAVIENTY_NOW_COLORS } from '../theme/navienty-now-theme';

const navientyNowLogo = require('../assets/images/navienty-now-logo.jpg');

function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <Image
        accessibilityLabel="شعار Navienty Now"
        resizeMode="contain"
        source={navientyNowLogo}
        style={styles.logo}
      />

      <Text style={styles.appName}>
        {APP_CONFIG.appName}
      </Text>

      <View style={styles.loadingDots}>
        <View style={styles.loadingDot} />
        <View
          style={[
            styles.loadingDot,
            styles.loadingDotMuted,
          ]}
        />
        <View
          style={[
            styles.loadingDot,
            styles.loadingDotMuted,
          ]}
        />
      </View>

      <Text style={styles.loadingText}>
        جاري تحميل بياناتك...
      </Text>
    </View>
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

  const appHasHydrated =
    cartHasHydrated &&
    customerHasHydrated &&
    ordersHasHydrated;

  if (!appHasHydrated) {
    return (
      <>
        <StatusBar style="light" />
        <LoadingScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          animation: 'fade',
          contentStyle: {
            backgroundColor:
              NAVIENTY_NOW_COLORS.page,
          },
          headerShown: false,
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  logo: {
    borderRadius: 34,
    height: 170,
    width: 170,
  },

  appName: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 20,
    textAlign: 'center',
  },

  loadingDots: {
    flexDirection: 'row',
    marginTop: 30,
  },

  loadingDot: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderRadius: 4,
    height: 8,
    marginHorizontal: 4,
    width: 18,
  },

  loadingDotMuted: {
    opacity: 0.35,
    width: 8,
  },

  loadingText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    marginTop: 14,
    textAlign: 'center',
  },
});
