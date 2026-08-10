import Ionicons from '@expo/vector-icons/Ionicons';
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

type TabDefinition = {
  key: MainTab;
  label: string;
  accessibilityLabel: string;
  route:
    | '/'
    | '/orders'
    | '/cart'
    | '/account';
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
  isActive,
}: {
  kind: MainTab;
  color: string;
  isActive: boolean;
}) {
  if (kind === 'home') {
    return (
      <Ionicons
        color={color}
        name={
          isActive
            ? 'home'
            : 'home-outline'
        }
        size={22}
      />
    );
  }

  if (kind === 'orders') {
    return (
      <Ionicons
        color={color}
        name={
          isActive
            ? 'receipt'
            : 'receipt-outline'
        }
        size={21}
      />
    );
  }

  if (kind === 'cart') {
    return (
      <Ionicons
        color={color}
        name={
          isActive
            ? 'bag-handle'
            : 'bag-handle-outline'
        }
        size={22}
      />
    );
  }

  return (
    <Ionicons
      color={color}
      name={
        isActive
          ? 'person'
          : 'person-outline'
      }
      size={22}
    />
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
      badgeCount: 0,
    },
    {
      key: 'orders',
      label: 'طلباتي',
      accessibilityLabel:
        'الانتقال إلى الطلبات',
      route: '/orders',
      badgeCount: ordersCount,
    },
    {
      key: 'cart',
      label: 'السلة',
      accessibilityLabel:
        'الانتقال إلى سلة الطلب',
      route: '/cart',
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
      badgeCount: 0,
    },
  ];

  return (
    <View
      accessibilityRole="tablist"
      style={styles.navigationWrapper}
    >
      <View style={styles.navigationContainer}>
        {tabs.map((tab) => {
          const isActive =
            tab.key === activeTab;

          const color = isActive
            ? NAVIENTY_NOW_COLORS.primary
            : '#74777D';

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
              hitSlop={{
                bottom: 4,
                left: 4,
                right: 4,
                top: 4,
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
                  color={color}
                  isActive={isActive}
                  kind={tab.key}
                />

                {tab.key === 'account' &&
                  !isSignedIn && (
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility={
                        'no-hide-descendants'
                      }
                      style={styles.accountStatusDot}
                    />
                  )}

                {tab.badgeCount > 0 && (
                  <View style={styles.badge}>
                    <Text
                      allowFontScaling={false}
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
                allowFontScaling={false}
                numberOfLines={1}
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
    borderTopColor: '#ECEDEF',
    borderTopWidth:
      StyleSheet.hairlineWidth,
    bottom: 0,
    elevation: 12,
    left: 0,
    paddingBottom:
      Platform.OS === 'ios' ? 18 : 8,
    position: 'absolute',
    right: 0,
    shadowColor: '#000000',
    shadowOffset: {
      height: -3,
      width: 0,
    },
    shadowOpacity: 0.025,
    shadowRadius: 8,
    zIndex: 50,
  },

  navigationContainer: {
    alignSelf: 'center',
    flexDirection: 'row-reverse',
    height:
      NAVIENTY_NOW_LAYOUT
        .bottomNavigationHeight,
    maxWidth:
      NAVIENTY_NOW_LAYOUT.contentMaxWidth,
    paddingHorizontal: 6,
    width: '100%',
  },

  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 55,
    paddingHorizontal: 3,
    paddingTop: 5,
  },

  tabPressed: {
    opacity: 0.55,
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  iconWrapper: {
    alignItems: 'center',
    height: 25,
    justifyContent: 'center',
    position: 'relative',
    width: 34,
  },

  accountStatusDot: {
    backgroundColor:
      NAVIENTY_NOW_COLORS.primary,
    borderColor:
      NAVIENTY_NOW_COLORS.white,
    borderRadius: 5,
    borderWidth: 1.5,
    height: 8,
    position: 'absolute',
    right: 3,
    top: -2,
    width: 8,
  },

  badge: {
    alignItems: 'center',
    backgroundColor:
      NAVIENTY_NOW_COLORS.error,
    borderColor:
      NAVIENTY_NOW_COLORS.white,
    borderRadius: 9,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 16,
    minWidth: 16,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -3,
    top: -5,
  },

  badgeText: {
    color: NAVIENTY_NOW_COLORS.white,
    fontSize: 8,
    fontWeight: '900',
    lineHeight: 10,
    textAlign: 'center',
  },

  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
    marginTop: 3,
    textAlign: 'center',
  },

  tabLabelActive: {
    fontWeight: '700',
  },
});