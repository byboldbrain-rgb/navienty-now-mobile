import { useRouter } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Circle,
  Path,
  Rect,
  Svg,
} from 'react-native-svg';

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
  isSignedIn?: boolean;
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

type TabIconProps = {
  kind: MainTab;
  active: boolean;
};

type CustomIconProps = {
  active: boolean;
  size: number;
};

const NAV_BACKGROUND = '#FFFFFF';
const NAV_BORDER = '#EEF0F1';

/**
 * Strong graphite.
 *
 * Inactive icons remain very visible
 * without competing with the active
 * Navienty green.
 */
const INACTIVE_COLOR = '#626A72';

const ACTIVE_COLOR =
  NAVIENTY_NOW_COLORS.primary;

const BADGE_BACKGROUND = '#E5484D';

/**
 * Optical sizing.
 *
 * Not every 30px icon LOOKS 30px.
 *
 * Orders + Account have slightly less
 * visual mass, so they receive +1px.
 */
const ICON_SIZES: Record<
  MainTab,
  number
> = {
  home: 30,
  orders: 31,
  cart: 30,
  account: 31,
};

function formatBadgeCount(
  count: number,
): string {
  if (count > 99) {
    return '99+';
  }

  return String(count);
}

/**
 * NAVIENTY HOME
 */
function NavientyHomeIcon({
  active,
  size,
}: CustomIconProps) {
  const color = active
    ? ACTIVE_COLOR
    : INACTIVE_COLOR;

  const strokeWidth = active
    ? 2
    : 1.8;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Path
        d="
          M4.35 10.15
          L10.95 4.72
          C11.56 4.22 12.44 4.22 13.05 4.72
          L19.65 10.15
        "
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Path
        d="
          M6.15 9.55
          V17.1
          C6.15 18.18 7.02 19.05 8.1 19.05
          H15.9
          C16.98 19.05 17.85 18.18 17.85 17.1
          V9.55
        "
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {active ? (
        <Rect
          x="10.3"
          y="13.05"
          width="3.4"
          height="6"
          rx="1.3"
          fill={color}
        />
      ) : (
        <Path
          d="
            M10.35 19
            V14.25
            C10.35 13.58 10.9 13.05 11.55 13.05
            H12.45
            C13.1 13.05 13.65 13.58 13.65 14.25
            V19
          "
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

/**
 * NAVIENTY ORDERS
 */
function NavientyOrdersIcon({
  active,
  size,
}: CustomIconProps) {
  const color = active
    ? ACTIVE_COLOR
    : INACTIVE_COLOR;

  const strokeWidth = active
    ? 2
    : 1.8;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Path
        d="
          M7.05 4.7
          H16.95
          C18.02 4.7 18.9 5.58 18.9 6.65
          V17.35
          C18.9 18.42 18.02 19.3 16.95 19.3
          H7.05
          C5.98 19.3 5.1 18.42 5.1 17.35
          V6.65
          C5.1 5.58 5.98 4.7 7.05 4.7
          Z
        "
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Path
        d="
          M8.15 9.05
          H15.85
        "
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      <Path
        d="
          M8.15 12.1
          H12.15
        "
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {active ? (
        <>
          <Circle
            cx="15.15"
            cy="15.45"
            r="2.05"
            fill={color}
          />

          <Path
            d="
              M14.25 15.45
              L14.85 16.05
              L16.15 14.75
            "
            stroke="#FFFFFF"
            strokeWidth="1.15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <Path
          d="
            M14.05 15.45
            L14.75 16.15
            L16.25 14.65
          "
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

/**
 * NAVIENTY BAG
 */
function NavientyBagIcon({
  active,
  size,
}: CustomIconProps) {
  const color = active
    ? ACTIVE_COLOR
    : INACTIVE_COLOR;

  const strokeWidth = active
    ? 2
    : 1.8;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Path
        d="
          M7.35 8.25
          H16.65
          C17.7 8.25 18.55 9.05 18.65 10.1
          L19.3 17.05
          C19.42 18.28 18.46 19.35 17.22 19.35
          H6.78
          C5.54 19.35 4.58 18.28 4.7 17.05
          L5.35 10.1
          C5.45 9.05 6.3 8.25 7.35 8.25
          Z
        "
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Path
        d="
          M8.65 9
          V7.45
          C8.65 5.6 10.15 4.1 12 4.1
          C13.85 4.1 15.35 5.6 15.35 7.45
          V9
        "
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {active ? (
        <Path
          d="
            M9.05 13.35
            C9.75 14.05 10.75 14.45 12 14.45
            C13.25 14.45 14.25 14.05 14.95 13.35
          "
          stroke={color}
          strokeWidth="2.35"
          strokeLinecap="round"
        />
      ) : (
        <Path
          d="
            M9.3 13.55
            C10 14.1 10.88 14.4 12 14.4
            C13.12 14.4 14 14.1 14.7 13.55
          "
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

/**
 * NAVIENTY ACCOUNT
 */
function NavientyAccountIcon({
  active,
  size,
}: CustomIconProps) {
  const color = active
    ? ACTIVE_COLOR
    : INACTIVE_COLOR;

  const strokeWidth = active
    ? 2
    : 1.8;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      {active ? (
        <>
          <Circle
            cx="12"
            cy="7.45"
            r="3.15"
            fill={color}
          />

          <Path
            d="
              M5.35 18.65
              C5.75 15.3 8.55 12.9 12 12.9
              C15.45 12.9 18.25 15.3 18.65 18.65
              C18.72 19.25 18.25 19.75 17.65 19.75
              H6.35
              C5.75 19.75 5.28 19.25 5.35 18.65
              Z
            "
            fill={color}
          />
        </>
      ) : (
        <>
          <Circle
            cx="12"
            cy="7.45"
            r="3.15"
            stroke={color}
            strokeWidth={strokeWidth}
          />

          <Path
            d="
              M5.4 19.15
              C5.65 15.62 8.5 13.05 12 13.05
              C15.5 13.05 18.35 15.62 18.6 19.15
            "
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}

function TabIcon({
  kind,
  active,
}: TabIconProps) {
  const size =
    ICON_SIZES[kind];

  if (kind === 'home') {
    return (
      <NavientyHomeIcon
        active={active}
        size={size}
      />
    );
  }

  if (kind === 'orders') {
    return (
      <NavientyOrdersIcon
        active={active}
        size={size}
      />
    );
  }

  if (kind === 'cart') {
    return (
      <NavientyBagIcon
        active={active}
        size={size}
      />
    );
  }

  return (
    <NavientyAccountIcon
      active={active}
      size={size}
    />
  );
}

export default function AppBottomNavigation({
  activeTab,
  isSignedIn = false,
}: AppBottomNavigationProps) {
  const router = useRouter();

  const insets =
    useSafeAreaInsets();

  const cartCount =
    useCartStore(
      selectCartItemCount,
    );

  const ordersCount =
    useOrdersStore(
      (state) =>
        state.orders.length,
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

      badgeCount:
        ordersCount,
    },

    {
      key: 'cart',

      label: 'السلة',

      accessibilityLabel:
        'الانتقال إلى سلة الطلب',

      route: '/cart',

      badgeCount:
        cartCount,
    },

    {
      key: 'account',

      label:
        isSignedIn
          ? 'حسابي'
          : 'دخول',

      accessibilityLabel:
        isSignedIn
          ? 'الانتقال إلى الحساب'
          : 'الانتقال إلى تسجيل الدخول',

      route: '/account',

      badgeCount: 0,
    },
  ];

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.navigationWrapper,
        {
          paddingBottom:
            Math.max(
              insets.bottom,
              8,
            ),
        },
      ]}
    >
      <View
        style={
          styles.navigationContainer
        }
      >
        {tabs.map((tab) => {
          const active =
            tab.key === activeTab;

          return (
            <Pressable
              key={tab.key}
              accessibilityLabel={
                tab.accessibilityLabel
              }
              accessibilityRole="tab"
              accessibilityState={{
                selected: active,
              }}
              hitSlop={{
                top: 6,
                bottom: 6,
                left: 6,
                right: 6,
              }}
              style={({
                pressed,
              }) => [
                styles.tab,

                pressed &&
                  styles.tabPressed,
              ]}
              onPress={() => {
                if (active) {
                  return;
                }

                router.push(
                  tab.route,
                );
              }}
            >
              <View
                style={
                  styles.iconStage
                }
              >
                <View
                  style={[
                    styles.iconContainer,

                    active &&
                      styles.iconContainerActive,
                  ]}
                >
                  <TabIcon
                    active={active}
                    kind={tab.key}
                  />
                </View>

                {tab.badgeCount >
                  0 && (
                  <View
                    pointerEvents="none"
                    style={
                      styles.badge
                    }
                  >
                    <Text
                      style={
                        styles.badgeText
                      }
                    >
                      {formatBadgeCount(
                        tab.badgeCount,
                      )}
                    </Text>
                  </View>
                )}
              </View>

              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,

                  {
                    color:
                      active
                        ? ACTIVE_COLOR
                        : INACTIVE_COLOR,
                  },

                  active &&
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

const styles =
  StyleSheet.create({
    navigationWrapper: {
      backgroundColor:
        NAV_BACKGROUND,

      borderTopColor:
        NAV_BORDER,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      bottom: 0,
      left: 0,

      position:
        'absolute',

      right: 0,

      zIndex: 50,

      shadowColor: '#101828',

      shadowOffset: {
        width: 0,
        height: -2,
      },

      shadowOpacity: 0.025,

      shadowRadius: 8,

      elevation: 4,
    },

    navigationContainer: {
      alignSelf:
        'center',

      flexDirection:
        'row-reverse',

      height:
        NAVIENTY_NOW_LAYOUT
          .bottomNavigationHeight,

      maxWidth:
        NAVIENTY_NOW_LAYOUT
          .contentMaxWidth,

      paddingHorizontal: 8,

      width: '100%',
    },

    tab: {
      alignItems:
        'center',

      flex: 1,

      justifyContent:
        'center',

      minHeight: 60,

      paddingHorizontal: 4,

      paddingTop: 4,
    },

    tabPressed: {
      opacity: 0.72,

      transform: [
        {
          scale: 0.965,
        },
      ],
    },

    /**
     * Larger optical stage.
     *
     * The glyph now has enough room
     * to breathe at 30–31px.
     */
    iconStage: {
      alignItems:
        'center',

      height: 38,

      justifyContent:
        'center',

      position:
        'relative',

      width: 50,
    },

    iconContainer: {
      alignItems:
        'center',

      height: 34,

      justifyContent:
        'center',

      width: 34,
    },

    /**
     * Active state stays restrained.
     *
     * Larger icons already have presence,
     * so we don't need aggressive scaling.
     */
    iconContainerActive: {
      transform: [
        {
          translateY: -1,
        },
        {
          scale: 1.025,
        },
      ],
    },

    /**
     * Slightly larger badge to remain
     * proportional with larger glyphs.
     */
    badge: {
      alignItems:
        'center',

      backgroundColor:
        BADGE_BACKGROUND,

      borderColor:
        NAV_BACKGROUND,

      borderRadius: 999,

      borderWidth: 2,

      justifyContent:
        'center',

      minHeight: 17,

      minWidth: 17,

      paddingHorizontal: 3,

      position:
        'absolute',

      right: -1,

      top: -3,

      zIndex: 5,
    },

    badgeText: {
      color: '#FFFFFF',

      fontSize: 8,

      fontWeight: '800',

      includeFontPadding:
        false,

      lineHeight: 10,

      textAlign: 'center',
    },

    /**
     * 11px gives the label slightly
     * more authority now that the icons
     * are larger.
     */
    tabLabel: {
      fontSize: 11,

      fontWeight: '500',

      includeFontPadding:
        false,

      letterSpacing: -0.1,

      lineHeight: 15,

      marginTop: 3,

      textAlign: 'center',
    },

    tabLabelActive: {
      fontWeight: '700',
    },
  });