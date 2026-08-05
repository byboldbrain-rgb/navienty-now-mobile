import { useRouter } from 'expo-router';
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    selectCartItemCount,
    useCartStore,
} from '../store/cart-store';
import { useOrdersStore } from '../store/orders-store';
import {
    NAVIENTY_NOW_COLORS,
    NAVIENTY_NOW_LAYOUT,
} from '../theme/navienty-now-theme';

type MainTab =
  | 'home'
  | 'orders'
  | 'cart'
  | 'account';

type AppBottomNavigationProps = {
  activeTab: MainTab;
  isSignedIn: boolean;
};

type TabIconKind = MainTab;

type TabDefinition = {
  key: MainTab;
  label: string;
  accessibilityLabel: string;
  route:
    | '/'
    | '/orders'
    | '/cart'
    | '/account';
  icon: TabIconKind;
  badgeCount: number;
};

function formatBadgeCount(
  count: number,
): string {
  return count > 99
    ? '99+'
    : String(count);
}

function TabIcon({
  kind,
  color,
}: {
  kind: TabIconKind;
  color: string;
}) {
  if (kind === 'home') {
    return (
      <View
        style={styles.iconCanvas}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View
          style={[
            styles.homeRoof,
            {
              borderBottomColor: color,
              borderLeftColor:
                'transparent',
              borderRightColor:
                'transparent',
            },
          ]}
        />
        <View
          style={[
            styles.homeBody,
            {
              borderColor: color,
            },
          ]}
        />
        <View
          style={[
            styles.homeDoor,
            {
              backgroundColor: color,
            },
          ]}
        />
      </View>
    );
  }

  if (kind === 'orders') {
    return (
      <View
        style={styles.iconCanvas}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View
          style={[
            styles.receiptBody,
            {
              borderColor: color,
            },
          ]}
        >
          <View
            style={[
              styles.receiptLine,
              {
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.receiptLine,
              styles.receiptLineShort,
              {
                backgroundColor: color,
              },
            ]}
          />
        </View>
      </View>
    );
  }

  if (kind === 'cart') {
    return (
      <View
        style={styles.iconCanvas}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View
          style={[
            styles.cartHandle,
            {
              borderColor: color,
            },
          ]}
        />
        <View
          style={[
            styles.cartBasket,
            {
              borderColor: color,
            },
          ]}
        />
        <View style={styles.cartWheelsRow}>
          <View
            style={[
              styles.cartWheel,
              {
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.cartWheel,
              {
                backgroundColor: color,
              },
            ]}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.iconCanvas}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.accountHead,
          {
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.accountBody,
          {
            borderColor: color,
          },
        ]}
      />
    </View>
  );
}

export default function AppBottomNavigation({
  activeTab,
  isSignedIn,
}: AppBottomNavigationProps) {
  const router = useRouter();

  const cartCount = useCartStore(
    selectCartItemCount,
  );

  const ordersCount = useOrdersStore(
    (state) => state.orders.length,
  );

  const tabs: TabDefinition[] = [
    {
      key: 'home',
      label: 'الرئيسية',
      accessibilityLabel:
        'الانتقال إلى الصفحة الرئيسية',
      route: '/',
      icon: 'home',
      badgeCount: 0,
    },
    {
      key: 'orders',
      label: 'طلباتي',
      accessibilityLabel:
        'الانتقال إلى الطلبات',
      route: '/orders',
      icon: 'orders',
      badgeCount: ordersCount,
    },
    {
      key: 'cart',
      label: 'السلة',
      accessibilityLabel:
        'الانتقال إلى سلة الطلب',
      route: '/cart',
      icon: 'cart',
      badgeCount: cartCount,
    },
    {
      key: 'account',
      label: isSignedIn
        ? 'حسابي'
        : 'دخول',
      accessibilityLabel: isSignedIn
        ? 'الانتقال إلى الحساب'
        : 'الانتقال إلى تسجيل الدخول',
      route: '/account',
      icon: 'account',
      badgeCount: 0,
    },
  ];

  return (
    <View
      style={styles.navigationWrapper}
      accessibilityRole="tablist"
    >
      <View style={styles.navigationContainer}>
        {tabs.map((tab) => {
          const isActive =
            tab.key === activeTab;

          const color = isActive
            ? NAVIENTY_NOW_COLORS.primary
            : NAVIENTY_NOW_COLORS.textSecondary;

          return (
            <Pressable
              key={tab.key}
              accessibilityLabel={
                tab.accessibilityLabel
              }
              accessibilityRole="tab"
              accessibilityState={{
                selected: isActive,
              }}
              style={({ pressed }) => [
                styles.tab,
                pressed && styles.tabPressed,
              ]}
              onPress={() => {
                if (!isActive) {
                  router.push(tab.route);
                }
              }}
            >
              <View style={styles.iconWrapper}>
                <TabIcon
                  kind={tab.icon}
                  color={color}
                />

                {tab.badgeCount > 0 && (
                  <View style={styles.badge}>
                    <Text
                      style={styles.badgeText}
                    >
                      {formatBadgeCount(
                        tab.badgeCount,
                      )}
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.tabLabel,
                  {
                    color,
                  },
                  isActive &&
                    styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navigationWrapper: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.white,
    borderTopColor:
      NAVIENTY_NOW_COLORS.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    paddingBottom:
      Platform.OS === 'ios' ? 18 : 9,
    position: 'absolute',
    right: 0,
    zIndex: 50,
  },

  navigationContainer: {
    alignSelf: 'center',
    flexDirection: 'row-reverse',
    height:
      NAVIENTY_NOW_LAYOUT.bottomNavigationHeight,
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    paddingHorizontal: 8,
    width: '100%',
  },

  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 4,
    paddingTop: 7,
  },

  tabPressed: {
    opacity: 0.65,
  },

  iconWrapper: {
    alignItems: 'center',
    height: 29,
    justifyContent: 'center',
    position: 'relative',
    width: 35,
  },

  iconCanvas: {
    height: 27,
    position: 'relative',
    width: 27,
  },

  homeRoof: {
    borderBottomWidth: 10,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    height: 0,
    left: 3,
    position: 'absolute',
    top: 1,
    width: 0,
  },

  homeBody: {
    borderRadius: 3,
    borderWidth: 2,
    bottom: 2,
    height: 15,
    left: 5,
    position: 'absolute',
    width: 17,
  },

  homeDoor: {
    bottom: 2,
    height: 8,
    left: 11,
    position: 'absolute',
    width: 5,
  },

  receiptBody: {
    borderRadius: 4,
    borderWidth: 2,
    height: 24,
    left: 5,
    paddingHorizontal: 4,
    paddingTop: 6,
    position: 'absolute',
    top: 1,
    width: 17,
  },

  receiptLine: {
    borderRadius: 2,
    height: 2,
    marginBottom: 4,
    width: 7,
  },

  receiptLineShort: {
    width: 5,
  },

  cartHandle: {
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    height: 6,
    left: 3,
    position: 'absolute',
    top: 2,
    width: 6,
  },

  cartBasket: {
    borderRadius: 4,
    borderWidth: 2,
    height: 13,
    left: 7,
    position: 'absolute',
    top: 7,
    width: 17,
  },

  cartWheelsRow: {
    bottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 10,
    position: 'absolute',
    width: 11,
  },

  cartWheel: {
    borderRadius: 3,
    height: 4,
    width: 4,
  },

  accountHead: {
    borderRadius: 7,
    borderWidth: 2,
    height: 10,
    left: 9,
    position: 'absolute',
    top: 1,
    width: 10,
  },

  accountBody: {
    borderBottomWidth: 0,
    borderRadius: 10,
    borderWidth: 2,
    bottom: 1,
    height: 12,
    left: 5,
    position: 'absolute',
    width: 18,
  },

  badge: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.error,
    borderColor:
      NAVIENTY_NOW_COLORS.white,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 17,
    minWidth: 17,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -4,
    top: -4,
  },

  badgeText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 8,
    fontWeight: '900',
    lineHeight: 11,
  },

  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },

  tabLabelActive: {
    fontWeight: '900',
  },
});
